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

    // Detect @username mentions and resolve to userIds
    const mentionRegex = /@(\w+)/g;
    const mentionUserIds = [];
    let match;
    while ((match = mentionRegex.exec(sanitized)) !== null) {
      const mentionedName = match[1].toLowerCase();
      for (const [userId, conn] of connectedUsers) {
        if (conn.username?.toLowerCase() === mentionedName) {
          mentionUserIds.push(userId);
          break;
        }
      }
    }

    // In-game chat rules: auto-mention opponent, strip player mentions from spectators
    if (channelId.startsWith('game:')) {
      const gameId = parseInt(channelId.split(':')[1]);
      try {
        const { activeGames } = await import('./gameHandler.js');
        const gameRoom = activeGames.get(gameId);
        if (gameRoom) {
          const isPlayer = gameRoom.getPlayerColor(socket.userId) !== null;
          if (isPlayer) {
            // Player messages auto-mention opponent
            const opponentId = gameRoom.getOpponentId(socket.userId);
            if (!mentionUserIds.includes(opponentId)) {
              mentionUserIds.push(opponentId);
            }
          } else {
            // Spectator: strip mentions targeting players
            const redId = gameRoom.redUserId;
            const blackId = gameRoom.blackUserId;
            for (let i = mentionUserIds.length - 1; i >= 0; i--) {
              if (mentionUserIds[i] === redId || mentionUserIds[i] === blackId) {
                mentionUserIds.splice(i, 1);
              }
            }
          }
        }
      } catch {}
    }

    // Check if sender is a spectator in a game channel
    let isSpectator = false;
    if (channelId.startsWith('game:')) {
      const gid = parseInt(channelId.split(':')[1]);
      try {
        const { activeGames } = await import('./gameHandler.js');
        const gr = activeGames.get(gid);
        if (gr && !gr.getPlayerColor(socket.userId)) isSpectator = true;
      } catch {}
    }

    // Broadcast to the channel's socket room
    const socketRoom = `chat:${channelId}`;
    io.to(socketRoom).emit('chat:message', {
      id: msg.id,
      channelId,
      senderId: socket.userId,
      username: socket.username,
      content: sanitized,
      createdAt: msg.createdAt,
      mentions: mentionUserIds,
      spectator: isSpectator
    });
  });

  // ---- Fetch history for a channel ----
  socket.on('chat:history', async ({ channelId, afterId, beforeId }) => {
    if (!channelId) return;
    if (!canAccessChannel(channelId, socket)) return;

    try {
      const where = { channelId };
      if (afterId) where.id = { gt: afterId };
      if (beforeId) where.id = { ...(where.id || {}), lt: beforeId };

      const messages = await prisma.chatMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      socket.emit('chat:history', {
        channelId,
        messages: messages.reverse(),
        prepend: !!beforeId
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
