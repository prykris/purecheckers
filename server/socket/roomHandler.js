import { PrismaClient } from '@prisma/client';
import { connectedUsers } from './index.js';
import { createGameDirect } from './gameHandler.js';
import { TURN_TIME } from '../../shared/constants.js';

const prisma = new PrismaClient();

// Active rooms: roomId -> Room
export const gameRooms = new Map();
let nextRoomId = 1;

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function sanitizeRoom(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    hostName: room.hostName,
    settings: {
      buyIn: room.settings.buyIn,
      turnTimer: room.settings.turnTimer,
      isPrivate: room.settings.isPrivate,
      allowSpectators: room.settings.allowSpectators,
      // Don't expose private room code in list
    },
    players: room.players.map(p => ({ userId: p.userId, username: p.username, elo: p.elo, ready: p.ready })),
    spectators: room.spectators.map(s => ({ userId: s.userId, username: s.username })),
    status: room.status,
    createdAt: room.createdAt
  };
}

function broadcastRoomUpdate(io, room) {
  io.to(`room:${room.id}`).emit('room:updated', { room: sanitizeRoom(room) });
  // Also broadcast to the lobby so room lists update
  io.emit('room:list-update', { room: sanitizeRoom(room) });
}

export function setupRoomHandler(io, socket) {

  // --- Create room ---
  socket.on('room:create', async ({ buyIn = 0, turnTimer = 60, isPrivate = false, allowSpectators = true }) => {
    // Validate
    buyIn = Math.max(0, Math.floor(buyIn));
    turnTimer = [30, 60, 90, 0].includes(turnTimer) ? turnTimer : 60; // 0 = unlimited

    // Check if user can afford buy-in
    if (buyIn > 0) {
      const user = await prisma.user.findUnique({ where: { id: socket.userId } });
      if (!user || user.coins < buyIn) {
        return socket.emit('room:error', { error: 'Cannot afford buy-in' });
      }
    }

    const room = {
      id: nextRoomId++,
      hostId: socket.userId,
      hostName: socket.username,
      settings: { buyIn, turnTimer: turnTimer || TURN_TIME, isPrivate, code: isPrivate ? genCode() : null, allowSpectators },
      players: [{ userId: socket.userId, username: socket.username, elo: 0, ready: false }],
      spectators: [],
      status: 'waiting',
      gameId: null,
      createdAt: Date.now()
    };

    // Get host ELO
    const hostUser = await prisma.user.findUnique({ where: { id: socket.userId } });
    if (hostUser) room.players[0].elo = hostUser.elo;

    gameRooms.set(room.id, room);
    socket.join(`room:${room.id}`);

    // Send full room info (with code) to creator
    socket.emit('room:created', {
      room: { ...sanitizeRoom(room), settings: { ...room.settings, code: room.settings.code } }
    });
    io.emit('room:list-update', { room: sanitizeRoom(room) });
  });

  // --- List rooms ---
  socket.on('room:list', ({ filter } = {}) => {
    let rooms = Array.from(gameRooms.values())
      .filter(r => !r.settings.isPrivate) // Hide private rooms from list
      .map(sanitizeRoom);

    if (filter === 'free') rooms = rooms.filter(r => r.settings.buyIn === 0);
    if (filter === 'available') rooms = rooms.filter(r => r.status === 'waiting' && r.players.length < 2);

    // Sort: waiting first, then by creation time (newest first)
    rooms.sort((a, b) => {
      if (a.status === 'waiting' && b.status !== 'waiting') return -1;
      if (b.status === 'waiting' && a.status !== 'waiting') return 1;
      return b.createdAt - a.createdAt;
    });

    socket.emit('room:list', { rooms });
  });

  // --- Join room ---
  socket.on('room:join', async ({ roomId, code }) => {
    const room = gameRooms.get(roomId);
    if (!room) return socket.emit('room:error', { error: 'Room not found' });
    if (room.status !== 'waiting') return socket.emit('room:error', { error: 'Game already started' });
    if (room.players.length >= 2) return socket.emit('room:error', { error: 'Room is full' });
    if (room.players.some(p => p.userId === socket.userId)) return socket.emit('room:error', { error: 'Already in this room' });
    if (room.settings.isPrivate && code !== room.settings.code) return socket.emit('room:error', { error: 'Invalid room code' });

    // Check buy-in
    if (room.settings.buyIn > 0) {
      const user = await prisma.user.findUnique({ where: { id: socket.userId } });
      if (!user || user.coins < room.settings.buyIn) {
        return socket.emit('room:error', { error: 'Cannot afford buy-in' });
      }
    }

    const joinerUser = await prisma.user.findUnique({ where: { id: socket.userId } });
    room.players.push({
      userId: socket.userId,
      username: socket.username,
      elo: joinerUser?.elo || 1000,
      ready: false
    });

    socket.join(`room:${room.id}`);
    socket.emit('room:joined', { room: sanitizeRoom(room) });
    broadcastRoomUpdate(io, room);
  });

  // --- Leave room ---
  socket.on('room:leave', ({ roomId }) => {
    const room = gameRooms.get(roomId);
    if (!room) return;

    socket.leave(`room:${room.id}`);
    room.players = room.players.filter(p => p.userId !== socket.userId);
    room.spectators = room.spectators.filter(s => s.userId !== socket.userId);

    // If host left, close the room
    if (room.hostId === socket.userId || room.players.length === 0) {
      gameRooms.delete(room.id);
      io.to(`room:${room.id}`).emit('room:updated', { room: null, closed: true });
      io.emit('room:list-update', { room: { id: room.id, closed: true } });
    } else {
      broadcastRoomUpdate(io, room);
    }
  });

  // --- Ready up ---
  socket.on('room:ready', ({ roomId }) => {
    const room = gameRooms.get(roomId);
    if (!room || room.status !== 'waiting') return;

    const player = room.players.find(p => p.userId === socket.userId);
    if (!player) return;
    player.ready = !player.ready;

    broadcastRoomUpdate(io, room);

    // Check if all players ready (need exactly 2)
    if (room.players.length === 2 && room.players.every(p => p.ready)) {
      startRoomGame(io, room);
    }
  });

  // --- Spectate ---
  socket.on('room:spectate', ({ roomId }) => {
    const room = gameRooms.get(roomId);
    if (!room) return socket.emit('room:error', { error: 'Room not found' });
    if (!room.settings.allowSpectators) return socket.emit('room:error', { error: 'Spectators not allowed' });
    if (room.players.some(p => p.userId === socket.userId)) return; // Already a player

    if (!room.spectators.some(s => s.userId === socket.userId)) {
      room.spectators.push({ userId: socket.userId, username: socket.username });
    }

    socket.join(`room:${room.id}`);
    socket.emit('room:joined', { room: sanitizeRoom(room), spectating: true });
    broadcastRoomUpdate(io, room);
  });

  // --- Kick player (host only) ---
  socket.on('room:kick', ({ roomId, userId }) => {
    const room = gameRooms.get(roomId);
    if (!room || room.hostId !== socket.userId) return;
    if (userId === socket.userId) return; // Can't kick yourself

    room.players = room.players.filter(p => p.userId !== userId);
    room.spectators = room.spectators.filter(s => s.userId !== userId);

    // Notify kicked user
    const kicked = connectedUsers.get(userId);
    if (kicked) {
      kicked.socket.leave(`room:${room.id}`);
      kicked.socket.emit('room:kicked', { roomId });
    }

    broadcastRoomUpdate(io, room);
  });

  // --- Cleanup on disconnect ---
  socket.on('disconnect', () => {
    for (const [roomId, room] of gameRooms) {
      if (room.status === 'playing') continue; // Don't destroy rooms with active games

      const wasPlayer = room.players.some(p => p.userId === socket.userId);
      room.players = room.players.filter(p => p.userId !== socket.userId);
      room.spectators = room.spectators.filter(s => s.userId !== socket.userId);

      if (room.hostId === socket.userId || room.players.length === 0) {
        gameRooms.delete(roomId);
        io.to(`room:${roomId}`).emit('room:updated', { room: null, closed: true });
        io.emit('room:list-update', { room: { id: roomId, closed: true } });
      } else if (wasPlayer) {
        broadcastRoomUpdate(io, room);
      }
    }
  });
}

