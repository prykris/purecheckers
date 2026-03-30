import { PrismaClient } from '@prisma/client';
import {
  RANKED_TAX_RATE, SHOP_BURN_RATE, SHOP_VAULT_RATE,
  DAILY_BOUNTY_AMOUNT, ELO_MILESTONES,
  MIN_WAGER_MOVES, MIN_WAGER_DURATION_MS
} from '../../shared/constants.js';

const prisma = new PrismaClient();

// ---- Vault CRUD ----

async function getOrCreateVault() {
  let vault = await prisma.systemVault.findFirst();
  if (!vault) vault = await prisma.systemVault.create({ data: { balance: 0 } });
  return vault;
}

export async function getVaultBalance() {
  return (await getOrCreateVault()).balance;
}

export async function depositToVault(amount, reason, detail) {
  const vault = await getOrCreateVault();
  await prisma.$transaction([
    prisma.systemVault.update({
      where: { id: vault.id },
      data: { balance: { increment: amount } }
    }),
    prisma.vaultLog.create({
      data: { amount, direction: 'in', reason: reason || 'deposit', detail }
    })
  ]);
}

async function withdrawFromVault(amount, reason, detail) {
  const vault = await getOrCreateVault();
  if (vault.balance < amount) return false;
  await prisma.$transaction([
    prisma.systemVault.update({
      where: { id: vault.id },
      data: { balance: { decrement: amount } }
    }),
    prisma.vaultLog.create({
      data: { amount, direction: 'out', reason: reason || 'withdrawal', detail }
    })
  ]);
  return true;
}

// ---- Payout calculations ----

export function calculateRankedPayout(buyIn) {
  const pot = buyIn * 2;
  const tax = Math.max(1, Math.round(pot * RANKED_TAX_RATE));
  return { winnerPot: pot - tax, tax };
}

export function calculateShopSplit(price) {
  const toVault = Math.max(1, Math.round(price * SHOP_VAULT_RATE));
  return { burned: price - toVault, toVault };
}

// ---- Daily bounty ----

export async function checkDailyBounty(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (user.lastDailyWin && new Date(user.lastDailyWin) >= today) return 0;
  return DAILY_BOUNTY_AMOUNT;
}

export async function awardDailyBounty(userId) {
  const amount = await checkDailyBounty(userId);
  if (amount <= 0) return 0;

  const withdrawn = await withdrawFromVault(amount, 'Daily bounty', `User #${userId}`);
  if (!withdrawn) {
    // Vault empty — create pending payout
    await prisma.pendingPayout.create({
      data: { userId, amount, reason: 'DAILY_BOUNTY', label: 'Daily bounty' }
    });
    return -amount; // negative signals "pending"
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: amount }, lastDailyWin: new Date() }
    }),
    prisma.coinTransaction.create({
      data: { receiverId: userId, amount, reason: 'DAILY_BOUNTY' }
    })
  ]);
  return amount;
}

// ---- ELO milestones ----

export async function checkMilestones(userId, newElo) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return [];

  const awarded = [];
  for (const milestone of ELO_MILESTONES) {
    if (newElo >= milestone.elo && user.peakElo < milestone.elo) {
      const withdrawn = await withdrawFromVault(milestone.reward, 'Achievement', `${milestone.name} for User #${userId}`);
      if (withdrawn) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { coins: { increment: milestone.reward } }
          }),
          prisma.coinTransaction.create({
            data: { receiverId: userId, amount: milestone.reward, reason: 'ACHIEVEMENT' }
          })
        ]);
        awarded.push(milestone);
      } else {
        // Vault can't pay — create pending
        await prisma.pendingPayout.create({
          data: { userId, amount: milestone.reward, reason: 'ACHIEVEMENT', label: `${milestone.name} milestone` }
        });
        awarded.push({ ...milestone, pending: true });
      }
    }
  }

  if (newElo > user.peakElo) {
    await prisma.user.update({ where: { id: userId }, data: { peakElo: newElo } });
  }
  return awarded;
}

// ---- Claim pending payouts ----

export async function getPendingPayouts(userId) {
  return prisma.pendingPayout.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });
}

export async function claimPendingPayout(payoutId, userId) {
  const payout = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
  if (!payout || payout.userId !== userId) return { success: false, error: 'Not found' };

  const withdrawn = await withdrawFromVault(payout.amount, `Pending: ${payout.reason}`, payout.label);
  if (!withdrawn) return { success: false, error: 'Vault has insufficient funds' };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: payout.amount } }
    }),
    prisma.coinTransaction.create({
      data: { receiverId: userId, amount: payout.amount, reason: payout.reason }
    }),
    prisma.pendingPayout.delete({ where: { id: payoutId } })
  ]);
  return { success: true, amount: payout.amount };
}

// ---- Wager validation ----

export function isValidWager(moveHistory, startedAt) {
  if (!moveHistory || moveHistory.length < MIN_WAGER_MOVES) return false;
  if (startedAt) {
    const duration = Date.now() - new Date(startedAt).getTime();
    if (duration < MIN_WAGER_DURATION_MS) return false;
  }
  return true;
}

// ---- Vault logs ----

export async function getVaultLogs(limit = 50, offset = 0) {
  return prisma.vaultLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });
}
