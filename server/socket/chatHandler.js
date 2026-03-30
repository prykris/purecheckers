import { PrismaClient } from '@prisma/client';
import { connectedUsers } from './index.js';

const prisma = new PrismaClient();

// Rate limit per user per channel: channelId:userId -> lastSendTime
const rateLimits = new Map();
const RATE_LIMIT_MS = 1000; // 1 message per second per channel

/**
 * Validate that a user can access a channel.
 * Returns true if allowed, false if not.
 */
function canAccessChannel(channelId, socket) {
  if (channelId === 'global') return true;

  const [type, id] = channelId.split(':');
  const numId = parseInt(id);
  if (!numId) return false;

  if (type === 'room') {
    // Must be imported dynamically to avoid circular dependency
    // Check if user is in this room's socket.io room
    const rooms = socket.rooms;
    return rooms.has(`room:${numId}`);
  }

  if (type === 'game') {
    const rooms = socket.rooms;
    return rooms.has(`game:${numId}`);
  }

  return false;
}

export function setupChatHandler(io, socket) {

  // Auto-join the global chat channel
  socket.join('chat:global');

  // ---- Send message to any channel ----
  socket.on('chat:send', async ({ channelId, content }) => {
    if (!channelId || !content || content.length > 300) return;
    const sanitized = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Rate limit
    const rlKey = `${channelId}:${socket.userId}`;
    const now = Date.now();
    if ((rateLimits.get(rlKey) || 0) + RATE_LIMIT_MS > now) return;
    rateLimits.set(rlKey, now);

    // Access control
    if (!canAccessChannel(channelId, socket)) return;

    // Persist
    let msg;
    try {
      msg = await prisma.chatMessage.create({
        data: {
          channelId,
          senderId: socket.userId,
          username: socket.username,
          content: sanitized
        }
      });
    } catch { return; }

    // Broadcast to the channel's socket room
    const socketRoom = `chat:${channelId}`;
    io.to(socketRoom).emit('chat:message', {
      id: msg.id,
      channelId,
      senderId: socket.userId,
      username: socket.username,
      content: sanitized,
      createdAt: msg.createdAt
    });
  });

  // ---- Fetch history for a channel ----
  socket.on('chat:history', async ({ channelId, afterId }) => {
    if (!channelId) return;
    if (!canAccessChannel(channelId, socket)) return;

    try {
      const where = { channelId };
      if (afterId) where.id = { gt: afterId };

      const messages = await prisma.chatMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      socket.emit('chat:history', {
        channelId,
        messages: messages.reverse()
      });
    } catch {}
  });

  // ---- Join a chat channel (called when entering a room/game) ----
  socket.on('chat:join', ({ channelId }) => {
    if (!channelId) return;
    if (!canAccessChannel(channelId, socket)) return;
    socket.join(`chat:${channelId}`);
  });

  // ---- Leave a chat channel ----
  socket.on('chat:leave', ({ channelId }) => {
    if (!channelId) return;
    socket.leave(`chat:${channelId}`);
  });
}
