import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { connectedUsers } from './index.js';
import { createGameDirect } from './gameHandler.js';
import { TURN_TIME } from '../../shared/constants.js';
import { SITE_URL } from '../config.js';

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

export function findRoomByCode(code) {
  for (const room of gameRooms.values()) {
    if (room.joinCode === code) return room;
  }
  return null;
}

export function findRoomForUser(userId) {
  for (const room of gameRooms.values()) {
    if (room.status === 'playing') continue;
    if (room.players.some(p => p.userId === userId)) return room;
  }
  return null;
}

function sanitizeRoom(room, includeCode = false) {
  const result = {
    id: room.id,
    hostId: room.hostId,
    hostName: room.hostName,
    joinCode: room.joinCode,
    settings: {
      buyIn: room.settings.buyIn,
      turnTimer: room.settings.turnTimer,
      isPrivate: room.settings.isPrivate,
      allowSpectators: room.settings.allowSpectators,
    },
    players: room.players.map(p => ({ userId: p.userId, username: p.username, elo: p.elo, ready: p.ready, online: p.online !== false })),
    spectators: room.spectators.map(s => ({ userId: s.userId, username: s.username })),
    status: room.status,
    createdAt: room.createdAt
  };
  // Include join URL for room members (not for public list of private rooms)
  result.joinUrl = `${SITE_URL}/join/${room.joinCode}`;
  return result;
}

function broadcastRoomUpdate(io, room) {
  io.to(`room:${room.id}`).emit('room:updated', { room: sanitizeRoom(room) });
  // Also broadcast to the lobby so room lists update
  io.emit('room:list-update', { room: sanitizeRoom(room) });
}

export function setupRoomHandler(io, socket) {

  // --- Reconnect: check if user is already in a room ---
  const existingRoom = findRoomForUser(socket.userId);
  if (existingRoom) {
    socket.join(`room:${existingRoom.id}`);
    const player = existingRoom.players.find(p => p.userId === socket.userId);
    if (player) player.online = true;
    broadcastRoomUpdate(io, existingRoom);
    setTimeout(() => {
      socket.emit('room:reconnect', { room: sanitizeRoom(existingRoom) });
    }, 600);
  }

  // --- Create room ---
  socket.on('room:create', async ({ buyIn = 0, turnTimer = 60, isPrivate = false, allowSpectators = true }) => {
    // One room per user
    if (findRoomForUser(socket.userId)) {
      return socket.emit('room:error', { error: 'You are already in a room' });
    }

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

    const joinCode = genCode();
    const room = {
      id: nextRoomId++,
      hostId: socket.userId,
      hostName: socket.username,
      joinCode, // always generated — used for QR/links
      settings: { buyIn, turnTimer: turnTimer || TURN_TIME, isPrivate, code: isPrivate ? joinCode : null, allowSpectators },
      players: [{ userId: socket.userId, username: socket.username, elo: 0, ready: false, online: true }],
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

    // Generate join URL + QR code
    const joinUrl = `${SITE_URL}/join/${joinCode}`;
    let qrDataUrl = null;
    try { qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 200, margin: 1, color: { dark: '#000', light: '#fff' } }); } catch {}

    const roomData = sanitizeRoom(room);
    roomData.qrDataUrl = qrDataUrl;
    socket.emit('room:created', { room: roomData });
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
    // One room per user
    const alreadyIn = findRoomForUser(socket.userId);
    if (alreadyIn) return socket.emit('room:error', { error: 'Leave your current room first' });

    // Look up by roomId or by joinCode
    let room = roomId ? gameRooms.get(roomId) : null;
    if (!room && code) room = findRoomByCode(code);
    if (!room) return socket.emit('room:error', { error: 'Room not found' });
    if (room.status !== 'waiting') return socket.emit('room:error', { error: 'Game already started' });
    if (room.players.length >= 2) return socket.emit('room:error', { error: 'Room is full' });
    if (room.players.some(p => p.userId === socket.userId)) return socket.emit('room:error', { error: 'Already in this room' });

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
      ready: false,
      online: true
    });

    socket.join(`room:${room.id}`);
    socket.emit('room:joined', { room: sanitizeRoom(room) });
    broadcastRoomUpdate(io, room);
  });

  // --- Leave room ---
  socket.on('room:leave', ({ roomId } = {}) => {
    let room = roomId ? gameRooms.get(roomId) : findRoomForUser(socket.userId);
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
  // Don't remove from room on disconnect (they might be refreshing).
  // Rooms are only destroyed by explicit room:leave or timeout.
  socket.on('disconnect', () => {
    for (const [roomId, room] of gameRooms) {
      if (room.status === 'playing') continue;
      const player = room.players.find(p => p.userId === socket.userId);
      if (player) {
        player.online = false;
        broadcastRoomUpdate(io, room);
        // Auto-destroy after 2 minutes if they don't reconnect
        setTimeout(() => {
          const current = gameRooms.get(roomId);
          if (!current) return;
          const p = current.players.find(pp => pp.userId === socket.userId);
          if (p && p.online === false) {
            // Still disconnected — remove them
            current.players = current.players.filter(pp => pp.userId !== socket.userId);
            if (current.hostId === socket.userId || current.players.length === 0) {
              gameRooms.delete(roomId);
              io.to(`room:${roomId}`).emit('room:updated', { room: null, closed: true });
              io.emit('room:list-update', { room: { id: roomId, closed: true } });
            } else {
              broadcastRoomUpdate(io, current);
            }
          }
        }, 120000); // 2 minutes
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
