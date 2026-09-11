import { randomUUID } from 'node:crypto';
import prisma from '../server/db.js';
import { startGameplayOwnership, gameplayOwner, claimGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createGameRun, abortGameStart } from '../server/services/gameRuns.js';
import { createRoomRecord, commitRoomRecord } from '../server/services/roomRecords.js';
import { createResultRecord, commitResultCommand, reserveResultRematch, cancelResultRematch, ResultRevisionConflict } from '../server/services/resultRecords.js';
import { commitGameTransition } from '../server/services/gameTransitions.js';
import { settleQueuedGame } from '../server/services/settlementRecovery.js';
import { retireExpiredGuest } from '../server/services/guestCleanup.js';
import { encodeCheckpoint } from '../server/domain/gameCheckpoint.js';
import { CheckersGame } from '../shared/game.js';
import { GAME_OVER_LINGER_MS } from '../shared/constants.js';

let users, runs, rooms;
const settings = { buyIn: 0, turnTimer: 60, isPrivate: false, allowSpectators: true, autoReady: false };
beforeEach(async () => {
  await startGameplayOwnership(); runs = []; rooms = [];
  users = await Promise.all([0,1,2,3].map(i => prisma.user.create({ data: {
    username: `result-${i}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
});
afterEach(async () => {
  vi.restoreAllMocks();
  const all = await prisma.gameRun.findMany({ where: { OR: [{ redPlayerId: { in: users.map(p => p.id) } }, { blackPlayerId: { in: users.map(p => p.id) } }] } });
  const keys = all.map(r => r.key);
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.roomRecord.deleteMany({ where: { id: { in: rooms } } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: users.map(p => p.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(p => p.id) } } });
});
async function create(changes = {}) {
  const run = await createGameRun({ key: randomUUID(), redPlayerId: users[0].id, blackPlayerId: users[1].id,
    mode: 'FRIENDLY', turnTime: 60, ...changes });
  runs.push(run); return run;
}
function terminal(run, endedAt = Date.now()) {
  const game = new CheckersGame(run.turnTime); game.gameOver = true; game.winner = null;
  return encodeCheckpoint({ game, started: true, startedAt: new Date(endedAt - 1000), endedAt,
    endReason: 'draw-agreement', revealAcks: new Set([run.redPlayerId, run.blackPlayerId]), revealDeadline: endedAt - 1,
    pendingDrawOffer: null, lastDrawOffer: {} });
}
async function finish(run, endedAt) {
  await commitGameTransition({ key: run.key, expectedRevision: run.revision }, () => terminal(run, endedAt));
  return createResultRecord(run.id);
}
async function command(record, type, index = 0, changes = {}) {
  return (await commitResultCommand({ gameRunId: record.gameRunId, expectedRevision: record.revision,
    action: { type, ...(type === 'expire' ? {} : { userId: users[index].id }) }, ...changes })).result;
}
async function ready(record) {
  record = await command(record, 'request-rematch');
  return record.status === 'STARTING' ? record : command(record, 'request-rematch', 1);
}
async function withSpectator(afterResult = async () => {}, beforeFinish = async () => {}) {
  let room = await createRoomRecord({ creatorId: users[0].id, key: randomUUID(), joinCode: 'RESULT', settings }); rooms.push(room.id);
  room = (await commitRoomRecord({ roomId: room.id, expectedRevision: 0 }, draft => {
    draft.players[0].ready = true; draft.players.push({ userId: users[1].id, ready: true, online: true });
    draft.spectators.push({ userId: users[2].id, online: false, disconnectDeadline: Date.now() + 20000 });
  })).room;
  const key = randomUUID();
  room = (await commitRoomRecord({ roomId: room.id, expectedRevision: room.revision }, draft => {
    draft.status = 'STARTING'; draft.startAttempt = { key, players: [users[0].id, users[1].id] };
  })).room;
  const run = await create({ key, roomId: room.id, mode: 'RANKED' });
  room = await prisma.roomRecord.findUnique({ where: { id: room.id } });
  await beforeFinish({ room, run });
  await commitGameTransition({ key: run.key, expectedRevision: run.revision }, () => terminal(run));
  room = await prisma.roomRecord.findUnique({ where: { id: room.id } });
  await afterResult({ room, run });
  const record = await createResultRecord(run.id);
  room = await prisma.roomRecord.findUnique({ where: { id: room.id } });
  return { record, room, run };
}

it('initializes once from a terminal checkpoint without extending the accepted result deadline', async () => {
  const run = await create(), endedAt = Date.now() - 10000;
  await expect(createResultRecord(run.id)).rejects.toThrow(/terminal checkpoint/);
  const first = await finish(run, endedAt), repeated = await createResultRecord(run.id);
  expect(repeated).toEqual(first); expect(first.state.deadline).toBe(endedAt + GAME_OVER_LINGER_MS);
  expect(await prisma.activeResultViewer.count({ where: { gameRunId: run.id } })).toBe(2);
});

it('can commit or roll back the terminal checkpoint, settlement intent and result membership together', async () => {
  const run = await create();
  await expect(prisma.$transaction(async tx => {
    await commitGameTransition({ key: run.key, expectedRevision: 0 }, () => terminal(run), tx);
    await createResultRecord(run.id, tx);
    throw Error('rollback');
  })).rejects.toThrow(/rollback/);
  expect((await prisma.gameRun.findUnique({ where: { id: run.id } })).checkpoint).toBeNull();
  expect(await prisma.gameResultRecord.findUnique({ where: { gameRunId: run.id } })).toBeNull();
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: run.id } })).toBe(2);
  expect(await prisma.activeResultViewer.count({ where: { gameRunId: run.id } })).toBe(0);
});

it('preserves spectator context and its earlier disconnect deadline, and rejects late spectator admission', async () => {
  const { record, room, run } = await withSpectator(async ({ room }) => {
    await expect(commitRoomRecord({ roomId: room.id, expectedRevision: room.revision }, draft => {
      draft.spectators.push({ userId: users[3].id, online: true });
    })).rejects.toThrow('Invalid room transition');
  });
  expect(record.state.spectators).toEqual([{ userId: users[2].id, roomId: Number(room.id), deadline: room.state.spectators[0].disconnectDeadline }]);
  expect(room.status).toBe('CLOSED');
  expect(await prisma.activeRoomMember.count({ where: { roomId: room.id } })).toBe(0);
  expect(await prisma.activeResultViewer.count({ where: { gameRunId: run.id } })).toBe(3);
  const expired = await command(record, 'expire', 0, { now: record.state.spectators[0].deadline });
  expect(expired.state.players.every(p => p.viewing)).toBe(true); expect(expired.state.spectators).toHaveLength(0);
  expect(await prisma.sessionNotice.count({ where: { userId: users[2].id, effectKey: `game:${run.id}:expired` } })).toBe(1);
});

it('rolls back source-room closure with result initialization and spectator-claim transfer', async () => {
  await withSpectator(undefined, async ({ room, run }) => {
    await expect(prisma.$transaction(async tx => { await commitGameTransition({ key: run.key, expectedRevision: run.revision }, () => terminal(run), tx); throw Error('rollback result handoff'); })).rejects.toThrow(/rollback result handoff/);
    expect((await prisma.roomRecord.findUnique({ where: { id: room.id } })).status).toBe('PLAYING');
    expect(await prisma.activeRoomMember.count({ where: { roomId: room.id } })).toBe(1);
    expect(await prisma.activeResultViewer.count({ where: { gameRunId: run.id } })).toBe(0);
    expect(await prisma.gameResultRecord.findUnique({ where: { gameRunId: run.id } })).toBeNull();
  });
});

it('refuses to invent viewers from a source room that closed without a result record', async () => {
  await expect(withSpectator(async ({ run }) => {
    // Model a legacy terminal room without a durable result/viewer record.
    await prisma.gameResultRecord.delete({ where: { gameRunId: run.id } });
  })).rejects.toThrow(/membership cannot be inferred/);
});

it('does not restore dismissed viewers on retry and prevents a rematch when the opponent left', async () => {
  const run = await create(); let record = await finish(run);
  record = await command(record, 'dismiss', 1);
  expect((await createResultRecord(run.id)).state.players[1].viewing).toBe(false);
  await expect(command(record, 'request-rematch')).rejects.toThrow(/opponent has left/);
  expect(await prisma.sessionNotice.count({ where: { userId: users[1].id } })).toBe(0);
});

it('deduplicates exact commands before revision checks and rejects changed identities', async () => {
  const record = await finish(await create()), request = { userId: users[0].id, key: randomUUID() };
  const input = { gameRunId: record.gameRunId, expectedRevision: record.revision, action: { type: 'request-rematch', userId: users[0].id }, command: request };
  const first = await commitResultCommand(input);
  const newer = await command(first.result, 'request-rematch', 1);
  const repeated = await commitResultCommand(input);
  expect(repeated).toMatchObject({ duplicate: true, commandRevision: first.result.revision, result: { revision: newer.revision, status: 'STARTING' } });
  await expect(commitResultCommand({ ...input, action: { type: 'dismiss', userId: users[0].id } })).rejects.toThrow(/identity conflict/);
});

it('serializes competing result transitions without losing a request or dismissal', async () => {
  const record = await finish(await create());
  const attempts = await Promise.allSettled([command(record, 'request-rematch'), command(record, 'dismiss', 1)]);
  expect(attempts.filter(p => p.status === 'fulfilled')).toHaveLength(1);
  expect(attempts.find(p => p.status === 'rejected').reason).toBeInstanceOf(ResultRevisionConflict);
});

it('creates one rematch with swapped colours and transfers player claims atomically', async () => {
  const original = await create();
  await prisma.gameRun.update({ where: { id: original.id }, data: { invitedPlayerIds: [users[1].id] } });
  const record = await ready(await finish(original));
  const children = await Promise.all(Array.from({ length: 6 }, () => reserveResultRematch(record.gameRunId)));
  expect(new Set(children.map(p => p.id)).size).toBe(1);
  expect(children[0]).toMatchObject({ redPlayerId: users[1].id, blackPlayerId: users[0].id, buyIn: 0, resultSourceId: record.gameRunId });
  expect(children[0].invitedPlayerIds).toEqual([]); // A rematch is not another link conversion.
  expect(await prisma.activeResultViewer.count({ where: { gameRunId: record.gameRunId } })).toBe(0);
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: children[0].id } })).toBe(2);
  expect((await prisma.gameResultRecord.findUnique({ where: { gameRunId: record.gameRunId } })).state.rematch.gameId).toBe(children[0].id);
});

it('rolls back rematch creation and result-claim transfer together', async () => {
  const record = await ready(await finish(await create()));
  await expect(prisma.$transaction(async tx => { await reserveResultRematch(record.gameRunId, tx); throw Error('rollback'); })).rejects.toThrow(/rollback/);
  expect(await prisma.gameRun.findUnique({ where: { key: record.state.rematch.key } })).toBeNull();
  expect(await prisma.activeResultViewer.count({ where: { gameRunId: record.gameRunId } })).toBe(2);
  expect((await prisma.gameResultRecord.findUnique({ where: { gameRunId: record.gameRunId } })).status).toBe('STARTING');
});

it('aborts an uninstalled rematch once, restores result viewers and resets consent without extending the deadline', async () => {
  const record = await ready(await finish(await create())); const child = await reserveResultRematch(record.gameRunId);
  await abortGameStart(child.key); await abortGameStart(child.key);
  const restored = await prisma.gameResultRecord.findUnique({ where: { gameRunId: record.gameRunId } });
  expect(restored).toMatchObject({ status: 'OPEN', state: { deadline: record.state.deadline, rematch: null } });
  expect(restored.state.players.every(p => p.viewing && !p.requested)).toBe(true);
  expect(await prisma.activeResultViewer.count({ where: { gameRunId: record.gameRunId } })).toBe(2);
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: child.id } })).toBe(0);
  const retry = await ready(restored); expect(retry.state.rematch.key).not.toBe(child.key);
});

it('expires result viewers when cancellation finishes after the original deadline', async () => {
  const record = await ready(await finish(await create())); const child = await reserveResultRematch(record.gameRunId);
  const result = await cancelResultRematch(record.gameRunId, null, gameplayOwner(), { now: record.state.deadline });
  expect(result.status).toBe('CLOSED');
  expect(await prisma.activeResultViewer.count({ where: { gameRunId: record.gameRunId } })).toBe(0);
  expect(await prisma.sessionNotice.count({ where: { effectKey: `game:${record.gameRunId}:expired` } })).toBe(2);
  expect((await prisma.gameRun.findUnique({ where: { id: child.id } })).status).toBe('ABORTED');
});

it('requires cancellation before departure during accepted rematch setup and refuses to undo started play', async () => {
  let record = await ready(await finish(await create()));
  await expect(command(record, 'dismiss')).rejects.toThrow(/Resolve the rematch/);
  record = await cancelResultRematch(record.gameRunId);
  expect(record.status).toBe('OPEN');
  record = await ready(record); const child = await reserveResultRematch(record.gameRunId);
  const checkpoint = terminal(child); checkpoint.engine.gameOver = false; checkpoint.endedAt = null;
  await commitGameTransition({ key: child.key, expectedRevision: 0 }, () => checkpoint);
  await expect(cancelResultRematch(record.gameRunId)).rejects.toThrow(/started game/);
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: child.id } })).toBe(2);
});

it('treats a bot as consenting automatically without allocating it a result claim', async () => {
  users[1] = await prisma.user.update({ where: { id: users[1].id }, data: { isBot: true } });
  const record = await finish(await create({ origin: 'bot' }));
  expect(record.state.players[1]).toMatchObject({ viewing: false, requested: true });
  const accepted = await command(record, 'request-rematch'); expect(accepted.status).toBe('STARTING');
  const child = await reserveResultRematch(record.gameRunId);
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: child.id } })).toBe(1);
});

it('blocks unrelated game and room admission until a human dismisses the result', async () => {
  let record = await finish(await create());
  await expect(create({ blackPlayerId: users[2].id })).rejects.toThrow(/finished result/);
  await expect(createRoomRecord({ creatorId: users[0].id, key: randomUUID(), joinCode: 'RESNEW', settings })).rejects.toThrow(/finished result/);
  record = await command(record, 'dismiss');
  const run = await create({ blackPlayerId: users[2].id }); expect(run.id).not.toBe(record.gameRunId);
});

it('retains guest accounts with result claims even after settlement and without runtime sessions', async () => {
  users[0] = await prisma.user.update({ where: { id: users[0].id }, data: { isGuest: true, coins: 0, guestExpiresAt: new Date(Date.now() + 5000) } });
  const run = await create(); const record = await finish(run); await settleQueuedGame(run.key);
  await prisma.user.update({ where: { id: users[0].id }, data: { coins: 0, guestExpiresAt: new Date(Date.now() - 1) } });
  expect(await retireExpiredGuest(users[0].id, { isActive: () => false })).toBe('protected');
  await command(record, 'dismiss');
  expect(await retireExpiredGuest(users[0].id, { isActive: () => false })).toBe('retired');
});

it('rejects obsolete ownership, unsupported versions and malformed stored result state', async () => {
  const record = await finish(await create());
  await prisma.gameResultRecord.update({ where: { gameRunId: record.gameRunId }, data: { stateVersion: 99 } });
  await expect(command(record, 'dismiss')).rejects.toThrow(/unsupported result/);
  await prisma.gameResultRecord.update({ where: { gameRunId: record.gameRunId }, data: { stateVersion: 1, state: { ...record.state, deadline: record.state.deadline + 1 } } });
  await expect(command(record, 'dismiss')).rejects.toThrow(/Invalid result state/);
  const stale = gameplayOwner(); await claimGameplayOwnership();
  await expect(createResultRecord(record.gameRunId, null, stale)).rejects.toThrow(/newer server owns/);
});
