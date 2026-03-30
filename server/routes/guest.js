import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JWT_SECRET } from '../config.js';

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

// POST /api/guest — create a guest session
router.post('/', async (req, res) => {
  try {
    let username = req.body.username?.trim();
    if (!username || username.length < 2) {
      username = generateGuestName();
    }
    if (username.length > 20) username = username.slice(0, 20);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const token = jwt.sign(
      { guestId: true, username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const session = await prisma.guestSession.create({
      data: { username, token, expiresAt }
    });

    res.status(201).json({
      token,
      guest: {
        id: session.id,
        username: session.username,
        isGuest: true
      },
      suggestedName: generateGuestName() // in case they want a different one
    });
  } catch (err) {
    console.error('Guest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/guest/name — just generate a name (no session)
router.get('/name', (req, res) => {
  res.json({ name: generateGuestName() });
});

export default router;
