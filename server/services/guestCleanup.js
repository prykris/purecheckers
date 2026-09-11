import prisma from '../db.js';
import { lockEconomyUsers } from './economy.js';
import { gameplayOwner, inGameplayTransaction, GameplayOwnershipLost } from './gameplayOwnership.js';
import { getSession } from '../domain/sessions.js';

function inSession(id) {
  const session = getSession(id);
  return !!session && (!!session.connectionId || session.phase !== 'idle');
}

// Retirement retains the row and its historical references. gamesPlayed is a
// statistic, never proof that an account has no financial/game/puzzle history.
export function retireExpiredGuest(userId, { now = new Date(), isActive = inSession, owner = gameplayOwner() } = {}, transaction = null) {
  return inGameplayTransaction(owner, transaction, async tx => {
    await lockEconomyUsers(tx, [userId]);
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user?.isGuest || user.isBot || user.guestRetiredAt || !user.guestExpiresAt || user.guestExpiresAt >= now) return 'unchanged';
    if (isActive(userId) || user.coins > 0) return 'protected';
    const [run, job, payout, inventory, room, result] = await Promise.all([
      tx.gameRun.findFirst({ where: { status: 'OPEN', OR: [{ redPlayerId: userId }, { blackPlayerId: userId }] }, select: { id: true } }),
      tx.gameSettlementJob.findFirst({ where: { completedAt: null, OR: [{ redUserId: userId }, { blackUserId: userId }] }, select: { key: true } }),
      tx.pendingPayout.findFirst({ where: { userId, claimedAt: null }, select: { id: true } }),
      tx.inventory.findFirst({ where: { userId }, select: { id: true } }),
      tx.activeRoomMember.findUnique({ where: { userId }, select: { roomId: true } }),
      tx.activeResultViewer.findUnique({ where: { userId }, select: { gameRunId: true } })
    ]);
    if (run || job || payout || inventory || room || result || isActive(userId)) return 'protected';
    await tx.user.update({ where: { id: userId }, data: {
      guestRetiredAt: now, username: `[Expired Guest ${userId}]`, profilePublic: false
    } });
    return 'retired';
  });
}

// One bounded keyset page. Protected or failed accounts cannot starve later IDs.
export async function cleanupExpiredGuests({ now = new Date(), afterId = 0, batchSize = 100, isActive = inSession, stopped = () => false, owner = gameplayOwner() } = {}) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000 || !Number.isSafeInteger(afterId) || afterId < 0) throw Error('Invalid guest cleanup limits');
  const guests = await prisma.user.findMany({ where: { id: { gt: afterId }, isGuest: true, isBot: false,
    guestRetiredAt: null, guestExpiresAt: { lt: now } }, select: { id: true }, orderBy: { id: 'asc' }, take: batchSize });
  const result = { scanned: 0, retired: 0, protected: 0, unchanged: 0, failed: 0, nextCursor: afterId };
  for (const guest of guests) {
    if (stopped()) break;
    try { result[await retireExpiredGuest(guest.id, { now, isActive, owner })]++; }
    catch (error) {
      if (error instanceof GameplayOwnershipLost) throw error;
      result.failed++; console.error(`Guest retirement failed (${guest.id}):`, error.message);
    }
    result.scanned++; result.nextCursor = guest.id;
  }
  if (result.scanned === guests.length && guests.length < batchSize) result.nextCursor = 0;
  return result;
}

export function createGuestCleanup({ batchSize = 100, intervalMs = 60_000, now = () => new Date(), isActive = inSession } = {}) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000 || !Number.isFinite(intervalMs) || intervalMs < 1) throw Error('Invalid guest cleanup limits');
  let running = null, timer = null, stopped = false, cursor = 0;
  // Only the current owner can interpret its process-local session presence.
  const owner = gameplayOwner();
  function runOnce() {
    if (stopped) return Promise.resolve(null);
    if (!running) running = cleanupExpiredGuests({ now: now(), afterId: cursor, batchSize, isActive, stopped: () => stopped, owner })
      .then(result => { cursor = result.nextCursor; return result; }).finally(() => { running = null; });
    return running;
  }
  return {
    runOnce,
    start() {
      if (timer || stopped) return;
      const tick = () => { void runOnce().catch(error => console.error('Guest cleanup unavailable:', error.message)); };
      tick(); timer = setInterval(tick, intervalMs); timer.unref?.();
    },
    async stop() { stopped = true; clearInterval(timer); timer = null; await running?.catch(() => {}); }
  };
}

export function startGuestCleanup() {
  const worker = createGuestCleanup(); worker.start();
  return () => worker.stop();
}
