import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const players = await prisma.user.findMany({
      where: { gamesPlayed: { gt: 0 } },
      select: {
        id: true,
        username: true,
        elo: true,
        wins: true,
        losses: true,
        gamesPlayed: true
      },
      orderBy: { elo: 'desc' },
      take: 50
    });
    res.json({ players });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
