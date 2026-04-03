import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';
import { getSession } from '../socket/userState.js';

function getUserStatus(userId) {
  const session = getSession(userId);
  if (!session || !session.socket) return 'offline';
  if (session.phase === 'in-game') return 'in-game';
  return 'online';
}

const router = Router();
const prisma = new PrismaClient();

// GET /api/friends — list accepted friends with online status
router.get('/', verifyToken, async (req, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: req.userId },
          { receiverId: req.userId }
        ]
      },
      include: {
        requester: { select: { id: true, username: true, elo: true, friendCode: true } },
        receiver: { select: { id: true, username: true, elo: true, friendCode: true } }
      }
    });

    const friends = friendships.map(f => {
      const friend = f.requesterId === req.userId ? f.receiver : f.requester;
      return {
        friendshipId: f.id,
        ...friend,
        status: getUserStatus(friend.id)
      };
    });

    res.json({ friends });
  } catch (err) {
    console.error('Friends list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/friends/pending — list pending requests received
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const requests = await prisma.friendship.findMany({
      where: { receiverId: req.userId, status: 'PENDING' },
      include: {
        requester: { select: { id: true, username: true, elo: true } }
      }
    });
    res.json({ requests });
  } catch (err) {
    console.error('Pending requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/friends/request — send request by friend code
router.post('/request', verifyToken, async (req, res) => {
  try {
    const { friendCode } = req.body;
    if (!friendCode) return res.status(400).json({ error: 'friendCode required' });

    const target = await prisma.user.findUnique({ where: { friendCode } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.userId) return res.status(400).json({ error: 'Cannot friend yourself' });

    // Check if friendship already exists in either direction
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: req.userId, receiverId: target.id },
          { requesterId: target.id, receiverId: req.userId }
        ]
      }
    });
    if (existing) {
      if (existing.status === 'ACCEPTED') return res.status(409).json({ error: 'Already friends' });
      if (existing.status === 'PENDING') return res.status(409).json({ error: 'Request already pending' });
      if (existing.status === 'BLOCKED') return res.status(403).json({ error: 'Cannot send request' });
    }

    const friendship = await prisma.friendship.create({
      data: { requesterId: req.userId, receiverId: target.id }
    });

    res.status(201).json({ friendship });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/friends/accept — accept a pending request
router.post('/accept', verifyToken, async (req, res) => {
  try {
    const { friendshipId } = req.body;
    if (!friendshipId) return res.status(400).json({ error: 'friendshipId required' });

    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) return res.status(404).json({ error: 'Request not found' });
    if (friendship.receiverId !== req.userId) return res.status(403).json({ error: 'Not your request' });
    if (friendship.status !== 'PENDING') return res.status(400).json({ error: 'Not a pending request' });

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' }
    });

    res.json({ friendship: updated });
  } catch (err) {
    console.error('Accept friend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/friends/:id — remove friendship
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const friendship = await prisma.friendship.findUnique({ where: { id } });
    if (!friendship) return res.status(404).json({ error: 'Friendship not found' });
    if (friendship.requesterId !== req.userId && friendship.receiverId !== req.userId) {
      return res.status(403).json({ error: 'Not your friendship' });
    }

    await prisma.friendship.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error('Delete friend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
