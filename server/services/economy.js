import { Prisma } from '@prisma/client';
import prisma from '../db.js';

export class EconomyError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function assertCoinAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2_147_483_647) {
    throw new EconomyError('Invalid coin amount');
  }
}

// Join an owning transaction instead of committing partial operations.
export function inEconomyTransaction(transaction, work) {
  return transaction ? work(transaction) : prisma.$transaction(work);
}

// Account locks precede the shared vault. Sorting prevents reverse-order cycles.
export async function lockEconomyUsers(tx, userIds) {
  const ids = [...new Set(userIds)].sort((a, b) => a - b);
  if (!ids.length) return;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
}
