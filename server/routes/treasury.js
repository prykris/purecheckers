import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getVaultBalance, getVaultLogs, getPendingPayouts, claimPendingPayout } from '../services/vault.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/treasury — public economy dashboard
router.get('/', async (req, res) => {
  try {
    const vaultBalance = await getVaultBalance();

    // Total coins held by players
    const userAgg = await prisma.user.aggregate({ _sum: { coins: true }, _count: true });
    const totalCirculation = userAgg._sum.coins || 0;
    const totalPlayers = userAgg._count || 0;

    // Total burned
    const burnAgg = await prisma.coinTransaction.aggregate({
      where: { reason: 'PURCHASE_BURN' }, _sum: { amount: true }
    });
    const totalBurned = Math.abs(burnAgg._sum.amount || 0);

    // Pending payouts (vault owes to players)
    const pendingPayouts = await prisma.pendingPayout.findMany();
    const totalPendingAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const totalPendingCount = pendingPayouts.length;

    // Activity stats
    const taxAgg = await prisma.vaultLog.aggregate({
      where: { reason: 'Ranked tax' }, _sum: { amount: true }
    });
    const bountyAgg = await prisma.vaultLog.aggregate({
      where: { direction: 'out', reason: 'Daily bounty' }, _sum: { amount: true }
    });
    const achieveAgg = await prisma.vaultLog.aggregate({
      where: { direction: 'out', reason: 'Achievement' }, _sum: { amount: true }
    });
    const gamesPlayed = await prisma.game.count();

    const grandTotal = totalCirculation + vaultBalance + totalBurned;

    // Recent vault logs
    const recentLogs = await getVaultLogs(30);

    res.json({
      vault: {
        balance: vaultBalance,
        pendingOwed: totalPendingAmount,
        pendingCount: totalPendingCount,
        available: Math.max(0, vaultBalance - totalPendingAmount),
        percentOfTotal: grandTotal > 0 ? Math.round(vaultBalance / grandTotal * 10000) / 100 : 0
      },
      circulation: {
        total: totalCirculation,
        percentOfTotal: grandTotal > 0 ? Math.round(totalCirculation / grandTotal * 10000) / 100 : 0
      },
      burned: {
        total: totalBurned,
        percentOfTotal: grandTotal > 0 ? Math.round(totalBurned / grandTotal * 10000) / 100 : 0
      },
      economy: {
        grandTotal,
        totalPlayers,
        gamesPlayed,
        totalTaxCollected: taxAgg._sum.amount || 0,
        totalBountiesPaid: bountyAgg._sum.amount || 0,
        totalAchievementsPaid: achieveAgg._sum.amount || 0
      },
      logs: recentLogs
    });
  } catch (err) {
    console.error('Treasury error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/treasury/my-pending — user's pending payouts
router.get('/my-pending', verifyToken, async (req, res) => {
  try {
    const pending = await getPendingPayouts(req.userId);
    res.json({ pending });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/treasury/claim — claim a pending payout
router.post('/claim', verifyToken, async (req, res) => {
  try {
    const { payoutId } = req.body;
    if (!payoutId) return res.status(400).json({ error: 'payoutId required' });
    const result = await claimPendingPayout(payoutId, req.userId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ claimed: result.amount });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
