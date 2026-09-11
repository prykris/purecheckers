import prisma from '../db.js';
import { inEconomyTransaction, lockEconomyUsers, EconomyError } from './economy.js';
import { awardCoins } from './coins.js';
import { GUEST_LIFETIME_MS, GUEST_TOKEN_RENEW_MS, STARTER_COINS } from '../../shared/constants.js';

export class AccountError extends EconomyError {
  constructor(message, status = 401) { super(message, status); }
}

export function assertActiveAccount(user) {
  if (!user || user.guestRetiredAt) throw new AccountError('This account is no longer available');
  return user;
}

// JWTs establish the account ID, not current identity or registration status.
// Refresh an expiring guest under the same row lock used by cleanup/upgrade.
export async function authorizeAccount(userId, now = new Date(), { renew = false } = {}) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new AccountError('Invalid account');
  const user = assertActiveAccount(await prisma.user.findUnique({ where: { id: userId } }));
  const target = now.getTime() + (renew ? GUEST_LIFETIME_MS : GUEST_TOKEN_RENEW_MS);
  if (!user.isGuest || user.guestExpiresAt?.getTime() > target) return user;
  return inEconomyTransaction(null, async tx => {
    await lockEconomyUsers(tx, [userId]);
    const current = assertActiveAccount(await tx.user.findUnique({ where: { id: userId } }));
    if (!current.isGuest || current.guestExpiresAt?.getTime() > target) return current;
    return tx.user.update({ where: { id: userId }, data: { guestExpiresAt: new Date(now.getTime() + GUEST_LIFETIME_MS) } });
  });
}

export function registerAccount(data, transaction = null) {
  return inEconomyTransaction(transaction, async tx => {
    const user = await tx.user.create({ data: { ...data, coins: 0 } });
    await awardCoins(user.id, STARTER_COINS, 'STARTER_GRANT', tx);
    return tx.user.findUniqueOrThrow({ where: { id: user.id } });
  });
}

export function upgradeGuest(userId, { username, email, passwordHash }, transaction = null) {
  return inEconomyTransaction(transaction, async tx => {
    await lockEconomyUsers(tx, [userId]);
    const user = assertActiveAccount(await tx.user.findUnique({ where: { id: userId } }));
    if (!user.isGuest) throw new AccountError('Already a registered user', 400);
    await tx.user.update({ where: { id: userId }, data: { username, email, passwordHash, isGuest: false, guestExpiresAt: null } });
    await awardCoins(userId, STARTER_COINS, 'STARTER_GRANT', tx);
    return tx.user.findUniqueOrThrow({ where: { id: userId } });
  });
}
