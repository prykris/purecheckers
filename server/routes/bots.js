import { Router } from 'express';
import prisma from '../db.js';
import { BOT_REGISTRY } from '../domain/botRegistry.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { verifyToken } from '../middleware/auth.js';
import { readBotStats } from '../services/botStats.js';

const router = Router();

router.get('/me/stats', createRateLimiter({ limit: 60, windowMs: 60_000 }), verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    res.json({ stats: await readBotStats(prisma, req.userId) });
  } catch (error) {
    console.error('Personal bot stats error:', error);
    res.status(500).json({ error: 'Could not load your bot stats. Please retry.' });
  }
});

// Public roster: presentation fields from the registry plus the real record of each bot
// account. Accounts are provisioned on first play, so a missing row reads as zero games.
router.get('/', createRateLimiter({ limit: 60, windowMs: 60_000 }), async (req, res) => {
  try {
    const keys = Object.keys(BOT_REGISTRY);
    const accounts = await prisma.user.findMany({
      where: { botKey: { in: keys }, isBot: true },
      select: { botKey: true, elo: true, wins: true, losses: true, gamesPlayed: true }
    });
    const byKey = new Map(accounts.map(account => [account.botKey, account]));
    const bots = keys.map(key => {
      const definition = BOT_REGISTRY[key];
      const account = byKey.get(key);
      return {
        key,
        difficulty: key,
        displayName: definition.displayName,
        tagline: definition.tagline,
        avatar: definition.avatar,
        rating: account?.elo ?? definition.initialElo,
        wins: account?.wins ?? 0,
        losses: account?.losses ?? 0,
        gamesPlayed: account?.gamesPlayed ?? 0,
      };
    });
    res.json({ bots });
  } catch (err) {
    console.error('Bot roster error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
