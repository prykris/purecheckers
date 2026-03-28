import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/shop/items
router.get('/items', async (req, res) => {
  try {
    const items = await prisma.shopItem.findMany({
      orderBy: { price: 'asc' }
    });
    res.json({ items });
  } catch (err) {
    console.error('Shop items error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shop/purchase
router.post('/purchase', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: 'itemId required' });

    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Check if already owned
    const existing = await prisma.inventory.findUnique({
      where: { userId_itemId: { userId: req.userId, itemId } }
    });
    if (existing) return res.status(409).json({ error: 'Already owned' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user.coins < item.price) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Atomic: deduct coins + create inventory + log transaction
    const [updatedUser, inventory] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.userId },
        data: { coins: { decrement: item.price } }
      }),
      prisma.inventory.create({
        data: { userId: req.userId, itemId }
      }),
      prisma.coinTransaction.create({
        data: {
          receiverId: req.userId,
          amount: -item.price,
          reason: 'PURCHASE'
        }
      })
    ]);

    res.json({ coins: updatedUser.coins, inventory });
  } catch (err) {
    console.error('Purchase error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shop/inventory
router.get('/inventory', verifyToken, async (req, res) => {
  try {
    const inventory = await prisma.inventory.findMany({
      where: { userId: req.userId },
      include: { item: true }
    });
    res.json({ inventory });
  } catch (err) {
    console.error('Inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/shop/equip
router.patch('/equip', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: 'itemId required' });

    // Verify ownership
    const inv = await prisma.inventory.findUnique({
      where: { userId_itemId: { userId: req.userId, itemId } },
      include: { item: true }
    });
    if (!inv) return res.status(404).json({ error: 'Item not owned' });

    // Unequip all items of same type, then equip this one
    await prisma.$transaction([
      prisma.inventory.updateMany({
        where: {
          userId: req.userId,
          item: { type: inv.item.type },
          equipped: true
        },
        data: { equipped: false }
      }),
      prisma.inventory.update({
        where: { id: inv.id },
        data: { equipped: true }
      })
    ]);

    res.json({ equipped: true });
  } catch (err) {
    console.error('Equip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
