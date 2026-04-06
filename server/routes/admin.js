import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Middleware: require admin
async function requireAdmin(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// POST /api/admin/give-coins — add coins to a user
router.post('/give-coins', verifyToken, requireAdmin, async (req, res) => {
  const { userId, amount } = req.body;
  const targetId = userId || req.userId;
  const coins = Math.floor(Number(amount) || 0);
  if (coins === 0) return res.status(400).json({ error: 'Invalid amount' });

  try {
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { coins: { increment: coins } },
      select: { id: true, username: true, coins: true }
    });
    res.json({ user });
  } catch (err) {
    res.status(404).json({ error: 'User not found' });
  }
});

// POST /api/admin/set-elo — set a user's ELO
router.post('/set-elo', verifyToken, requireAdmin, async (req, res) => {
  const { userId, elo } = req.body;
  const targetId = userId || req.userId;
  const newElo = Math.floor(Number(elo) || 1000);

  try {
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { elo: newElo, peakElo: Math.max(newElo, 0) },
      select: { id: true, username: true, elo: true, peakElo: true }
    });
    res.json({ user });
  } catch (err) {
    res.status(404).json({ error: 'User not found' });
  }
});

// POST /api/admin/reset-stats — reset wins/losses/gamesPlayed
router.post('/reset-stats', verifyToken, requireAdmin, async (req, res) => {
  const { userId } = req.body;
  const targetId = userId || req.userId;

  try {
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { wins: 0, losses: 0, gamesPlayed: 0, elo: 1000, peakElo: 1000 },
      select: { id: true, username: true, elo: true, wins: true, losses: true, gamesPlayed: true }
    });
    res.json({ user });
  } catch (err) {
    res.status(404).json({ error: 'User not found' });
  }
});

// POST /api/admin/set-admin — grant/revoke admin (self-use or for another user)
router.post('/set-admin', verifyToken, requireAdmin, async (req, res) => {
  const { userId, isAdmin } = req.body;
  const targetId = userId || req.userId;

  try {
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { isAdmin: !!isAdmin },
      select: { id: true, username: true, isAdmin: true }
    });
    res.json({ user });
  } catch (err) {
    res.status(404).json({ error: 'User not found' });
  }
});

export default router;