async function startRoomGame(io, room) {
  room.status = 'playing';

  // Deduct buy-in
  if (room.settings.buyIn > 0) {
    try {
      await prisma.$transaction(
        room.players.map(p =>
          prisma.user.update({
            where: { id: p.userId },
            data: { coins: { decrement: room.settings.buyIn } }
          })
        )
      );
    } catch (err) {
      room.status = 'waiting';
      room.players.forEach(p => p.ready = false);
      io.to(`room:${room.id}`).emit('room:error', { error: 'Failed to process buy-in' });
      broadcastRoomUpdate(io, room);
      return;
    }
  }

  // Randomly assign colors
  const isFirstRed = Math.random() < 0.5;
  const redUserId = isFirstRed ? room.players[0].userId : room.players[1].userId;
  const blackUserId = isFirstRed ? room.players[1].userId : room.players[0].userId;

  const gameRoom = createGameDirect(io, redUserId, blackUserId, room.settings.buyIn > 0 ? 'RANKED' : 'FRIENDLY', room.settings.buyIn);
  room.gameId = gameRoom.id;

  // Spectators join the game room too
  for (const spec of room.spectators) {
    const specConn = connectedUsers.get(spec.userId);
    if (specConn) specConn.socket.join(`game:${gameRoom.id}`);
  }

  broadcastRoomUpdate(io, room);
}
