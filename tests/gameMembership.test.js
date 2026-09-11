import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import prisma from '../server/db.js';
import { startGameplayOwnership, gameplayOwner, claimGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createGameRun, abortGameStart } from '../server/services/gameRuns.js';
import { GameMembershipConflict, restoreGamePlayers } from '../server/services/gameMembership.js';
import { commitResultCommand } from '../server/services/resultRecords.js';
import { commitGameTransition } from '../server/services/gameTransitions.js';
import { settleQueuedGame } from '../server/services/settlementRecovery.js';
import { encodeCheckpoint } from '../server/domain/gameCheckpoint.js';
import { activeGames, restoreActiveGames, stopGameRuntime } from '../server/domain/games.js';
import { getAllSessions, removeSession } from '../server/domain/sessions.js';
import { CheckersGame } from '../shared/game.js';

let users, keys;
beforeEach(async () => {
  await startGameplayOwnership(); keys = [];
  users = await Promise.all(['r', 'b', 'c', 'bot'].map(name => prisma.user.create({ data: {
    username: `membership-${name}-${randomUUID()}`, friendCode: randomUUID(), coins: 100, isBot: name === 'bot'
  } })));
});
afterEach(async () => {
  await stopGameRuntime(); activeGames.clear();
  for (const id of getAllSessions().keys()) removeSession(id);
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: users.map(u => u.id) } } });
  await prisma.pendingPayout.deleteMany({ where: { userId: { in: users.map(u => u.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
});
function input(changes = {}) {
  const key = randomUUID(); keys.push(key);
  return { key, redPlayerId: users[0].id, blackPlayerId: users[1].id, mode: 'RANKED', buyIn: 20, ...changes };
}
function checkpoint(run, terminal = false) {
  const game = new CheckersGame(60);
  game.gameOver = terminal; game.winner = terminal ? 'red' : null;
  return encodeCheckpoint({ game, started: true, startedAt: new Date(), endedAt: terminal ? Date.now() : null,
    endReason: terminal ? 'resign' : null, revealAcks: new Set([run.redPlayerId, run.blackPlayerId]), revealDeadline: 1,
    pendingDrawOffer: null, lastDrawOffer: {} });
}
async function seat(user = users[0]) { return prisma.activeGamePlayer.findUnique({ where: { userId: user.id } }); }

it('permits one racing game per human across colours and opponents without a second stake debit', async () => {
  const first = input(), second = input({ redPlayerId: users[2].id, blackPlayerId: users[0].id });
  const outcomes = await Promise.allSettled([createGameRun(first), createGameRun(second)]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.find(result => result.status === 'rejected').reason).toBeInstanceOf(GameMembershipConflict);
  const run = outcomes.find(result => result.status === 'fulfilled').value;
  expect(await seat()).toMatchObject({ gameRunId: run.id });
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: run.id } })).toBe(2);
  expect(await prisma.gameRun.count({ where: { key: { in: keys } } })).toBe(1);
  expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
  expect(await prisma.coinTransaction.count({ where: { receiverId: { in: users.map(u => u.id) }, reason: 'WAGER_STAKE' } })).toBe(2);
});

it('retains the database uniqueness constraint even when an insertion bypasses the availability check', async () => {
  const first = await createGameRun(input());
  const second = await createGameRun(input({ redPlayerId: users[2].id, blackPlayerId: users[3].id, mode: 'BOT', buyIn: 0 }));
  await expect(prisma.activeGamePlayer.create({ data: { userId: users[0].id, gameRunId: second.id } })).rejects.toMatchObject({ code: 'P2002' });
  expect((await seat()).gameRunId).toBe(first.id);
});

it('keeps a committed claim after creator process exit, confirms its retry, and rejects another identity', async () => {
  const creation = input();
  await expect(promisify(execFile)(process.execPath, ['tests/fixtures/game-creation-worker.js', JSON.stringify({ input: creation, owner: gameplayOwner() })], {
    env: { ...process.env }, windowsHide: true, timeout: 15_000
  })).rejects.toMatchObject({ code: 25 });
  const run = await createGameRun(creation);
  expect((await seat()).gameRunId).toBe(run.id);
  await expect(createGameRun(input())).rejects.toBeInstanceOf(GameMembershipConflict);
  expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
});

