import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { executeAdminAction } from '../server/services/adminActions.js';
import { lockEconomyUsers } from '../server/services/economy.js';
import { deductCoins } from '../server/services/coins.js';

let actor, target;
const intent = extra => ({ userId: target.id, requestId: randomUUID(), ...extra });
beforeEach(async () => {
  actor = await prisma.user.create({ data: { username: 'admin-' + randomUUID(), friendCode: randomUUID(), isAdmin: true } });
  target = await prisma.user.create({ data: { username: 'target-' + randomUUID(), friendCode: randomUUID(), coins: 100, elo: 1400, peakElo: 1600, wins: 4, gamesPlayed: 7 } });
});
afterEach(async () => {
  const ids = [actor.id, target.id];
  await prisma.adminOperation.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ids } } });
  await prisma.gameRun.deleteMany({ where: { redPlayerId: { in: ids } } });
  await prisma.roomRecord.deleteMany({ where: { creatorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

it('commits one ledger entry and audit receipt for concurrent duplicates and lost responses', async () => {
  const body = intent({ amount: 30, reason: 'Support correction' });
  const results = await Promise.all([executeAdminAction(actor.id, 'give-coins', body), executeAdminAction(actor.id, 'give-coins', body)]);
  expect(results[0]).toEqual(results[1]);
  expect(results[0]).toMatchObject({ before: { coins: 100 }, user: { coins: 130 } });
  await deductCoins(target.id, 10, 'PURCHASE');
  expect(await executeAdminAction(actor.id, 'give-coins', body)).toEqual(results[0]);
  expect((await prisma.user.findUnique({ where: { id: target.id } })).coins).toBe(120);
  expect(await prisma.adminOperation.count({ where: { actorId: actor.id } })).toBe(1);
  expect(await prisma.coinTransaction.findMany({ where: { reason: 'ADMIN_ADJUSTMENT', receiverId: target.id } })).toEqual([
    expect.objectContaining({ amount: 30, senderId: actor.id })
  ]);
  await expect(executeAdminAction(actor.id, 'give-coins', { ...body, amount: 31 })).rejects.toMatchObject({ status: 409 });
  await expect(executeAdminAction(actor.id, 'reset-stats', body)).rejects.toMatchObject({ status: 409 });
});

it('rolls the wallet, ledger and audit back together', async () => {
  const body = intent({ amount: -40 });
  await expect(prisma.$transaction(async tx => { await executeAdminAction(actor.id, 'give-coins', body, tx); throw Error('rollback'); })).rejects.toThrow('rollback');
  expect((await prisma.user.findUnique({ where: { id: target.id } })).coins).toBe(100);
  expect(await prisma.adminOperation.count({ where: { actorId: actor.id } })).toBe(0);
  expect(await prisma.coinTransaction.count({ where: { receiverId: target.id } })).toBe(0);
  expect((await executeAdminAction(actor.id, 'give-coins', body)).user.coins).toBe(60);
});

it('serializes withdrawals and rejects underflow and overflow without partial receipts', async () => {
  const results = await Promise.allSettled([executeAdminAction(actor.id, 'give-coins', intent({ amount: -70 })), executeAdminAction(actor.id, 'give-coins', intent({ amount: -70 }))]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await prisma.user.findUnique({ where: { id: target.id } })).coins).toBe(30);
  await prisma.user.update({ where: { id: target.id }, data: { coins: 2_147_483_647 } });
  await expect(executeAdminAction(actor.id, 'give-coins', intent({ amount: 1 }))).rejects.toThrow('limit');
  expect(await prisma.adminOperation.count({ where: { actorId: actor.id } })).toBe(1);
});

it.each([{ amount: '2' }, { amount: 0 }, { amount: 1.5 }, { amount: Infinity }])('rejects coercive or invalid amounts %j', async values => {
  await expect(executeAdminAction(actor.id, 'give-coins', intent(values))).rejects.toMatchObject({ status: 400 });
});

it('preserves reward watermarks while setting zero ELO or resetting displayed statistics', async () => {
  const daily = new Date('2026-09-11T00:00:00Z');
  await prisma.user.update({ where: { id: target.id }, data: { lastDailyWin: daily } });
  expect((await executeAdminAction(actor.id, 'set-elo', intent({ elo: 0 }))).user).toMatchObject({ elo: 0, peakElo: 1600 });
  const body = intent();
  const receipt = await executeAdminAction(actor.id, 'reset-stats', body);
  expect(receipt.user).toMatchObject({ elo: 1000, peakElo: 1600, wins: 0, gamesPlayed: 0, lastDailyWin: daily.toISOString() });
  await prisma.user.update({ where: { id: target.id }, data: { wins: 1, gamesPlayed: 1 } });
  expect(await executeAdminAction(actor.id, 'reset-stats', body)).toEqual(receipt);
  expect((await prisma.user.findUnique({ where: { id: target.id } })).wins).toBe(1);
});

it('rejects rating changes while a game is open or settlement is outstanding', async () => {
  const run = await prisma.gameRun.create({ data: { key: randomUUID(), redPlayerId: target.id, blackPlayerId: actor.id, mode: 'FRIENDLY', buyIn: 0, turnTime: 60, origin: 'test', initialState: {} } });
  const body = intent({ elo: 1300 });
  await expect(executeAdminAction(actor.id, 'set-elo', body)).rejects.toMatchObject({ status: 409 });
  await prisma.gameRun.update({ where: { id: run.id }, data: { status: 'SETTLED' } });
  expect((await executeAdminAction(actor.id, 'set-elo', body)).user.elo).toBe(1300);
});

it.each(['PLAYER', 'SPECTATOR'])('requires leaving a room before resetting a %s profile', async role => {
  const room = await prisma.roomRecord.create({ data: { creatorId: actor.id, creationKey: randomUUID(), creation: {}, joinCode: randomUUID(), state: {} } });
  await prisma.activeRoomMember.create({ data: { userId: target.id, roomId: room.id, role } });
  const body = intent();
  await expect(executeAdminAction(actor.id, 'reset-stats', body)).rejects.toMatchObject({ status: 409 });
  expect(await prisma.adminOperation.count({ where: { actorId: actor.id } })).toBe(0);
  await prisma.activeRoomMember.delete({ where: { userId: target.id } });
  expect((await executeAdminAction(actor.id, 'reset-stats', body)).user.gamesPlayed).toBe(0);
});

it('requires dismissing a settled result before changing its viewer rating', async () => {
  const run = await prisma.gameRun.create({ data: { key: randomUUID(), redPlayerId: target.id, blackPlayerId: actor.id, mode: 'FRIENDLY', buyIn: 0, turnTime: 60, origin: 'test', initialState: {}, status: 'SETTLED' } });
  await prisma.gameResultRecord.create({ data: { gameRunId: run.id, status: 'OPEN', state: {}, viewers: { create: { userId: target.id, role: 'PLAYER' } } } });
  const body = intent({ elo: 1300 });
  await expect(executeAdminAction(actor.id, 'set-elo', body)).rejects.toMatchObject({ status: 409 });
  await prisma.activeResultViewer.delete({ where: { userId: target.id } });
  expect((await executeAdminAction(actor.id, 'set-elo', body)).user.elo).toBe(1300);
});

it('checks admin authority after acquiring the same locks used for revocation', async () => {
  let unlock, locked;
  const lockReady = new Promise(resolve => { locked = resolve; });
  const gate = new Promise(resolve => { unlock = resolve; });
  const revocation = prisma.$transaction(async tx => {
    await lockEconomyUsers(tx, [actor.id]); locked(); await gate;
    await tx.user.update({ where: { id: actor.id }, data: { isAdmin: false } });
  });
  await lockReady;
  const attempt = executeAdminAction(actor.id, 'give-coins', intent({ amount: 50 }));
  const rejection = expect(attempt).rejects.toMatchObject({ status: 403 });
  unlock(); await revocation; await rejection;
  expect((await prisma.user.findUnique({ where: { id: target.id } })).coins).toBe(100);
});

it('confirms self-revocation after a lost response but refuses new privileged work', async () => {
  const body = { userId: actor.id, requestId: randomUUID(), isAdmin: false };
  const receipt = await executeAdminAction(actor.id, 'set-admin', body);
  expect(receipt.user.isAdmin).toBe(false);
  expect(await executeAdminAction(actor.id, 'set-admin', body)).toEqual(receipt);
  await expect(executeAdminAction(actor.id, 'give-coins', intent({ amount: 1 }))).rejects.toMatchObject({ status: 403 });
});

it('keeps retired targets and malformed permission inputs unchanged', async () => {
  await expect(executeAdminAction(actor.id, 'set-admin', intent({ isAdmin: 'false' }))).rejects.toMatchObject({ status: 400 });
  await expect(executeAdminAction(actor.id, 'set-elo', intent({ userId: 0, elo: 10 }))).rejects.toMatchObject({ status: 400 });
  await prisma.user.update({ where: { id: target.id }, data: { guestRetiredAt: new Date() } });
  await expect(executeAdminAction(actor.id, 'give-coins', intent({ amount: 1 }))).rejects.toMatchObject({ status: 404 });
});

it('uses current authorization and returns saved receipts through HTTP', async () => {
  const token = id => jwt.sign({ userId: id }, 'test-secret');
  const body = intent({ amount: 20 });
  await request(app).post('/api/admin/give-coins').send(body).expect(401);
  await request(app).post('/api/admin/give-coins').set('Authorization', 'Bearer ' + token(target.id)).send(body).expect(403);
  const first = await request(app).post('/api/admin/give-coins').set('Authorization', 'Bearer ' + token(actor.id)).send(body).expect(200);
  const retry = await request(app).post('/api/admin/give-coins').set('Authorization', 'Bearer ' + token(actor.id)).send(body).expect(200);
  expect(retry.body).toEqual(first.body);
  await request(app).post('/api/admin/give-coins').set('Authorization', 'Bearer ' + token(actor.id)).send({ amount: 20 }).expect(400);
});
