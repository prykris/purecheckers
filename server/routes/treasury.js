import { Router } from 'express';
import { claimPendingPayout } from '../services/vault.js';
import { readTreasury } from '../services/treasury.js';
import { optionalToken, verifyToken } from '../middleware/auth.js';

const router = Router();

// Public totals and, when authenticated, only this account's pending rewards.
router.get('/', optionalToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.vary('Authorization');
  try { res.json(await readTreasury(req.userId ?? null)); }
  catch (err) {
    console.error('Treasury error:', err);
    res.status(500).json({ error: 'Could not load the treasury. Please retry.' });
  }
});

router.post('/claim', verifyToken, async (req, res) => {
  try {
    const payoutId = req.body?.payoutId;
    if (!Number.isSafeInteger(payoutId) || payoutId < 1) return res.status(400).json({ error: 'Valid payoutId required' });
    const result = await claimPendingPayout(payoutId, req.userId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ claimed: result.amount });
  } catch (err) {
    console.error('Treasury claim error:', err);
    res.status(500).json({ error: 'Could not confirm the claim. Retry the same reward.' });
  }
});

export default router;
