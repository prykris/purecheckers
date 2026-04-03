import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const players = await prisma.user.findMany({
      where: { gamesPlayed: { gt: 0 }, isGuest: false, isBot: false },
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

// GET /api/leaderboard/games — global game log (recent games by all players)
router.get('/games', async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        redPlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } },
      }
    });
    const log = games.map(g => ({
      id: g.id,
      redPlayer: g.redPlayer.username,
      blackPlayer: g.blackPlayer.username,
      result: g.result,
      mode: g.mode,
      date: g.startedAt,
    }));
    res.json({ games: log });
  } catch (err) {
    console.error('Game log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
