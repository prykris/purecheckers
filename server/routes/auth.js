import { gameLogEntry } from '../services/gameLog.js';
import { gameParticipants } from '../services/publicGames.js';
import { Router } from 'express';
import { playerGameResult } from '../../shared/gameResult.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.js';
import { verifyToken } from '../middleware/auth.js';
import { applyIdentityChange } from '../domain/identity.js';
import { publicUsername } from '../services/publicName.js';
import { registerAccount, upgradeGuest, AccountError, assertActiveAccount, authorizeAccount } from '../services/accounts.js';
import { ELO_START, GUEST_LIFETIME_MS, GUEST_TOKEN_RENEW_MS } from '../../shared/constants.js';
import { updateProfilePrivacy } from '../services/profileSettings.js';
import { EconomyError } from '../services/economy.js';

const router = Router();

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
    { expiresIn: user.isGuest ? Math.floor(GUEST_LIFETIME_MS / 1000) : JWT_EXPIRES_IN }
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

    const user = await registerAccount({ username, email, passwordHash, friendCode, peakElo: ELO_START });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Username or email already taken' });
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
    assertActiveAccount(user);

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

// GET /api/auth/me — works for both guests and registered users.
// Renew aging tokens and replace obsolete identity claims after an upgrade/name
// change. The database account remains authoritative even with an older token.
router.get('/me', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    // One versioned User row. Inventory remains on its own shop endpoint.
    let user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const body = { user: sanitizeUser(user) };
    const renew = req.tokenExpiresAt !== null && req.tokenExpiresAt - Date.now() < GUEST_TOKEN_RENEW_MS;
    const identityChanged = req.tokenIdentity.isGuest !== !!user.isGuest || req.tokenIdentity.username !== user.username;
    if (renew || identityChanged) {
      const current = await authorizeAccount(user.id, new Date(), { renew: true });
      user = current;
      body.user = sanitizeUser(user);
      // Also repairs a conversion committed before live identity publication.
      if (identityChanged) applyIdentityChange(user);
      body.token = signToken(user);
    }
    res.json(body);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/profile', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json(await updateProfilePrivacy(req.userId, req.body));
  } catch (err) {
    if (err instanceof EconomyError) return res.status(err.status).json({ error: err.message });
    console.error('Privacy update failed:', err.message);
    res.status(503).json({ error: 'Could not confirm the privacy change. Refresh to check the current setting.' });
  }
});

// GET /api/auth/history — works for both guests and registered users
router.get('/history', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const games = await prisma.game.findMany({
      where: { OR: [{ redPlayerId: req.userId }, { blackPlayerId: req.userId }] },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: gameParticipants
    });
    const history = games.map(g => {
      const isRed = g.redPlayerId === req.userId;
      const opponent = isRed ? g.blackPlayer : g.redPlayer;
      const eloChange = isRed ? g.redEloChange : g.blackEloChange;
      const coinsEarned = isRed ? g.redCoinsEarned : g.blackCoinsEarned;
      return {
        ...gameLogEntry(g),
        resultCode: g.result,
        opponent: publicUsername(opponent.username),
        myColor: isRed ? 'red' : 'black',
        result: playerGameResult(g.result, isRed ? 'red' : 'black'),
        eloChange,
        coinsEarned,
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

    // The transaction rechecks guest status after hashing/lock waits. A stale
    // token or simultaneous request cannot award another starter grant.
    const user = await upgradeGuest(req.userId, { username: name, email, passwordHash });

    // The socket stays connected across an upgrade: refresh the live session's identity.
    applyIdentityChange(user);

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    if (err instanceof AccountError) return res.status(err.status).json({ error: err.message });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Username or email already taken' });
    console.error('Upgrade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Export for testing
export { prisma };
