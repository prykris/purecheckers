import { Router } from 'express';
import prisma from '../db.js';
import { verifyToken } from '../middleware/auth.js';
import { EconomyError } from '../services/economy.js';
import { purchaseItem, equipItem } from '../services/walletActions.js';
import { readShop } from '../services/shop.js';
import { listAvailableEmotes } from '../services/emotes.js';
import { readAppearance } from '../services/appearance.js';

const router = Router();

router.get('/appearance', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await readAppearance(req.userId)); }
  catch (error) { console.error('Appearance read failed:', error.message); res.status(503).json({ error: 'Could not load your piece skin. Retry or select a skin in Shop.' }); }
});

router.get('/emotes', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ emotes: await listAvailableEmotes(req.userId) }); }
  catch (error) { console.error('Emote list unavailable:', error.message); res.status(503).json({ error: 'Could not load emotes. Please retry.' }); }
});

router.get('/', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await readShop(req.userId)); }
  catch (err) { console.error('Shop overview error:', err); res.status(500).json({ error: 'Could not load the shop. Please retry.' }); }
});

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
    res.json(await purchaseItem(req.userId, req.body));
  } catch (err) {
    if (err instanceof EconomyError) return res.status(err.status).json({ error: err.message });
    console.error('Purchase error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shop/inventory
router.get('/inventory', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
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
    res.json(await equipItem(req.userId, req.body));
  } catch (err) {
    if (err instanceof EconomyError) return res.status(err.status).json({ error: err.message });
    console.error('Equip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
