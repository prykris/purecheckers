import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// POST /api/coins/tip — tip a friend
router.post('/tip', verifyToken, async (req, res) => {
  try {
    const { receiverId, amount } = req.body;
    if (!receiverId || !amount) return res.status(400).json({ error: 'receiverId and amount required' });
    if (amount < 1) return res.status(400).json({ error: 'Minimum tip is 1 coin' });
    if (receiverId === req.userId) return res.status(400).json({ error: 'Cannot tip yourself' });

    // Check friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: req.userId, receiverId },
          { requesterId: receiverId, receiverId: req.userId }
        ]
      }
    });
    if (!friendship) return res.status(403).json({ error: 'Must be friends to tip' });

    // Check balance
    const sender = await prisma.user.findUnique({ where: { id: req.userId } });
    if (sender.coins < amount) return res.status(400).json({ error: 'Insufficient coins' });

    // Atomic transfer
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.userId },
        data: { coins: { decrement: amount } }
      }),
      prisma.user.update({
        where: { id: receiverId },
        data: { coins: { increment: amount } }
      }),
      prisma.coinTransaction.create({
        data: { senderId: req.userId, receiverId: req.userId, amount: -amount, reason: 'TIP_SENT' }
      }),
      prisma.coinTransaction.create({
        data: { senderId: req.userId, receiverId, amount, reason: 'TIP_RECEIVED' }
      })
    ]);

    const updatedSender = await prisma.user.findUnique({ where: { id: req.userId } });
    res.json({ coins: updatedSender.coins });
  } catch (err) {
    console.error('Tip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