it('allows one bot in simultaneous human games while reserving guest and registered human seats', async () => {
  await prisma.user.update({ where: { id: users[2].id }, data: { isGuest: true } });
  const runs = await Promise.all(users.slice(0, 3).map(user => createGameRun(input({
    redPlayerId: user.id, blackPlayerId: users[3].id, mode: 'BOT', buyIn: 0
  }))));
  expect(await seat(users[3])).toBeNull();
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: { in: runs.map(run => run.id) } } })).toBe(3);
  await expect(createGameRun(input({ redPlayerId: users[2].id, blackPlayerId: users[3].id, mode: 'BOT', buyIn: 0 }))).rejects.toBeInstanceOf(GameMembershipConflict);
});

it('rolls a terminal release back with its checkpoint/job and never releases the next game during delayed settlement', async () => {
  const first = await createGameRun(input());
  const options = { key: first.key, expectedRevision: 0 };
  await expect(prisma.$transaction(async tx => {
    await commitGameTransition(options, () => checkpoint(first, true), tx); throw Error('terminal rollback');
  })).rejects.toThrow('terminal rollback');
  expect((await seat()).gameRunId).toBe(first.id);
  expect(await prisma.gameSettlementJob.findUnique({ where: { key: first.key } })).toBeNull();
  await commitGameTransition(options, () => checkpoint(first, true));
  expect(await seat()).toBeNull();
  for (const [revision, player] of users.slice(0, 2).entries()) await commitResultCommand({
    gameRunId: first.id, expectedRevision: revision, action: { type: 'dismiss', userId: player.id }
  });
  const next = await createGameRun(input({ redPlayerId: users[1].id, blackPlayerId: users[0].id }));
  await settleQueuedGame(first.key); await settleQueuedGame(first.key);
  expect((await seat()).gameRunId).toBe(next.id);
  expect((await seat(users[1])).gameRunId).toBe(next.id);
  expect((await createGameRun({ key: first.key, redPlayerId: first.redPlayerId, blackPlayerId: first.blackPlayerId, mode: first.mode, buyIn: first.buyIn })).status).toBe('SETTLED');
  expect((await seat()).gameRunId).toBe(next.id);
});

it('cancels/refunds/releases atomically and does not let an old abort retry erase the replacement claim', async () => {
  const first = await createGameRun(input());
  await expect(prisma.$transaction(async tx => { await abortGameStart(first.key, tx); throw Error('abort rollback'); })).rejects.toThrow('abort rollback');
  expect((await seat()).gameRunId).toBe(first.id);
  expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
  await abortGameStart(first.key);
  expect(await seat()).toBeNull();
  const next = await createGameRun(input());
  await abortGameStart(first.key);
  expect((await seat()).gameRunId).toBe(next.id);
  expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
});

it('rebuilds missing claims and removes stale terminal claims before startup restoration becomes available', async () => {
  const live = await createGameRun(input());
  await commitGameTransition({ key: live.key, expectedRevision: 0 }, () => checkpoint(live));
  const terminal = await createGameRun(input({ redPlayerId: users[2].id, blackPlayerId: users[3].id, mode: 'BOT', buyIn: 0 }));
  await commitGameTransition({ key: terminal.key, expectedRevision: 0 }, () => checkpoint(terminal, true));
  // Simulate an older binary whose writes did not maintain the new claim table.
  await prisma.activeGamePlayer.deleteMany({ where: { gameRunId: live.id } });
  await prisma.activeGamePlayer.create({ data: { userId: users[2].id, gameRunId: terminal.id } });
  await prisma.activeGamePlayer.create({ data: { userId: users[3].id, gameRunId: live.id } });
  await restoreActiveGames();
  expect((await seat()).gameRunId).toBe(live.id); expect(await seat(users[2])).toBeNull();
  expect(await seat(users[3])).toBeNull();
  await expect(createGameRun(input())).rejects.toBeInstanceOf(GameMembershipConflict);
});

it('fences restoration so an obsolete owner cannot rebuild or clear the current claims', async () => {
  const owner = gameplayOwner(), run = await createGameRun(input());
  await claimGameplayOwnership();
  await expect(restoreGamePlayers([], owner)).rejects.toThrow('newer server');
  expect((await seat()).gameRunId).toBe(run.id);
});
