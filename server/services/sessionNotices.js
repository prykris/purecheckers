import { isDeepStrictEqual } from 'node:util';
import { SESSION_NOTICE_TEXT } from '../../shared/sessionNotices.js';
import { lockEconomyUsers } from './economy.js';
import { gameplayOwner, inGameplayTransaction } from './gameplayOwnership.js';

export const latestNoticeQuery = { orderBy: { sequence: 'desc' }, take: 1 };
const latest = (tx, userId) => tx.sessionNotice.findFirst({ where: { userId }, orderBy: { sequence: 'desc' } });

// The caller holds ownership and ordered account locks in its owning transition.
// An event is immutable; repeating it must not change order or dismissal.
export async function appendSessionNotice(tx, { userId, effectKey, reason, context = {} }) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || typeof effectKey !== 'string' || !effectKey || effectKey.length > 200 ||
      !Object.hasOwn(SESSION_NOTICE_TEXT, reason)) throw Error('Invalid session notice');
  const existing = await tx.sessionNotice.findUnique({ where: { userId_effectKey: { userId, effectKey } } });
  if (existing) {
    if (existing.reason !== reason || !isDeepStrictEqual(existing.context, context)) throw Error('Session notice identity conflict');
    return existing;
  }
  return tx.sessionNotice.create({ data: { userId, effectKey, reason, context } });
}

export function readSessionNotice(userId, owner = gameplayOwner()) {
  return inGameplayTransaction(owner, null, tx => latest(tx, userId));
}

export function dismissSessionNotice(userId, noticeId, owner = gameplayOwner(), guard = () => true) {
  if (typeof noticeId !== 'string' || !noticeId || noticeId.length > 100) throw Error('Invalid notice identity');
  return inGameplayTransaction(owner, null, async tx => {
    await lockEconomyUsers(tx, [userId]);
    if (!guard()) throw Error('Session changed');
    // Only this owner's exact event is dismissed. Older events stay older, and
    // a stale dismissal cannot clear a newer current notice.
    await tx.sessionNotice.updateMany({ where: { id: noticeId, userId, dismissedAt: null }, data: { dismissedAt: new Date() } });
    return latest(tx, userId);
  });
}
