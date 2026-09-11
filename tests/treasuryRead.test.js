import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { readTreasury } from '../server/services/treasury.js';
import { claimPendingPayout, getVaultBalance } from '../server/services/vault.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createGameRun, abortGameStart } from '../server/services/gameRuns.js';
import { settleGame } from '../server/services/gameSettlement.js';

let users, originalVault, marker;
beforeAll(() => startGameplayOwnership());
beforeEach(async () => {
  marker = randomUUID();
  originalVault = await prisma.systemVault.findUnique({ where: { id: 1 } });
  users = await Promise.all([0, 1].map(i => prisma.user.create({ data: { username: `treasury-${marker}-${i}`, friendCode: randomUUID(), coins: 20 } })));
  await prisma.systemVault.upsert({ where: { id: 1 }, create: { id: 1, balance: 10 }, update: { balance: 10 } });
});
afterEach(async () => {
  const ids = users.map(u => u.id);
  await prisma.gameRun.deleteMany({ where: { redPlayerId: { in: ids } } });
  await prisma.game.deleteMany({ where: { redPlayerId: { in: ids } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ids } } });
  await prisma.pendingPayout.deleteMany({ where: { userId: { in: ids } } });
  await prisma.vaultLog.deleteMany({ where: { detail: marker } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  if (originalVault) await prisma.systemVault.upsert({ where: { id: 1 }, create: originalVault, update: { balance: originalVault.balance } });
  else await prisma.systemVault.deleteMany({ where: { id: 1 } });
});
const payout = (user, amount = 10, reason = 'ACHIEVEMENT') => prisma.pendingPayout.create({ data: { userId: user.id, amount, reason, label: marker } });
const token = user => jwt.sign({ userId: user.id, username: user.username, isGuest: false }, process.env.JWT_SECRET);

it.each(['abort', 'settle'])('accounts for both reserved stakes until atomic %s releases them', async action => {
  const before = await readTreasury();
  const key = randomUUID(), buyIn = 10;
  await createGameRun({ key, redPlayerId: users[0].id, blackPlayerId: users[1].id, mode: 'RANKED', buyIn });
  const during = await readTreasury();
  expect(during.circulation.spendable).toBe(before.circulation.spendable - 20);
  expect(during.circulation.reserved).toBe(before.circulation.reserved + 20);
  expect(during.economy.grandTotal).toBe(before.economy.grandTotal);
  let minted = 0;
  if (action === 'abort') await abortGameStart(key);
  else {
    const result = await settleGame({ key, redUserId: users[0].id, blackUserId: users[1].id, mode: 'RANKED', buyIn,
      winner: null, moveHistory: [], startedAt: new Date(), endedAt: new Date(), endReason: 'draw-agreement' });
    minted = result.coinRewards.red + result.coinRewards.black - 20;
  }
  const after = await readTreasury();
  expect(after.circulation.reserved).toBe(before.circulation.reserved);
  expect(after.economy.grandTotal).toBe(before.economy.grandTotal + minted);
});

it('offers a funded claim even when all vault funds are owed, with the write rechecking competing claims', async () => {
  const [a, b] = await Promise.all(users.map(u => payout(u)));
  const view = await readTreasury(users[0].id);
  expect(view.vault).toMatchObject({ balance: 10, available: 0 });
  expect(view.pending).toHaveLength(1);
  expect(view.pending[0]).toMatchObject({ id: a.id, canClaim: true, claimUnavailableReason: null });
  expect(await claimPendingPayout(b.id, users[1].id)).toEqual({ success: true, amount: 10 });
  expect(await claimPendingPayout(a.id, users[0].id)).toEqual({ success: false, error: 'Vault has insufficient funds' });
  const after = await readTreasury(users[0].id);
  expect(after.pending[0]).toMatchObject({ id: a.id, canClaim: false, claimUnavailableReason: 'Waiting for vault funds' });
});

it('reads one committed snapshot when a claim commits between the vault and circulation reads', async () => {
  const reward = await payout(users[0]);
  const before = await readTreasury(users[0].id);
  let claimed = false;
  const concurrentDb = { $transaction: (work, options) => prisma.$transaction(tx => work(new Proxy(tx, {
    get(target, property) {
      if (property !== 'systemVault') return target[property];
      return { findUnique: async args => {
        const vault = await tx.systemVault.findUnique(args);
        expect(await claimPendingPayout(reward.id, users[0].id)).toEqual({ success: true, amount: 10 });
        claimed = true;
        return vault;
      } };
    }
  })), options) };
  const during = await readTreasury(users[0].id, concurrentDb);
  expect(claimed).toBe(true); expect(during).toEqual(before);
  const after = await readTreasury(users[0].id);
  expect(after.vault.balance).toBe(0);
  expect(after.circulation.total).toBe(before.circulation.total + 10);
  expect(after.pending).toEqual([]);
  expect(after.economy.grandTotal).toBe(before.economy.grandTotal);
});

it('includes deferred bounty and achievement payments once in paid activity totals', async () => {
  await prisma.systemVault.update({ where: { id: 1 }, data: { balance: 20 } });
  const before = await readTreasury();
  const bounty = await payout(users[0], 5, 'DAILY_BOUNTY'), achievement = await payout(users[1], 10);
  await claimPendingPayout(bounty.id, users[0].id); await claimPendingPayout(bounty.id, users[0].id);
  await claimPendingPayout(achievement.id, users[1].id);
  const after = await readTreasury();
  expect(after.economy.totalBountiesPaid - before.economy.totalBountiesPaid).toBe(5);
  expect(after.economy.totalAchievementsPaid - before.economy.totalAchievementsPaid).toBe(10);
});

it('does not create a vault while reading an empty database', async () => {
  await prisma.systemVault.deleteMany({ where: { id: 1 } });
  expect((await readTreasury()).vault.balance).toBe(0);
  expect(await getVaultBalance()).toBe(0);
  expect(await prisma.systemVault.findUnique({ where: { id: 1 } })).toBeNull();
});

it('serves non-cacheable account-scoped pending rewards, and keeps public views anonymous', async () => {
  const rewards = await Promise.all(users.map(u => payout(u)));
  const publicView = await request(app).get('/api/treasury').expect(200);
  expect(publicView.body.pending).toBeUndefined();
  for (let i = 0; i < users.length; i++) {
    const response = await request(app).get('/api/treasury').set('Authorization', 'Bearer ' + token(users[i])).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.vary).toContain('Authorization');
    expect(response.body.pending.map(p => p.id)).toEqual([rewards[i].id]);
  }
  await request(app).get('/api/treasury').set('Authorization', 'Bearer invalid').expect(401);
});
