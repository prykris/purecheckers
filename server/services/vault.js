import prisma from '../db.js';
import { awardCoins } from './coins.js';
import { assertCoinAmount, inEconomyTransaction, lockEconomyUsers } from './economy.js';
import {
  RANKED_TAX_RATE, SHOP_VAULT_RATE, DAILY_BOUNTY_AMOUNT, ELO_MILESTONES,
  MIN_WAGER_MOVES, MIN_WAGER_DURATION_MS
} from '../../shared/constants.js';

async function ensureVault(tx) {
  return tx.systemVault.upsert({ where: { id: 1 }, create: { id: 1, balance: 0 }, update: { balance: { increment: 0 } } });
}

export async function getVaultBalance() {
  return (await prisma.systemVault.findUnique({ where: { id: 1 } }))?.balance ?? 0;
}

export function depositToVault(amount, reason, detail, transaction = null) {
  assertCoinAmount(amount);
  return inEconomyTransaction(transaction, async tx => {
    if (amount === 0) return;
    await ensureVault(tx);
    await tx.systemVault.update({ where: { id: 1 }, data: { balance: { increment: amount } } });
    await tx.vaultLog.create({ data: { amount, direction: 'in', reason: reason || 'deposit', detail } });
  });
}

async function withdrawFromVault(tx, amount, reason, detail) {
  assertCoinAmount(amount);
  await ensureVault(tx);
  const debit = await tx.systemVault.updateMany({ where: { id: 1, balance: { gte: amount } }, data: { balance: { decrement: amount } } });
  if (!debit.count) return false;
  await tx.vaultLog.create({ data: { amount, direction: 'out', reason, detail } });
  return true;
}

export function calculateRankedPayout(buyIn) {
  assertCoinAmount(buyIn);
  const pot = buyIn * 2;
  const tax = pot === 0 ? 0 : Math.max(1, Math.round(pot * RANKED_TAX_RATE));
  return { winnerPot: pot - tax, tax };
}

export function calculateShopSplit(price) {
  assertCoinAmount(price);
  const toVault = price === 0 ? 0 : Math.max(1, Math.round(price * SHOP_VAULT_RATE));
  return { burned: price - toVault, toVault };
}

function utcDayStart(now) {
  const day = new Date(now); day.setUTCHours(0, 0, 0, 0); return day;
}

export async function checkDailyBounty(userId, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user && (!user.lastDailyWin || user.lastDailyWin < utcDayStart(now)) ? DAILY_BOUNTY_AMOUNT : 0;
}

export function awardDailyBounty(userId, transaction = null, now = new Date()) {
  return inEconomyTransaction(transaction, async tx => {
    await lockEconomyUsers(tx, [userId]);
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || (user.lastDailyWin && user.lastDailyWin >= utcDayStart(now))) return 0;
    // Consumed when earned, including when the vault must queue payment.
    await tx.user.update({ where: { id: userId }, data: { lastDailyWin: now } });
    if (await withdrawFromVault(tx, DAILY_BOUNTY_AMOUNT, 'Daily bounty', `User #${userId}`)) {
      await awardCoins(userId, DAILY_BOUNTY_AMOUNT, 'DAILY_BOUNTY', tx, now);
      return DAILY_BOUNTY_AMOUNT;
    }
    await tx.pendingPayout.create({ data: { userId, amount: DAILY_BOUNTY_AMOUNT, reason: 'DAILY_BOUNTY', label: 'Daily bounty' } });
    return -DAILY_BOUNTY_AMOUNT;
  });
}

export function checkMilestones(userId, newElo, transaction = null) {
  return inEconomyTransaction(transaction, async tx => {
    await lockEconomyUsers(tx, [userId]);
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return [];
    const awarded = [];
    for (const milestone of ELO_MILESTONES) {
      if (newElo < milestone.elo || user.peakElo >= milestone.elo) continue;
      const paid = await withdrawFromVault(tx, milestone.reward, 'Achievement', `${milestone.name} for User #${userId}`);
      if (paid) await awardCoins(userId, milestone.reward, 'ACHIEVEMENT', tx);
      else await tx.pendingPayout.create({ data: { userId, amount: milestone.reward, reason: 'ACHIEVEMENT', label: `${milestone.name} milestone` } });
      awarded.push(paid ? milestone : { ...milestone, pending: true });
    }
    if (newElo > user.peakElo) await tx.user.update({ where: { id: userId }, data: { peakElo: newElo } });
    return awarded;
  });
}

export function claimPendingPayout(payoutId, userId) {
  return inEconomyTransaction(null, async tx => {
    await lockEconomyUsers(tx, [userId]);
    const payout = await tx.pendingPayout.findUnique({ where: { id: payoutId } });
    if (!payout || payout.userId !== userId) return { success: false, error: 'Not found' };
    if (payout.claimedAt) return { success: true, amount: payout.amount };
    if (!await withdrawFromVault(tx, payout.amount, `Pending: ${payout.reason}`, payout.label)) {
      return { success: false, error: 'Vault has insufficient funds' };
    }
    await awardCoins(userId, payout.amount, payout.reason, tx);
    await tx.pendingPayout.update({ where: { id: payoutId }, data: { claimedAt: new Date() } });
    return { success: true, amount: payout.amount };
  });
}

export function isValidWager(moveHistory, startedAt, endedAt = new Date()) {
  if (!moveHistory || moveHistory.length < MIN_WAGER_MOVES) return false;
  return !startedAt || new Date(endedAt).getTime() - new Date(startedAt).getTime() >= MIN_WAGER_DURATION_MS;
}
