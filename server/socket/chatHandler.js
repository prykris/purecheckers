import { PrismaClient } from '@prisma/client';
import { connectedUsers } from './index.js';

const prisma = new PrismaClient();

export function setupChatHandler(io, socket) {
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
