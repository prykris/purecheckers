import { connectedUsers } from './index.js';
import { rankedQueue } from '../services/matchmaking.js';
import { gameRooms } from './roomHandler.js';

// status: 'online' | 'in-game'
const userStatus = new Map();

export function setUserStatus(userId, status) {
  userStatus.set(userId, status);
}

export function getUserStatus(userId) {
  if (!connectedUsers.has(userId)) return 'offline';
  return userStatus.get(userId) || 'online';
}

function getStats() {
  let lookingToPlay = rankedQueue.size();
  for (const room of gameRooms.values()) {
    if (room.status === 'waiting') {
      lookingToPlay += room.players.filter(p => p.online !== false).length;
    }
  }
  return { online: connectedUsers.size, lookingToPlay };
}

export function broadcastStats(io) {
  io.emit('presence:stats', getStats());
}

let statsInterval = null;

export function setupPresence(io, socket) {
  setUserStatus(socket.userId, 'online');

  // Broadcast presence to all connected users (friends-only filtering in Phase 6)
  io.emit('presence:update', {
    userId: socket.userId,
    username: socket.username,
    status: 'online'
  });

  // Send stats to the newly connected user immediately
  socket.emit('presence:stats', getStats());

  // Start periodic stats broadcast (once)
  if (!statsInterval) {
    statsInterval = setInterval(() => broadcastStats(io), 10000);
  }

  // Broadcast updated stats on connect/disconnect
  broadcastStats(io);

  socket.on('disconnect', () => {
    userStatus.delete(socket.userId);
    io.emit('presence:update', {
      userId: socket.userId,
      username: socket.username,
      status: 'offline'
    });
    broadcastStats(io);
  });
}
