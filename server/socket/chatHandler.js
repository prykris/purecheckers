import { PrismaClient } from '@prisma/client';
import { connectedUsers } from './index.js';

const prisma = new PrismaClient();

const globalChatRateLimit = new Map(); // userId -> lastMessageTime

export function setupChatHandler(io, socket) {
  // Global chat message
  socket.on('chat:global', async ({ content }) => {
    if (!content || content.length > 300) return;
    const now = Date.now();
    const last = globalChatRateLimit.get(socket.userId) || 0;
    if (now - last < 3000) return; // 3s rate limit
    globalChatRateLimit.set(socket.userId, now);

    const sanitized = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    try {
      await prisma.chatMessage.create({
        data: { senderId: socket.userId, content: sanitized }
      });
    } catch { /* non-critical */ }

    io.emit('chat:global', {
      senderId: socket.userId,
      username: socket.username,
      content: sanitized,
      timestamp: now
    });
  });

  // Load recent global messages on request
  socket.on('chat:global-history', async () => {
    try {
      const messages = await prisma.chatMessage.findMany({
        where: { gameId: null, receiverId: null },
        include: { sender: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      socket.emit('chat:global-history', { messages: messages.reverse() });
    } catch {}
  });

  // In-game chat message
  socket.on('chat:game-message', async ({ gameId, content }) => {
    if (!content || content.length > 500) return;
    const sanitized = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    try {
      await prisma.chatMessage.create({
        data: { senderId: socket.userId, gameId, content: sanitized }
      });
    } catch { /* non-critical */ }

    io.to(`game:${gameId}`).emit('chat:game-message', {
      senderId: socket.userId,
      username: socket.username,
      content: sanitized,
      timestamp: Date.now()
    });
  });

  // Direct message to a friend
  socket.on('chat:dm', async ({ receiverId, content }) => {
    if (!content || content.length > 500 || !receiverId) return;
    const sanitized = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Verify friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: socket.userId, receiverId },
          { requesterId: receiverId, receiverId: socket.userId }
        ]
      }
    });
    if (!friendship) return;

    try {
      await prisma.chatMessage.create({
        data: { senderId: socket.userId, receiverId, content: sanitized }
      });
    } catch { /* non-critical */ }

    // Send to recipient if online
    const recipient = connectedUsers.get(receiverId);
    if (recipient) {
      recipient.socket.emit('chat:dm', {
        senderId: socket.userId,
        username: socket.username,
        content: sanitized,
        timestamp: Date.now()
      });
    }

    // Echo back to sender for confirmation
    socket.emit('chat:dm', {
      senderId: socket.userId,
      username: socket.username,
      content: sanitized,
      timestamp: Date.now(),
      receiverId
    });
  });

  // Fetch chat history
  socket.on('chat:history', async ({ type, targetId, before }) => {
    try {
      const where = {};
      if (type === 'game') {
        where.gameId = targetId;
      } else if (type === 'dm') {
        where.OR = [
          { senderId: socket.userId, receiverId: targetId },
          { senderId: targetId, receiverId: socket.userId }
        ];
      }
      if (before) where.createdAt = { lt: new Date(before) };

      const messages = await prisma.chatMessage.findMany({
        where,
        include: { sender: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      socket.emit('chat:history', { messages: messages.reverse() });
    } catch (err) {
      console.error('Chat history error:', err);
    }
  });
}
