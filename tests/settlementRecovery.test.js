import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import prisma from '../server/db.js';
import { enqueueSettlement, settleQueuedGame, createSettlementRecovery } from '../server/services/settlementRecovery.js';

const execute = promisify(execFile);
let red, black, keys;
beforeEach(async () => {
  keys = [];
  [red, black] = await Promise.all(['r', 'b'].map(c => prisma.user.create({ data: {
    username: `recovery-${c}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
});
afterEach(async () => {
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.game.deleteMany({ where: { redPlayerId: red.id } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: [red.id, black.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [red.id, black.id] } } });
});
function intent(changes = {}) {
  const game = { key: randomUUID(), redUserId: red.id, blackUserId: black.id, winner: 'red', mode: 'FRIENDLY', buyIn: 0,
    moveHistory: [], startedAt: new Date(Date.now() - 100_000), endedAt: new Date(), endReason: 'resign', ...changes };
  keys.push(game.key); return game;
}
const child = (operation, game) => execute(process.execPath, ['tests/fixtures/settlement-worker.js', operation, ...(game ? [JSON.stringify(game)] : [])], {
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }, windowsHide: true, timeout: 15_000
});

it('stores immutable intent idempotently and rejects a changed history under the same identity', async () => {
  const game = intent();
  const [a, b] = await Promise.all([enqueueSettlement(game), enqueueSettlement(game)]);
  expect(b.intent).toEqual(a.intent);
  expect((await enqueueSettlement(JSON.parse(JSON.stringify(game)))).intent).toEqual(a.intent);
  await expect(enqueueSettlement({ ...game, moveHistory: [{ changed: true }] })).rejects.toThrow('identity conflict');
  expect(await prisma.game.count({ where: { settlementKey: game.key } })).toBe(0);
});

it('commits replay, stats and job completion together and returns the same receipt on concurrent retry', async () => {
  const game = intent(); await enqueueSettlement(game);
  const [a, b] = await Promise.all([settleQueuedGame(game.key), settleQueuedGame(game.key)]);
  expect(b).toEqual(a);
  expect(await prisma.gameSettlementJob.findUnique({ where: { key: game.key } })).toMatchObject({ completedAt: expect.any(Date), replayId: a.replayId });
  expect((await prisma.user.findUnique({ where: { id: red.id } })).gamesPlayed).toBe(1);
});

it('keeps a pending intent when the settlement transaction fails, then retries all effects', async () => {
  const game = intent(); await enqueueSettlement(game);
  await expect(prisma.$transaction(async tx => { await settleQueuedGame(game.key, tx); throw Error('commit interrupted'); })).rejects.toThrow('commit interrupted');
  expect(await prisma.gameSettlementJob.findUnique({ where: { key: game.key } })).toMatchObject({ completedAt: null, replayId: null });
  expect(await prisma.game.count({ where: { settlementKey: game.key } })).toBe(0);
  expect((await prisma.user.findUnique({ where: { id: red.id } })).gamesPlayed).toBe(0);
  expect(await createSettlementRecovery().runOnce()).toBe(1);
  expect((await prisma.user.findUnique({ where: { id: red.id } })).gamesPlayed).toBe(1);
});

it('recovers a committed terminal intent in a fresh process after abrupt process exit', async () => {
  const game = intent();
  await expect(child('enqueue-and-exit', game)).rejects.toMatchObject({ code: 23 });
  expect(await prisma.game.count({ where: { settlementKey: game.key } })).toBe(0);
  const result = await child('recover');
  expect(JSON.parse(result.stdout)).toEqual({ completed: 1 });
  expect((await prisma.user.findUnique({ where: { id: red.id } })).gamesPlayed).toBe(1);
});

it('does not repeat payment after a process exits between commit and publication', async () => {
  await prisma.user.update({ where: { id: black.id }, data: { isBot: true } });
  const game = intent(); await enqueueSettlement(game);
  await expect(child('settle-and-exit')).rejects.toMatchObject({ code: 24 });
  const result = await child('recover');
  expect(JSON.parse(result.stdout)).toEqual({ completed: 0 });
  const receipt = await settleQueuedGame(game.key);
  expect(receipt.coinRewards.red).toBe(5);
  expect((await prisma.user.findUnique({ where: { id: red.id } })).coins).toBe(105);
  expect(await prisma.coinTransaction.count({ where: { receiverId: red.id, reason: 'BOT_WIN' } })).toBe(1);
});

it('backs off a failed job without starving later work, and limits each batch', async () => {
  const bad = intent({ mode: 'invalid' }), good = intent(), later = intent();
  for (const job of [bad, good, later]) await enqueueSettlement(job);
  const now = new Date(Date.now() + 1000);
  const worker = createSettlementRecovery({ now: () => now, batchSize: 2 });
  expect(await worker.runOnce()).toBe(1);
  const failed = await prisma.gameSettlementJob.findUnique({ where: { key: bad.key } });
  expect(failed).toMatchObject({ attempts: 1, completedAt: null });
  expect(failed.nextAttemptAt.getTime()).toBe(now.getTime() + 1000);
  expect(await worker.runOnce()).toBe(1);
  expect(await worker.runOnce()).toBe(0); // poison job is not due yet
  await worker.stop();
});

it('shares one running batch and stops before processing another queued job', async () => {
  const jobs = [await enqueueSettlement(intent()), await enqueueSettlement(intent())];
  let release;
  const onSettled = vi.fn(() => new Promise(resolve => { release = resolve; }));
  // This tests batching, not scheduling: both DB-created jobs must be due even
  // when the database clock is slightly ahead of the Node process clock.
  const dueAt = new Date(Math.max(...jobs.map(job => job.nextAttemptAt.getTime())));
  const worker = createSettlementRecovery({ onSettled, now: () => dueAt });
  const first = worker.runOnce();
  expect(worker.runOnce()).toBe(first);
  await vi.waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
  const stopping = worker.stop(); release();
  await stopping;
  expect(await first).toBe(1);
  expect(await worker.runOnce()).toBe(0);
  expect(onSettled).toHaveBeenCalledTimes(1);
});

it('does not undo completion or schedule another payment when publication fails', async () => {
  const game = intent(); const queued = await enqueueSettlement(game);
  const onSettled = vi.fn().mockRejectedValue(Error('socket closed'));
  // Test publication after a due job, independent of DB/process clock skew.
  const worker = createSettlementRecovery({ onSettled, now: () => queued.nextAttemptAt });
  expect(await worker.runOnce()).toBe(1);
  expect(await worker.runOnce()).toBe(0);
  expect(onSettled).toHaveBeenCalledTimes(1);
  expect((await prisma.gameSettlementJob.findUnique({ where: { key: game.key } })).completedAt).not.toBeNull();
});

it('protects participants from deletion while a terminal intent awaits settlement', async () => {
  const game = intent(); await enqueueSettlement(game);
  await expect(prisma.user.delete({ where: { id: red.id } })).rejects.toMatchObject({ code: 'P2003' });
  expect(await createSettlementRecovery().runOnce()).toBe(1);
});
