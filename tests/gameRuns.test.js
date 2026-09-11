import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import prisma from '../server/db.js';
import { gameplayOwner, startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createGameRun, abortGameStart } from '../server/services/gameRuns.js';
import { settleGame } from '../server/services/gameSettlement.js';
import { enqueueSettlement } from '../server/services/settlementRecovery.js';
import { tipFriend } from '../server/services/walletActions.js';

beforeAll(() => startGameplayOwnership());
let red, black, keys;
beforeEach(async () => {
  keys = [];
  [red, black] = await Promise.all(['r', 'b'].map(c => prisma.user.create({ data: {
    username: `creation-${c}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
});
afterEach(async () => {
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: [red.id, black.id] } } });
  await prisma.friendship.deleteMany({ where: { requesterId: red.id } });
  await prisma.user.deleteMany({ where: { id: { in: [red.id, black.id] } } });
});
function creation(changes = {}) {
  const input = { key: randomUUID(), redPlayerId: red.id, blackPlayerId: black.id, mode: 'RANKED', buyIn: 20, turnTime: 60, origin: 'room', ...changes };
  keys.push(input.key); return input;
}
function terminal(input, changes = {}) {
  return { key: input.key, redUserId: input.redPlayerId, blackUserId: input.blackPlayerId, mode: input.mode, buyIn: input.buyIn,
    winner: null, moveHistory: [], startedAt: new Date(Date.now() - 1000), endedAt: new Date(), endReason: 'draw-agreement', ...changes };
}
async function balances() {
  const users = await prisma.user.findMany({ where: { id: { in: [red.id, black.id] } }, orderBy: { id: 'asc' } });
  return [red.id, black.id].map(id => users.find(u => u.id === id).coins);
}

it('commits the initial game and both stakes once under concurrent/repeated creation', async () => {
  const input = creation();
  const [a, b] = await Promise.all([createGameRun(input), createGameRun(input)]);
  expect(b).toEqual(a); expect(await createGameRun(input)).toEqual(a);
  expect(Number.isSafeInteger(a.id)).toBe(true);
  expect(a.initialState).toMatchObject({ currentPlayer: 'red', chainPiece: null, moveHistory: [], redTime: 60, blackTime: 60 });
  expect(a.initialState.board.flat().filter(Boolean)).toHaveLength(24);
  expect(await balances()).toEqual([80, 80]);
  expect(await prisma.coinTransaction.findMany({ where: { receiverId: { in: [red.id, black.id] } } })).toHaveLength(2);
  await expect(createGameRun({ ...input, buyIn: 30 })).rejects.toThrow('identity conflict');
});

it('rolls back both reservations if the second participant cannot afford the wager', async () => {
  await prisma.user.update({ where: { id: black.id }, data: { coins: 10 } });
  const input = creation();
  await expect(createGameRun(input)).rejects.toThrow('Insufficient');
  expect(await balances()).toEqual([100, 10]);
  expect(await prisma.gameRun.findUnique({ where: { key: input.key } })).toBeNull();
  expect(await prisma.coinTransaction.count({ where: { receiverId: red.id } })).toBe(0);
});

it('rolls back a failed creation commit and accepts its original retry', async () => {
  const input = creation();
  await expect(prisma.$transaction(async tx => { await createGameRun(input, tx); throw Error('commit failed'); })).rejects.toThrow('commit failed');
  expect(await balances()).toEqual([100, 100]);
  expect(await prisma.gameRun.findUnique({ where: { key: input.key } })).toBeNull();
  await createGameRun(input);
  expect(await balances()).toEqual([80, 80]);
});

it('retains the reservation after abrupt process exit and confirms it without another debit', async () => {
  const input = creation();
  await expect(promisify(execFile)(process.execPath, ['tests/fixtures/game-creation-worker.js', JSON.stringify({ input, owner: gameplayOwner() })], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }, windowsHide: true, timeout: 15_000
  })).rejects.toMatchObject({ code: 25 });
  const persisted = await prisma.gameRun.findUnique({ where: { key: input.key } });
  expect(persisted.status).toBe('OPEN');
  expect((await createGameRun(input)).id).toBe(persisted.id);
  expect(await balances()).toEqual([80, 80]);
});

it('refunds an uninstalled start atomically and confirms duplicate aborts without repayment', async () => {
  const input = creation(); await createGameRun(input);
  await expect(prisma.$transaction(async tx => { await abortGameStart(input.key, tx); throw Error('commit failed'); })).rejects.toThrow('commit failed');
  expect(await balances()).toEqual([80, 80]);
  const [a, b] = await Promise.all([abortGameStart(input.key), abortGameStart(input.key)]);
  expect(a).toEqual(b); expect(a.status).toBe('ABORTED');
  expect(await balances()).toEqual([100, 100]);
  expect(await prisma.coinTransaction.count({ where: { receiverId: red.id, reason: 'WAGER_REFUND' } })).toBe(1);
  await expect(settleGame(terminal(input))).rejects.toThrow('reservation identity');
  expect((await createGameRun(input)).status).toBe('ABORTED'); // never recharges a closed identity
});

it('closes the reservation with settlement and rejects a mismatched or unreserved wager', async () => {
  const unreserved = creation();
  await expect(settleGame(terminal(unreserved))).rejects.toThrow('no durable reservation');
  const input = creation(); await createGameRun(input);
  await expect(settleGame(terminal(input, { buyIn: 30 }))).rejects.toThrow('reservation identity');
  const result = await settleGame(terminal(input));
  expect(await balances()).toEqual([102, 102]); // returned stake plus draw consolation
  expect(await prisma.gameRun.findUnique({ where: { key: input.key } })).toMatchObject({ status: 'SETTLED', replayId: result.replayId, closedAt: expect.any(Date) });
  await expect(abortGameStart(input.key)).rejects.toThrow('settled');
});

it('does not refund a reservation already awaiting terminal settlement', async () => {
  const input = creation(); await createGameRun(input); await enqueueSettlement(terminal(input));
  await expect(abortGameStart(input.key)).rejects.toThrow('terminal');
  expect(await balances()).toEqual([80, 80]);
});

it('rolls reservation closure back with a failed settlement transaction, then refunds once', async () => {
  const input = creation(); await createGameRun(input);
  const result = terminal(input);
  await expect(prisma.$transaction(async tx => { await settleGame(result, tx); throw Error('settlement commit failed'); })).rejects.toThrow('settlement commit failed');
  expect((await prisma.gameRun.findUnique({ where: { key: input.key } })).status).toBe('OPEN');
  expect(await balances()).toEqual([80, 80]);
  expect(await prisma.coinTransaction.count({ where: { receiverId: red.id, reason: 'WAGER_REFUND' } })).toBe(0);
  await settleGame(result); await settleGame(result);
  expect(await balances()).toEqual([102, 102]);
  expect(await prisma.coinTransaction.count({ where: { receiverId: red.id, reason: 'WAGER_REFUND' } })).toBe(1);
});

it('serializes a wager against concurrent wallet spending', async () => {
  await prisma.friendship.create({ data: { requesterId: red.id, receiverId: black.id, status: 'ACCEPTED' } });
  const result = await Promise.allSettled([
    createGameRun(creation({ buyIn: 80 })),
    tipFriend(red.id, { receiverId: black.id, amount: 80, requestId: randomUUID() })
  ]);
  expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await prisma.user.findUnique({ where: { id: red.id } })).coins).toBe(20);
});

it('does not create stakes for a free bot game and rejects ranked guest/bot participation', async () => {
  await prisma.user.update({ where: { id: black.id }, data: { isBot: true } });
  await expect(createGameRun(creation())).rejects.toThrow('registered human');
  const input = creation({ mode: 'FRIENDLY', buyIn: 0, origin: 'bot' });
  await createGameRun(input);
  expect(await balances()).toEqual([100, 100]);
  expect(await prisma.coinTransaction.count({ where: { receiverId: red.id } })).toBe(0);
  expect(() => createGameRun(creation({ mode: 'FRIENDLY', buyIn: 1 }))).toThrow('ranked');
});
