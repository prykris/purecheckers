import { Prisma } from '@prisma/client';
import prisma from '../db.js';

// All aggregates and personal claims describe one committed database snapshot.
// Reading an empty treasury must not create or lock the shared vault row.
export function readTreasury(userId = null, db = prisma) {
  return db.$transaction(async tx => {
    const vault = await tx.systemVault.findUnique({ where: { id: 1 } });
    const balance = vault?.balance ?? 0;
    const users = await tx.user.aggregate({ _sum: { coins: true }, _count: true });
    const reservations = await tx.gameRun.aggregate({ where: { status: 'OPEN' }, _sum: { buyIn: true } });
    const legacyBurn = await tx.coinTransaction.aggregate({ where: { reason: 'PURCHASE_BURN' }, _sum: { amount: true } });
    const purchases = await tx.walletOperation.aggregate({ _sum: { burned: true } });
    const owed = await tx.pendingPayout.aggregate({ where: { claimedAt: null }, _sum: { amount: true }, _count: true });
    const tax = await tx.vaultLog.aggregate({ where: { direction: 'in', reason: 'Ranked tax' }, _sum: { amount: true } });
    const bounties = await tx.vaultLog.aggregate({ where: { direction: 'out', reason: { in: ['Daily bounty', 'Pending: DAILY_BOUNTY'] } }, _sum: { amount: true } });
    const achievements = await tx.vaultLog.aggregate({ where: { direction: 'out', reason: { in: ['Achievement', 'Pending: ACHIEVEMENT'] } }, _sum: { amount: true } });
    const gamesPlayed = await tx.game.count();
    const logs = await tx.vaultLog.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 30 });
    const spendable = users._sum.coins ?? 0;
    // Creation debits two stakes atomically with OPEN; settlement/refund closes
    // that run atomically with payment. Include these coins while they are held.
    const reserved = (reservations._sum.buyIn ?? 0) * 2;
    const circulation = spendable + reserved;
    // Historical burn entries were metadata; newer receipts hold the allocation.
    const burned = Math.abs(legacyBurn._sum.amount ?? 0) + (purchases._sum.burned ?? 0);
    const pendingOwed = owed._sum.amount ?? 0;
    const grandTotal = circulation + balance + burned;
    const percent = amount => grandTotal > 0 ? Math.round(amount / grandTotal * 10000) / 100 : 0;
    const view = {
      vault: { balance, pendingOwed, pendingCount: owed._count, available: Math.max(0, balance - pendingOwed), percentOfTotal: percent(balance) },
      circulation: { total: circulation, spendable, reserved, percentOfTotal: percent(circulation) },
      burned: { total: burned, percentOfTotal: percent(burned) },
      economy: { grandTotal, totalPlayers: users._count, gamesPlayed,
        totalTaxCollected: tax._sum.amount ?? 0, totalBountiesPaid: bounties._sum.amount ?? 0, totalAchievementsPaid: achievements._sum.amount ?? 0 },
      logs
    };
    if (userId !== null) {
      const pending = await tx.pendingPayout.findMany({ where: { userId, claimedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      view.pending = pending.map(payout => ({ ...payout,
        // Pending rewards are liabilities, not reservations. The conditional
        // debit in claimPendingPayout remains the final arbiter under contention.
        canClaim: balance >= payout.amount,
        claimUnavailableReason: balance >= payout.amount ? null : 'Waiting for vault funds'
      }));
    }
    return view;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
