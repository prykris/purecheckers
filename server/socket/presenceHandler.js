/**
 * Presence — derived entirely from userState sessions.
 * No separate Maps, no manual status tracking.
 */
import { getAllSessions } from '../domain/sessions.js';

export function getStats() {
  const sessions = getAllSessions();
  let online = 0;
  let lookingToPlay = 0;

  for (const session of sessions.values()) {
    if (session.connectionId) {
      online++;
      if (session.phase === 'matchmaking' || session.phase === 'in-room') {
        lookingToPlay++;
      }
    }
  }
  return { online, lookingToPlay };
}

export function broadcastStats(io) {
  io.emit('presence:stats', getStats());
}

let statsInterval = null;

export function setupPresence(io, socket) {
  // Broadcast presence update to all
  io.emit('presence:update', {
    userId: socket.userId,
    username: socket.username,
    status: 'online'
  });

  // Start periodic stats broadcast (once) as a safety net
  if (!statsInterval) {
    statsInterval = setInterval(() => broadcastStats(io), 10000);
    statsInterval.unref?.();
    io.engine.on('close', () => { clearInterval(statsInterval); statsInterval = null; });
  }

  // Broadcast on connect
  broadcastStats(io);

  socket.on('disconnect', () => {
    if (getAllSessions().get(socket.userId)?.connectionId !== socket.id) return;
    io.emit('presence:update', {
      userId: socket.userId,
      username: socket.username,
      status: 'offline'
    });
    broadcastStats(io);
  });
}
