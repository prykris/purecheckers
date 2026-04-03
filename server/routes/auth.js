import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.js';
import { verifyToken } from '../middleware/auth.js';
import { STARTER_COINS, ELO_START } from '../../shared/constants.js';

const router = Router();
const prisma = new PrismaClient();

export function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function signToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, isGuest: user.isGuest || false },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (username.length < 2 || username.length > 16) {
      return res.status(400).json({ error: 'Username must be 2-16 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] }
    });
    if (existing) {
      return res.status(409).json({
        error: existing.username === username ? 'Username taken' : 'Email already registered'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const friendCode = generateFriendCode();

    const user = await prisma.user.create({
      data: { username, email, passwordHash, friendCode, coins: STARTER_COINS, peakElo: ELO_START }
    });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isGuest) {
      return res.status(400).json({ error: 'This is a guest account. Create a password first.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me — works for both guests and registered users
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        inventory: {
          where: { equipped: true },
          include: { item: true }
        }
      }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/history — works for both guests and registered users
router.get('/history', verifyToken, async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { OR: [{ redPlayerId: req.userId }, { blackPlayerId: req.userId }] },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: {
        redPlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } },
      }
    });
    const history = games.map(g => {
      const isRed = g.redPlayerId === req.userId;
      const opponent = isRed ? g.blackPlayer : g.redPlayer;
      const eloChange = isRed ? g.redEloChange : g.blackEloChange;
      const coinsEarned = isRed ? g.redCoinsEarned : g.blackCoinsEarned;
      const won = g.winnerId === req.userId;
      const draw = g.result === 'DRAW';
      return {
        id: g.id,
        opponent: opponent.username,
        myColor: isRed ? 'red' : 'black',
        result: draw ? 'draw' : won ? 'win' : 'loss',
        eloChange,
        coinsEarned,
        mode: g.mode,
        date: g.startedAt,
      };
    });
    res.json({ games: history });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/upgrade — convert guest to registered account (in-place update)
router.post('/upgrade', verifyToken, async (req, res) => {
  if (!req.isGuest) return res.status(400).json({ error: 'Already a registered user' });

  const { email, password, username } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const name = (username?.trim() || req.username).slice(0, 20);
  if (name.length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters' });

  try {
    // Check conflicts (exclude the current user's own row)
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username: name }],
        NOT: { id: req.userId }
      }
    });
    if (existing) {
      const field = existing.email === email ? 'Email' : 'Username';
      return res.status(409).json({ error: `${field} already taken` });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Update in-place — preserves game history, ELO, stats
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        username: name,
        email,
        passwordHash,
        isGuest: false,
        guestExpiresAt: null,
        coins: { increment: STARTER_COINS },
      }
    });

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Upgrade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Export for testing
export { prisma };
