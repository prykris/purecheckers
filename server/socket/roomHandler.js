import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { connectedUsers, emitSyncState } from './index.js';
import { createGameDirect } from './gameHandler.js';
import { TURN_TIME } from '../../shared/constants.js';
import { SITE_URL } from '../config.js';
import { getSession, setPhase, forceIdle } from './userState.js';

const prisma = new PrismaClient();

// Active rooms: roomId -> Room
export const gameRooms = new Map();
// Timestamp-based unique ID — never collides across restarts
let nextRoomId = Date.now();

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
    gameId: room.gameId || null,
    createdAt: room.createdAt
  };
  // Include join URL for room members
  result.joinUrl = `${SITE_URL}/join/${room.joinCode}`;
  return result;
}

export function broadcastRoomUpdate(io, room) {
  // Broadcast globally — RoomBanner and RoomList filter by room ID
  io.emit('room:updated', { room: sanitizeRoom(room) });
  // Also broadcast to the lobby so room lists update
  io.emit('room:list-update', { room: sanitizeRoom(room) });
  // Stats are auto-broadcast on phase changes via userState
}

export function setupRoomHandler(io, socket) {

  // --- Reconnect: mark player online if they're in a room ---
  // (Phase/routing is handled by sync:state in index.js)
  const existingRoom = findRoomForUser(socket.userId);
  if (existingRoom) {
    const player = existingRoom.players.find(p => p.userId === socket.userId);
    if (player) player.online = true;
    // Sync session phase if needed
    const session = getSession(socket.userId);
    if (session && session.phase !== 'in-room' && session.phase !== 'in-game') {
      forceIdle(socket.userId);
      setPhase(socket.userId, 'in-room', { roomId: existingRoom.id });
    }
    broadcastRoomUpdate(io, existingRoom);
  }

  // --- Create room ---
  socket.on('room:create', async ({ buyIn = 0, turnTimer = 60, isPrivate = false, allowSpectators = true }) => {
    // Phase check: must be idle
    const session = getSession(socket.userId);
    if (!session || session.phase !== 'idle') {
      return socket.emit('room:error', { error: 'You are already in a room or game' });
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
    setPhase(socket.userId, 'in-room', { roomId: room.id });
    socket.join(`room:${room.id}`);
    socket.join(`chat:room:${room.id}`);
    console.log(`[Room] Created: room #${room.id} by ${socket.username} (${socket.userId}), code=${joinCode}, buyIn=${buyIn}`);

    // Generate join URL + QR code
    const joinUrl = `${SITE_URL}/join/${joinCode}`;
    let qrDataUrl = null;
    try { qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 200, margin: 1, color: { dark: '#000', light: '#fff' } }); } catch {}

    const roomData = sanitizeRoom(room);
    roomData.qrDataUrl = qrDataUrl;
    socket.emit('room:created', { room: roomData });
    emitSyncState(socket, socket.userId);
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
    // Phase check: must be idle
    const joinSession = getSession(socket.userId);
    if (!joinSession || joinSession.phase !== 'idle') {
      return socket.emit('room:error', { error: 'Leave your current room or game first' });
    }

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

    setPhase(socket.userId, 'in-room', { roomId: room.id });
    socket.join(`room:${room.id}`);
    socket.join(`chat:room:${room.id}`);
    console.log(`[Room] Joined: ${socket.username} (${socket.userId}) -> room #${room.id}, players: ${room.players.map(p => p.username).join(', ')}`);
    socket.emit('room:joined', { room: sanitizeRoom(room) });
    emitSyncState(socket, socket.userId);
    broadcastRoomUpdate(io, room);
  });

  // --- Leave room ---
  socket.on('room:leave', ({ roomId } = {}) => {
    let room = roomId ? gameRooms.get(roomId) : findRoomForUser(socket.userId);
    if (!room) return;
    console.log(`[Room] Leave: ${socket.username} (${socket.userId}) from room #${room.id}`);

    forceIdle(socket.userId);
    emitSyncState(socket, socket.userId);
    socket.leave(`room:${room.id}`);
    room.players = room.players.filter(p => p.userId !== socket.userId);
    room.spectators = room.spectators.filter(s => s.userId !== socket.userId);

    if (room.players.length === 0) {
      // No players left — destroy room
      console.log(`[Room] Destroyed: room #${room.id} (empty)`);
      gameRooms.delete(room.id);
      io.emit('room:updated', { room: { id: room.id }, closed: true });
      io.emit('room:list-update', { room: { id: room.id, closed: true } });
    } else {
      // Transfer host if the host left
      if (room.hostId === socket.userId) {
        room.hostId = room.players[0].userId;
        room.hostName = room.players[0].username;
        console.log(`[Room] Host transferred: room #${room.id} -> ${room.hostName} (${room.hostId})`);
      }
      // Reset ready states since player composition changed
      room.players.forEach(p => p.ready = false);
      broadcastRoomUpdate(io, room);
    }
  });

  // --- Ready up ---
  socket.on('room:ready', ({ roomId }) => {
    const room = roomId ? gameRooms.get(roomId) : findRoomForUser(socket.userId);
    if (!room || room.status !== 'waiting') {
      console.log(`[Room] Ready FAILED: ${socket.username} (${socket.userId}), roomId=${roomId}, room=${room ? `#${room.id} status=${room.status}` : 'null'}`);
      return;
    }

    const player = room.players.find(p => p.userId === socket.userId);
    if (!player) {
      console.log(`[Room] Ready FAILED: ${socket.username} (${socket.userId}) not in room #${room.id} players: [${room.players.map(p => `${p.username}(${p.userId})`).join(', ')}]`);
      return;
    }
    player.ready = !player.ready;
    console.log(`[Room] Ready: ${socket.username} (${socket.userId}) in room #${room.id} -> ${player.ready}`);

    broadcastRoomUpdate(io, room);

    // Check if all players ready (need exactly 2)
    if (room.players.length === 2 && room.players.every(p => p.ready)) {
      startRoomGame(io, room);
    }
  });

  // --- Spectate ---
  socket.on('room:spectate', async ({ roomId }) => {
    const room = gameRooms.get(roomId);
    if (!room) return socket.emit('room:error', { error: 'Room not found' });
    if (!room.settings.allowSpectators) return socket.emit('room:error', { error: 'Spectators not allowed' });
    if (room.players.some(p => p.userId === socket.userId)) return; // Already a player

    if (!room.spectators.some(s => s.userId === socket.userId)) {
      room.spectators.push({ userId: socket.userId, username: socket.username });
    }

    setPhase(socket.userId, 'spectating', { spectatingRoomId: room.id, spectatingGameId: room.gameId || null });
    socket.join(`room:${room.id}`);
    socket.join(`chat:room:${room.id}`);

    // If game is active, join the game room too so spectator sees moves
    if (room.gameId) {
      const { activeGames } = await import('./gameHandler.js');
      const gameRoom = activeGames.get(room.gameId);
      if (gameRoom) {
        socket.join(`game:${room.gameId}`);
        socket.join(`chat:game:${room.gameId}`);
        // Send current game state to spectator
        socket.emit('game:sync', gameRoom.getState());
      }
    }

    socket.emit('room:joined', { room: sanitizeRoom(room), spectating: true });
    broadcastRoomUpdate(io, room);
  });

  // --- Kick player (host only) ---
  socket.on('room:kick', ({ roomId, userId }) => {
    const room = gameRooms.get(roomId);
    if (!room || room.hostId !== socket.userId) return;
    if (userId === socket.userId) return;
    console.log(`[Room] Kick: ${socket.username} kicked userId=${userId} from room #${room.id}`);

    room.players = room.players.filter(p => p.userId !== userId);
    room.spectators = room.spectators.filter(s => s.userId !== userId);

    // Notify kicked user
    forceIdle(userId);
    const kicked = connectedUsers.get(userId);
    if (kicked) {
      kicked.socket.leave(`room:${room.id}`);
      kicked.socket.emit('room:kicked', { roomId });
      emitSyncState(kicked.socket, userId);
    }

    broadcastRoomUpdate(io, room);
  });

  // --- Cleanup on disconnect ---
  // Disconnect timers are handled centrally by userState.
  // Here we only handle spectator removal and marking players offline.
  socket.on('disconnect', () => {
    for (const [roomId, room] of gameRooms) {
      // Remove spectators immediately on disconnect
      const wasSpectator = room.spectators.some(s => s.userId === socket.userId);
      if (wasSpectator) {
        room.spectators = room.spectators.filter(s => s.userId !== socket.userId);
        broadcastRoomUpdate(io, room);
      }
      if (room.status === 'playing') continue;
      const player = room.players.find(p => p.userId === socket.userId);
      if (player) {
        console.log(`[Room] Disconnect: ${socket.username} (${socket.userId}) from room #${roomId}, marking offline`);
        player.online = false;
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

  // Emit sync:state to both players (they are now in-game)
  const redConn = connectedUsers.get(redUserId);
  const blackConn = connectedUsers.get(blackUserId);
  if (redConn) emitSyncState(redConn.socket, redUserId);
  if (blackConn) emitSyncState(blackConn.socket, blackUserId);

  broadcastRoomUpdate(io, room);
}
