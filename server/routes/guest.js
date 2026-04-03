import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JWT_SECRET } from '../config.js';
import { generateFriendCode } from './auth.js';

const router = Router();
const prisma = new PrismaClient();

const ADJECTIVES = [
  'Swift', 'Bold', 'Clever', 'Mighty', 'Silent', 'Lucky', 'Fierce',
  'Brave', 'Sharp', 'Quick', 'Sly', 'Noble', 'Wild', 'Calm', 'Keen'
];
const NOUNS = [
  'Rook', 'King', 'Pawn', 'Knight', 'Bishop', 'Crown', 'Checker',
  'Tiger', 'Eagle', 'Wolf', 'Fox', 'Hawk', 'Bear', 'Lion', 'Owl'
];

function generateGuestName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj} ${noun} ${num}`;
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// POST /api/guest — create a guest account (real User row)
router.post('/', async (req, res) => {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let username = req.body.username?.trim();
      if (!username || username.length < 2) {
        username = generateGuestName();
      }
      if (username.length > 20) username = username.slice(0, 20);

      // On retry, add more randomness to avoid collision
      if (attempt > 0) {
        username = `${username.split(' ').slice(0, 2).join(' ')} ${Math.floor(Math.random() * 10000)}`;
      }

      const friendCode = generateFriendCode();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      const user = await prisma.user.create({
        data: {
          username,
          isGuest: true,
          guestExpiresAt: expiresAt,
          friendCode,
          coins: 0,
          peakElo: 1000,
        }
      });

      const token = jwt.sign(
        { userId: user.id, username: user.username, isGuest: true },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(201).json({ token, user: sanitizeUser(user) });
    } catch (err) {
      // Unique constraint violation on username or friendCode — retry
      if (err.code === 'P2002') continue;
      console.error('Guest error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // All retries exhausted
  res.status(409).json({ error: 'Username taken. Try a different name.' });
});

// GET /api/guest/name — just generate a name (no session)
router.get('/name', (req, res) => {
  res.json({ name: generateGuestName() });
});

export default router;
