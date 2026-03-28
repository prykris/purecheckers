import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { setupPresence } from './presenceHandler.js';
import { setupGameHandler } from './gameHandler.js';

// Connected users: userId -> { socketId, socket, username }
export const connectedUsers = new Map();

export function setupSocket(io) {
  // Authenticate sockets via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.userId = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      socket,
      username: socket.username
    });

    setupPresence(io, socket);
    setupGameHandler(io, socket);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username}`);
      connectedUsers.delete(socket.userId);
    });
  });
}
