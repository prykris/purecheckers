import { connectedUsers } from './index.js';

// status: 'online' | 'in-game'
const userStatus = new Map();

export function setUserStatus(userId, status) {
  userStatus.set(userId, status);
}

export function getUserStatus(userId) {
  if (!connectedUsers.has(userId)) return 'offline';
  return userStatus.get(userId) || 'online';
}

export function setupPresence(io, socket) {
  setUserStatus(socket.userId, 'online');

  // Broadcast presence to all connected users (friends-only filtering in Phase 6)
  io.emit('presence:update', {
    userId: socket.userId,
    username: socket.username,
    status: 'online'
  });

  socket.on('disconnect', () => {
    userStatus.delete(socket.userId);
    io.emit('presence:update', {
      userId: socket.userId,
      username: socket.username,
      status: 'offline'
    });
  });
}
