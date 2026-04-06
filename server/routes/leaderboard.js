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

// GET /api/leaderboard/player/:username — public player profile
router.get('/player/:username', async (req, res) => {
  try {
    const player = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true, username: true, elo: true, peakElo: true,
        wins: true, losses: true, gamesPlayed: true,
        isGuest: true, isBot: true, createdAt: true
      }
    });
    if (!player || player.isBot) return res.status(404).json({ error: 'Player not found' });

    const games = await prisma.game.findMany({
      where: { OR: [{ redPlayerId: player.id }, { blackPlayerId: player.id }] },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: {
        redPlayer: { select: { username: true } },
        blackPlayer: { select: { username: true } },
      }
    });

    const history = games.map(g => {
      const isRed = g.redPlayerId === player.id;
      return {
        id: g.id,
        opponent: isRed ? g.blackPlayer.username : g.redPlayer.username,
        myColor: isRed ? 'red' : 'black',
        result: g.result,
        mode: g.mode,
        date: g.startedAt,
      };
    });

    res.json({ player, games: history });
  } catch (err) {
    console.error('Player profile error:', err);
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

// GET /api/leaderboard/game/:id — single game data for replay
router.get('/game/:id', async (req, res) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        redPlayer: { select: { username: true } },
        blackPlayer: { select: { username: true } },
      }
    });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json({
      game: {
        id: game.id,
        redPlayer: game.redPlayer.username,
        blackPlayer: game.blackPlayer.username,
        result: game.result,
        mode: game.mode,
        moveHistory: game.moveHistory,
        date: game.startedAt,
      }
    });
  } catch (err) {
    console.error('Game replay error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
