import { Router } from 'express';
import { EconomyError } from '../services/economy.js';
import { tipFriend } from '../services/walletActions.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// POST /api/coins/tip — tip a friend
router.post('/tip', verifyToken, async (req, res) => {
  try {
    res.json(await tipFriend(req.userId, req.body));
  } catch (err) {
    if (err instanceof EconomyError) return res.status(err.status).json({ error: err.message });
    console.error('Tip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
