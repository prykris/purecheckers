import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { setupPresence } from './presenceHandler.js';
import { setupGameHandler } from './gameHandler.js';
import { setupChatHandler } from './chatHandler.js';
import { setupRoomHandler } from './roomHandler.js';

// Connected users: userId -> { socketId, socket, username }
export const connectedUsers = new Map();

export function setupSocket(io) {
  // Authenticate sockets via JWT (supports both users and guests)
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.guestId) {
        // Guest: deterministic negative ID from token hash (stable across reconnects)
        let hash = 0;
        for (let i = 0; i < token.length; i++) hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
        socket.userId = -Math.abs(hash || 1);
        socket.username = payload.username;
        socket.isGuest = true;
      } else {
        socket.userId = payload.userId;
        socket.username = payload.username;
        socket.isGuest = false;
      }
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Kick existing session for same user (one session per user)
    const existing = connectedUsers.get(socket.userId);
    if (existing && !socket.isGuest) {
      existing.socket.emit('session:kicked', { reason: 'Logged in from another device' });
      existing.socket.disconnect(true);
    }

    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      socket,
      username: socket.username
    });

    setupPresence(io, socket);
    setupGameHandler(io, socket);
    setupChatHandler(io, socket);
    setupRoomHandler(io, socket);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username}`);
      // Only delete if this socket is still the active one (not replaced by a new session)
      const current = connectedUsers.get(socket.userId);
      if (current && current.socketId === socket.id) {
        connectedUsers.delete(socket.userId);
      }
    });
  });
}
