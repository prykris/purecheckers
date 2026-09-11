import { randomUUID } from 'node:crypto';
import prisma from '../server/db.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { settleGame } from '../server/services/gameSettlement.js';
import { createGameRun } from '../server/services/gameRuns.js';
import { deductCoins } from '../server/services/coins.js';
import { awardDailyBounty, checkMilestones, claimPendingPayout, depositToVault, getVaultBalance, calculateShopSplit } from '../server/services/vault.js';
import { CheckersGame } from '../shared/game.js';
import { COINS_BOT_WIN, BOT_WIN_DAILY_CAP } from '../shared/constants.js';

beforeAll(() => startGameplayOwnership());
let red, black;
beforeEach(async () => {
  [red, black] = await Promise.all(['r', 'b'].map(color => prisma.user.create({ data: {
    username: `economy-${color}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
  await prisma.systemVault.upsert({ where: { id: 1 }, create: { id: 1, balance: 100 }, update: { balance: 100 } });
  await prisma.vaultLog.deleteMany();
});
afterEach(async () => {
  const ids = [red.id, black.id];
  await prisma.gameRun.deleteMany({ where: { redPlayerId: { in: ids } } });
  await prisma.game.deleteMany({ where: { redPlayerId: { in: ids } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ids } } });
  await prisma.pendingPayout.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.systemVault.update({ where: { id: 1 }, data: { balance: 0 } });
});
function intent(changes = {}) {
  return { key: randomUUID(), redUserId: red.id, blackUserId: black.id, winner: 'red', mode: 'RANKED', buyIn: 0,
    moveHistory: [], startedAt: new Date(Date.now() - 180_000), endedAt: new Date(), endReason: 'resign', ...changes };
}
async function settleReserved(game) {
  await createGameRun({ key: game.key, redPlayerId: game.redUserId, blackPlayerId: game.blackUserId, mode: game.mode, buyIn: game.buyIn });
  return settleGame(game);
}
function tenMoves() {
  const game = new CheckersGame();
  for (let i = 0; i < 10; i++) {
    const m = game.getAllValidMoves()[0];
    game.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
  }
  return game.moveHistory;
}

it('settles concurrent duplicate requests once and returns the durable receipt on retry', async () => {
  const game = intent();
  const [first, duplicate] = await Promise.all([settleGame(game), settleGame(game)]);
  expect(duplicate).toEqual(first);
  expect(await settleGame(game)).toEqual(first);
  await expect(settleGame({ ...game, winner: 'black' })).rejects.toThrow('Settlement identity conflict');
  const row = await prisma.game.findUnique({ where: { settlementKey: game.key } });
  expect(row.id).toBe(first.replayId);
  expect(row.redCoinsEarned).toBe(12);
  expect(row.blackCoinsEarned).toBe(2);
  expect((await prisma.user.findUnique({ where: { id: red.id } }))).toMatchObject({ coins: 112, gamesPlayed: 1, wins: 1, elo: 1016 });
  expect((await prisma.user.findUnique({ where: { id: black.id } }))).toMatchObject({ coins: 102, gamesPlayed: 1, losses: 1, elo: 984 });
  expect(await prisma.coinTransaction.count({ where: { receiverId: red.id } })).toBe(2);
});

it('rolls the complete result back when the owning transaction fails, then retries cleanly', async () => {
  const game = intent();
  await expect(prisma.$transaction(async tx => { await settleGame(game, tx); throw new Error('interrupted commit'); })).rejects.toThrow('interrupted commit');
  expect(await prisma.game.findUnique({ where: { settlementKey: game.key } })).toBeNull();
  expect(await prisma.coinTransaction.count({ where: { receiverId: { in: [red.id, black.id] } } })).toBe(0);
  expect(await getVaultBalance()).toBe(100);
  expect(await prisma.user.findUnique({ where: { id: red.id } })).toMatchObject({ coins: 100, gamesPlayed: 0, elo: 1000, lastDailyWin: null });
  expect((await settleGame(game)).coinRewards.red).toBe(12);
});

it('includes both wager refunds in the actual wallet totals and recorded result', async () => {
  const result = await settleReserved(intent({ winner: null, buyIn: 20, endReason: 'draw-agreement' }));
  expect(result.coinRewards).toEqual({ red: 22, black: 22 });
  const row = await prisma.game.findUnique({ where: { id: result.replayId } });
  expect(row).toMatchObject({ redCoinsEarned: 22, blackCoinsEarned: 22 });
  expect((await prisma.user.findUnique({ where: { id: red.id } })).coins).toBe(102);
});

it('settles a valid wager pot, its tax, and rewards in the same transaction', async () => {
  const result = await settleReserved(intent({ buyIn: 20, moveHistory: tenMoves() }));
  expect(result.coinRewards).toMatchObject({ red: 50, black: 2, tax: 2, dailyBonus: 2 });
  expect(await getVaultBalance()).toBe(100); // two tax in, two bounty out
  expect(result.coinBreakdown.red.reduce((sum, line) => sum + line.amount, 0)).toBe(50);
});

it('uses the game end time for wager validity instead of time spent retrying', async () => {
  const result = await settleReserved(intent({ buyIn: 20, moveHistory: tenMoves(), startedAt: new Date(Date.now() - 180_000), endedAt: new Date(Date.now() - 179_000) }));
  expect(result.coinRewards).toMatchObject({ red: 32, black: 22, tax: 0 });
  expect(result.coinBreakdown.red.some(line => line.label === 'Wager refund')).toBe(true);
});

it('enforces the daily bot-win cap under simultaneous settlements, including guest winners', async () => {
  await prisma.user.update({ where: { id: red.id }, data: { isGuest: true, guestExpiresAt: new Date() } });
  await prisma.user.update({ where: { id: black.id }, data: { isBot: true } });
  const results = await Promise.all(Array.from({ length: BOT_WIN_DAILY_CAP + 2 }, () => settleGame(intent({ mode: 'FRIENDLY' }))));
  expect(results.reduce((n, r) => n + r.coinRewards.red, 0)).toBe(COINS_BOT_WIN * BOT_WIN_DAILY_CAP);
  expect(await prisma.coinTransaction.count({ where: { receiverId: red.id, reason: 'BOT_WIN' } })).toBe(BOT_WIN_DAILY_CAP);
  const user = await prisma.user.findUnique({ where: { id: red.id } });
  expect(user.gamesPlayed).toBe(BOT_WIN_DAILY_CAP + 2);
  expect(user.guestExpiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 86400_000);
});

it('queues one unpaid daily bounty, marks it earned, and rolls both back on failure', async () => {
  await prisma.systemVault.update({ where: { id: 1 }, data: { balance: 0 } });
  await expect(prisma.$transaction(async tx => { await awardDailyBounty(red.id, tx); throw new Error('abort'); })).rejects.toThrow('abort');
  expect(await prisma.pendingPayout.count({ where: { userId: red.id } })).toBe(0);
  expect((await prisma.user.findUnique({ where: { id: red.id } })).lastDailyWin).toBeNull();
  const outcomes = await Promise.all([awardDailyBounty(red.id), awardDailyBounty(red.id), awardDailyBounty(red.id)]);
  expect(outcomes.sort()).toEqual([-2, 0, 0]);
  expect(await prisma.pendingPayout.count({ where: { userId: red.id, reason: 'DAILY_BOUNTY' } })).toBe(1);
});

it('allows a new bounty at UTC midnight and consumes each milestone only once', async () => {
  await prisma.user.update({ where: { id: red.id }, data: { lastDailyWin: new Date('2026-09-10T23:59:59Z') } });
  expect(await awardDailyBounty(red.id, null, new Date('2026-09-11T00:00:00Z'))).toBe(2);
  expect(await awardDailyBounty(red.id, null, new Date('2026-09-11T12:00:00Z'))).toBe(0);
  await prisma.systemVault.update({ where: { id: 1 }, data: { balance: 0 } });
  const awarded = await Promise.all([checkMilestones(red.id, 1200), checkMilestones(red.id, 1200)]);
  expect(awarded.flat()).toHaveLength(1);
  expect(awarded.flat()[0]).toMatchObject({ pending: true, reward: 10 });
  expect(await prisma.pendingPayout.count({ where: { userId: red.id, reason: 'ACHIEVEMENT' } })).toBe(1);
});

it('pays a claimed payout exactly once and cannot overdraw a shared vault for different claimants', async () => {
  await prisma.systemVault.update({ where: { id: 1 }, data: { balance: 10 } });
  const payouts = await Promise.all([red.id, black.id].map(userId => prisma.pendingPayout.create({ data: { userId, amount: 10, reason: 'ACHIEVEMENT' } })));
  const results = await Promise.all([claimPendingPayout(payouts[0].id, red.id), claimPendingPayout(payouts[0].id, red.id), claimPendingPayout(payouts[1].id, black.id)]);
  expect(results[0]).toEqual(results[1]);
  expect([results[0], results[2]].filter(r => r.success)).toHaveLength(1);
  expect(await getVaultBalance()).toBe(0);
  expect(await prisma.pendingPayout.count({ where: { userId: { in: [red.id, black.id] }, claimedAt: null } })).toBe(1);
  expect(await prisma.coinTransaction.count({ where: { receiverId: { in: [red.id, black.id] }, reason: 'ACHIEVEMENT' } })).toBe(1);
});

it('cannot overspend an account through simultaneous conditional debits', async () => {
  const results = await Promise.allSettled([deductCoins(red.id, 80, 'PURCHASE'), deductCoins(red.id, 80, 'PURCHASE')]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await prisma.user.findUnique({ where: { id: red.id } })).coins).toBe(20);
  expect(await prisma.coinTransaction.count({ where: { receiverId: red.id } })).toBe(1);
  expect(() => deductCoins(red.id, -10, 'PURCHASE')).toThrow('Invalid coin amount');
  expect(calculateShopSplit(0)).toEqual({ burned: 0, toVault: 0 });
});

it('uses one vault for concurrent deposits and rolls back a deposit with its owning operation', async () => {
  await Promise.all([depositToVault(5, 'test'), depositToVault(7, 'test')]);
  expect(await getVaultBalance()).toBe(112);
  expect(await prisma.systemVault.count()).toBe(1);
  await expect(prisma.$transaction(async tx => { await depositToVault(10, 'rolled-back', undefined, tx); throw new Error('abort'); })).rejects.toThrow('abort');
  expect(await getVaultBalance()).toBe(112);
  expect(await prisma.vaultLog.count({ where: { reason: 'rolled-back' } })).toBe(0);
});
