import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { setupPresence, getStats as getPresenceStats, broadcastStats } from './presenceHandler.js';
import { setupGameHandler, activeGames } from './gameHandler.js';
import { setupChatHandler } from './chatHandler.js';
import { setupRoomHandler, gameRooms, broadcastRoomUpdate } from './roomHandler.js';
import {
  getSession, getOrCreateSession, forceIdle, handleDisconnect,
  handleReconnect, buildSyncPayload, setDisconnectCallbacks,
  setOnPhaseChange
} from './userState.js';

// Connected users: userId -> { socketId, socket, username }
// Still exported for backward compat during migration — will be removed in Phase 7
export const connectedUsers = new Map();

// Re-export for other modules to build sync payloads
export function emitSyncState(socket, userId) {
  const payload = buildSyncPayload(userId, { gameRooms, activeGames, connectedUsers, getPresenceStats });
  socket.emit('sync:state', payload);
}

export function setupSocket(io) {
  // Broadcast presence stats on every phase change
  setOnPhaseChange(() => broadcastStats(io));

  // Register disconnect timeout callbacks
  setDisconnectCallbacks({
    onGameTimeout: (userId, gameId, ioRef) => {
      const gameRoom = activeGames.get(gameId);
      if (!gameRoom || gameRoom.game.gameOver) return;
      const color = gameRoom.getPlayerColor(userId);
      if (!color) return;
      const winner = color === 'red' ? 'black' : 'red';
      gameRoom.game.gameOver = true;
      gameRoom.game.winner = winner;
      gameRoom.endGame(ioRef, winner);
    },
    onRoomTimeout: (userId, roomId, ioRef) => {
      const room = gameRooms.get(roomId);
      if (!room) return;
      const session = getSession(userId);
      const username = session?.username || 'Unknown';
      console.log(`[Room] Timeout: ${username} (${userId}) removed from room #${roomId}`);
      forceIdle(userId);
      room.players = room.players.filter(p => p.userId !== userId);
      if (room.players.length === 0) {
        console.log(`[Room] Timeout destroy: room #${roomId} (empty)`);
        gameRooms.delete(roomId);
        ioRef.emit('room:updated', { room: { id: roomId }, closed: true });
        ioRef.emit('room:list-update', { room: { id: roomId, closed: true } });
      } else {
        if (room.hostId === userId) {
          room.hostId = room.players[0].userId;
          room.hostName = room.players[0].username;
        }
        room.players.forEach(p => p.ready = false);
        broadcastRoomUpdate(ioRef, room);
      }
    }
  });

  // Authenticate sockets via JWT — unified for guests and registered users
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.userId = payload.userId;
      socket.username = payload.username;
      socket.isGuest = !!payload.isGuest;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // --- UserState session ---
    const session = getOrCreateSession(socket.userId, socket.username, socket.isGuest);

    // Kick existing session for same user (one session per user)
    const existing = connectedUsers.get(socket.userId);
    if (existing && existing.socketId !== socket.id) {
      existing.socket.emit('session:kicked', { reason: 'Logged in from another device' });
      existing.socket.disconnect(true);
    }

    // Update connectedUsers (legacy) and session
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      socket,
      username: socket.username
    });
    handleReconnect(socket.userId, socket);

    // Set up handlers — their reconnect logic syncs session phase
    setupPresence(io, socket);
    setupGameHandler(io, socket);
    setupChatHandler(io, socket);
    setupRoomHandler(io, socket);

    // --- Rejoin socket.io rooms based on (now-synced) session phase ---
    rejoinSocketRooms(socket, session);

    // --- Emit sync:state ---
    emitSyncState(socket, socket.userId);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username}`);
      // Only delete from legacy map if this socket is still the active one
      const current = connectedUsers.get(socket.userId);
      if (current && current.socketId === socket.id) {
        connectedUsers.delete(socket.userId);
      }
      // Mark session as disconnected, start phase-appropriate timer
      handleDisconnect(socket.userId, io);
    });
  });
}

/**
 * Rejoin socket.io rooms based on the user's current phase.
 * This ensures the socket receives broadcasts for rooms/games it belongs to.
 */
function rejoinSocketRooms(socket, session) {
  switch (session.phase) {
    case 'in-room': {
      if (session.roomId) {
        socket.join(`room:${session.roomId}`);
        socket.join(`chat:room:${session.roomId}`);
      }
      break;
    }
    case 'in-game': {
      if (session.gameId) {
        socket.join(`game:${session.gameId}`);
        socket.join(`chat:game:${session.gameId}`);
      }
      break;
    }
    case 'spectating': {
      if (session.spectatingRoomId) {
        socket.join(`room:${session.spectatingRoomId}`);
        socket.join(`chat:room:${session.spectatingRoomId}`);
      }
      if (session.spectatingGameId) {
        socket.join(`game:${session.spectatingGameId}`);
        socket.join(`chat:game:${session.spectatingGameId}`);
      }
      break;
    }
  }
}
