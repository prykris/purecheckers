import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { retireExpiredGuest, cleanupExpiredGuests, createGuestCleanup } from '../server/services/guestCleanup.js';
import { authorizeAccount, upgradeGuest, registerAccount } from '../server/services/accounts.js';
import { startGameplayOwnership, claimGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createGameRun, abortGameStart } from '../server/services/gameRuns.js';
import { enqueueSettlement } from '../server/services/settlementRecovery.js';
import { getOrCreateSession, removeSession, setPhase } from '../server/domain/sessions.js';
import { STARTER_COINS } from '../shared/constants.js';
import { tipFriend } from '../server/services/walletActions.js';

let guest, other, ids, keys, items;
beforeAll(() => startGameplayOwnership());
beforeEach(async () => {
  keys = []; items = [];
  [guest, other] = await Promise.all([true, false].map(isGuest => prisma.user.create({ data: {
    username: `cleanup-${randomUUID()}`, friendCode: randomUUID(), isGuest,
    guestExpiresAt: isGuest ? new Date(Date.now() - 10000) : null
  } })));
  ids = [guest.id, other.id];
});
afterEach(async () => {
  ids.forEach(removeSession);
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.game.deleteMany({ where: { redPlayerId: { in: ids } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ids } } });
  await prisma.inventory.deleteMany({ where: { userId: { in: ids } } });
  await prisma.pendingPayout.deleteMany({ where: { userId: { in: ids } } });
  await prisma.friendship.deleteMany({ where: { requesterId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.shopItem.deleteMany({ where: { id: { in: items } } });
});
function creation() {
  const key = randomUUID(); keys.push(key);
  return { key, redPlayerId: guest.id, blackPlayerId: other.id, mode: 'FRIENDLY', buyIn: 0 };
}
function token(user = guest) { return jwt.sign({ userId: user.id, username: user.username, isGuest: user.isGuest }, process.env.JWT_SECRET, { expiresIn: '1d' }); }
async function addGuest() {
  const user = await prisma.user.create({ data: { username: `cleanup-${randomUUID()}`, friendCode: randomUUID(), isGuest: true, guestExpiresAt: new Date(Date.now() - 10000) } });
  ids.push(user.id); return user;
}

it('retires rather than deleting a zero-game guest with historical reservations, ledger and command receipts', async () => {
  const run = await createGameRun(creation()); await abortGameStart(run.key);
  const ledger = await prisma.coinTransaction.create({ data: { receiverId: guest.id, amount: -1, reason: 'PURCHASE' } });
  const receipt = await prisma.walletOperation.create({ data: { userId: guest.id, key: randomUUID(), kind: 'purchase', payload: {}, receipt: {} } });
  expect(await retireExpiredGuest(guest.id)).toBe('retired');
  expect(await retireExpiredGuest(guest.id)).toBe('unchanged');
  expect(await prisma.user.findUnique({ where: { id: guest.id } })).toMatchObject({
    guestRetiredAt: expect.any(Date), username: `[Expired Guest ${guest.id}]`, gamesPlayed: 0, profilePublic: false
  });
  expect(await prisma.gameRun.findUnique({ where: { id: run.id } })).not.toBeNull();
  expect(await prisma.coinTransaction.findUnique({ where: { id: ledger.id } })).not.toBeNull();
  expect(await prisma.walletOperation.findUnique({ where: { id: receipt.id } })).not.toBeNull();
});

it.each(['connected', 'room', 'balance', 'inventory', 'run', 'settlement', 'payout'])('protects an expired guest with %s', async kind => {
  if (kind === 'connected') getOrCreateSession(guest.id, guest.username, true).connectionId = 'connected';
  if (kind === 'room') { getOrCreateSession(guest.id, guest.username, true); setPhase(guest.id, 'in-room', { roomId: 123 }); }
  if (kind === 'balance') await prisma.user.update({ where: { id: guest.id }, data: { coins: 1 } });
  if (kind === 'inventory') {
    const item = await prisma.shopItem.create({ data: { slug: randomUUID(), name: 'Kept item', type: 'SKIN', price: 0, data: {} } });
    items.push(item.id); await prisma.inventory.create({ data: { userId: guest.id, itemId: item.id } });
  }
  if (kind === 'run') await createGameRun(creation());
  if (kind === 'settlement') {
    const input = creation(); await enqueueSettlement({ key: input.key, redUserId: guest.id, blackUserId: other.id, mode: 'FRIENDLY', buyIn: 0,
      winner: null, moveHistory: [], startedAt: new Date(), endedAt: new Date(), endReason: 'draw-agreement' });
  }
  if (kind === 'payout') await prisma.pendingPayout.create({ data: { userId: guest.id, amount: 1, reason: 'DAILY_BOUNTY' } });
  expect(await retireExpiredGuest(guest.id)).toBe('protected');
  expect((await prisma.user.findUnique({ where: { id: guest.id } })).guestRetiredAt).toBeNull();
});

it('does not retire registered users, bots or unexpired guests', async () => {
  expect(await retireExpiredGuest(other.id)).toBe('unchanged');
  await prisma.user.update({ where: { id: guest.id }, data: { isBot: true } });
  expect(await retireExpiredGuest(guest.id)).toBe('unchanged');
  await prisma.user.update({ where: { id: guest.id }, data: { isBot: false, guestExpiresAt: new Date(Date.now() + 10000) } });
  expect(await retireExpiredGuest(guest.id)).toBe('unchanged');
});

it('refuses retired-account API access, renewal, upgrade and game creation even with a valid token', async () => {
  const bearer = token(); await retireExpiredGuest(guest.id);
  expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${bearer}`)).status).toBe(401);
  await expect(authorizeAccount(guest.id)).rejects.toThrow('no longer available');
  await expect(upgradeGuest(guest.id, { username: guest.username, email: 'retired@test.invalid', passwordHash: 'unused' })).rejects.toThrow('no longer available');
  await expect(createGameRun(creation())).rejects.toThrow('no longer available');
  expect((await prisma.user.findUnique({ where: { id: guest.id } })).coins).toBe(0);
});

it('does not transfer a friend tip into a retired account', async () => {
  await prisma.user.update({ where: { id: other.id }, data: { coins: 20 } });
  await prisma.friendship.create({ data: { requesterId: other.id, receiverId: guest.id, status: 'ACCEPTED' } });
  await retireExpiredGuest(guest.id);
  await expect(tipFriend(other.id, { receiverId: guest.id, amount: 10, requestId: randomUUID() })).rejects.toThrow('Recipient account is unavailable');
  expect((await prisma.user.findUnique({ where: { id: other.id } })).coins).toBe(20);
  expect((await prisma.user.findUnique({ where: { id: guest.id } })).coins).toBe(0);
});

it('serializes retirement against upgrade so only one account transition can win', async () => {
  const [retirement, upgrade] = await Promise.allSettled([
    retireExpiredGuest(guest.id), upgradeGuest(guest.id, { username: guest.username, email: `race-${randomUUID()}@test.invalid`, passwordHash: 'test-only' })
  ]);
  const current = await prisma.user.findUnique({ where: { id: guest.id } });
  if (upgrade.status === 'fulfilled') {
    expect(retirement.value).toBe('unchanged');
    expect(current).toMatchObject({ isGuest: false, guestRetiredAt: null, coins: STARTER_COINS });
  } else {
    expect(retirement.value).toBe('retired'); expect(current.isGuest).toBe(true); expect(current.coins).toBe(0);
  }
});

it('does not resurrect an account when renewal races retirement', async () => {
  const [retirement, renewal] = await Promise.allSettled([retireExpiredGuest(guest.id), authorizeAccount(guest.id)]);
  const current = await prisma.user.findUnique({ where: { id: guest.id } });
  if (renewal.status === 'fulfilled') {
    expect(retirement.value).toBe('unchanged'); expect(current.guestRetiredAt).toBeNull();
    expect(current.guestExpiresAt.getTime()).toBeGreaterThan(Date.now());
  } else { expect(current.guestRetiredAt).not.toBeNull(); expect(retirement.value).toBe('retired'); }
});

it('rolls back upgrade identity, starter credit and ledger together', async () => {
  await expect(prisma.$transaction(async tx => {
    await upgradeGuest(guest.id, { username: guest.username, email: 'rollback@test.invalid', passwordHash: 'test-only' }, tx);
    throw Error('upgrade rollback');
  })).rejects.toThrow('upgrade rollback');
  expect(await prisma.user.findUnique({ where: { id: guest.id } })).toMatchObject({ isGuest: true, email: null, coins: 0 });
  expect(await prisma.coinTransaction.count({ where: { receiverId: guest.id, reason: 'STARTER_GRANT' } })).toBe(0);
});

it('rolls back registration and its starter ledger together', async () => {
  const username = `register-${randomUUID()}`;
  await expect(prisma.$transaction(async tx => {
    await registerAccount({ username, friendCode: randomUUID() }, tx); throw Error('registration rollback');
  })).rejects.toThrow('registration rollback');
  expect(await prisma.user.findUnique({ where: { username } })).toBeNull();
});

it('advances bounded pages past protected and failed accounts instead of starving later guests', async () => {
  const failed = await addGuest(), last = await addGuest();
  const first = await cleanupExpiredGuests({ afterId: guest.id - 1, batchSize: 1, isActive: () => true });
  expect(first).toMatchObject({ protected: 1, scanned: 1, nextCursor: guest.id });
  const unavailable = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(Error('one account unavailable'));
  let second;
  try { second = await cleanupExpiredGuests({ afterId: first.nextCursor, batchSize: 1 }); }
  finally { unavailable.mockRestore(); }
  expect(second).toMatchObject({ failed: 1, scanned: 1, nextCursor: failed.id });
  const third = await cleanupExpiredGuests({ afterId: second.nextCursor, batchSize: 1 });
  expect(third).toMatchObject({ retired: 1, scanned: 1, nextCursor: last.id });
});

it('coalesces cleanup calls and drains the current account without starting another after stop', async () => {
  await addGuest();
  const original = prisma.$transaction.bind(prisma);
  let entered, release;
  const inside = new Promise(resolve => { entered = resolve; });
  const delayed = vi.spyOn(prisma, '$transaction').mockImplementationOnce(work => original(async tx => {
    entered(); await new Promise(resolve => { release = resolve; }); return work(tx);
  }));
  const worker = createGuestCleanup({ batchSize: 100 });
  try {
    const first = worker.runOnce(); expect(worker.runOnce()).toBe(first); await inside;
    const stopping = worker.stop(); release(); await stopping;
    expect((await first).scanned).toBe(1); expect(await worker.runOnce()).toBeNull();
  } finally { release?.(); delayed.mockRestore(); await worker.stop(); }
});

it('fences an older cleanup worker from retiring users based on obsolete session presence', async () => {
  const worker = createGuestCleanup();
  try {
    await claimGameplayOwnership();
    await expect(worker.runOnce()).rejects.toThrow('newer server');
    expect((await prisma.user.findUnique({ where: { id: guest.id } })).guestRetiredAt).toBeNull();
  } finally { await worker.stop(); await startGameplayOwnership(); }
});
