import { randomUUID } from 'node:crypto';
import prisma from '../server/db.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { commitResultCommand, reserveResultRematch } from '../server/services/resultRecords.js';
import { commitGameTransition } from '../server/services/gameTransitions.js';
import { encodeCheckpoint } from '../server/domain/gameCheckpoint.js';
import { GAME_OVER_LINGER_MS } from '../shared/constants.js';
import { createGameDirect, createGameActions, activeGames, stopGameRuntime, restoreActiveGames, restoreFinishedGames } from '../server/domain/games.js';
import { createRoomActions, gameRooms, stopRoomRuntime } from '../server/domain/rooms.js';
import { restoreRooms } from '../server/domain/roomRestoration.js';
import { acceptRoomRecord } from '../server/domain/roomRuntime.js';
import { runGameplayWork } from '../server/services/gameplayWork.js';
import { reconcileResultUser } from '../server/domain/resultRuntime.js';
import { getSession, getOrCreateSession, getAllSessions, removeSession } from '../server/domain/sessions.js';
import { startGameplayServer } from './helpers/gameplayServer.js';
import { PROTOCOL_VERSION } from '../shared/protocol.js';

let players, releaseGates;
const actor = i => ({ userId: players[i].id, connectionId: `result-socket-${i}` });
const actions = i => createGameActions(actor(i));
const rooms = i => createRoomActions(actor(i));
const request = () => ({ id: randomUUID() });
const connect = i => { const p = players[i]; getOrCreateSession(p.id, p.username, p.isGuest).connectionId = actor(i).connectionId; };
async function clearRuntime() {
  await Promise.all([stopGameRuntime(), stopRoomRuntime()]);
  activeGames.clear(); gameRooms.clear();
  for (const id of getAllSessions().keys()) removeSession(id);
}
beforeEach(async () => {
  await startGameplayOwnership(); releaseGates = [];
  players = await Promise.all([0,1,2].map(i => prisma.user.create({ data: {
    username: `result-live-${i}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
  players.forEach((_,i) => connect(i));
});
afterEach(async () => {
  releaseGates.forEach(release => release()); vi.restoreAllMocks();
  await clearRuntime();
  const ids = players.map(p => p.id);
  const runs = await prisma.gameRun.findMany({ where: { OR: [{ redPlayerId: { in: ids } }, { blackPlayerId: { in: ids } }] } });
  const keys = runs.map(r => r.key);
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.roomRecord.deleteMany({ where: { creatorId: { in: ids } } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ids } } });
  await prisma.pendingPayout.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});
async function finished() {
  const game = await createGameDirect(players[0].id, players[1].id, 'FRIENDLY', 0, 0);
  await game.endGame('red', 'resign'); return game;
}
async function restart() {
  await clearRuntime(); await startGameplayOwnership();
  await restoreActiveGames(); await restoreRooms(); await restoreFinishedGames();
}
async function consent(game, i) { return actions(i)['game:rematch-request']({ gameId: game.id }, request()); }
const record = id => prisma.gameResultRecord.findUniqueOrThrow({ where: { gameRunId: id } });
function pauseAfter(predicate) {
  const original = prisma.$transaction;
  let release, entered, paused = false;
  const inside = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; }); releaseGates.push(release);
  vi.spyOn(prisma, '$transaction').mockImplementation(async function (...args) {
    const result = await original.apply(this, args);
    if (!paused && predicate(result)) { paused = true; entered(); await gate; }
    return result;
  });
  return { inside, release };
}
function loseResponse(predicate) {
  const original = prisma.$transaction; let lost = false;
  vi.spyOn(prisma, '$transaction').mockImplementation(async function (...args) {
    const result = await original.apply(this, args);
    if (!lost && predicate(result)) { lost = true; throw Error('Committed response lost'); }
    return result;
  });
  return () => lost;
}

it('restores only accepted viewers and the original deadline, consent and saved result through repeated restarts', async () => {
  let game = await finished(); const id = game.id, deadline = game.resultRecord.state.deadline, replayId = game.replayId;
  await consent(game, 0);
  for (let i = 0; i < 2; i++) {
    await restart(); game = activeGames.get(id);
    expect(game.resultRecord.state.deadline).toBe(deadline);
    expect(game.getState().rematchRequests).toEqual([players[0].id]);
    expect(game.resultData).toMatchObject({ gameId: id, replayId, persistStatus: 'saved', winner: 'red' });
    expect(getSession(players[1].id)).toMatchObject({ gameId: id, phase: 'in-game' });
  }
  connect(1); await actions(1)['game:leave']({ gameId: id }, request());
  await restart(); expect(getSession(players[1].id)?.gameId ?? null).toBeNull();
  expect(getSession(players[0].id).gameId).toBe(id);
  expect((await record(id)).state.players[1].viewing).toBe(false);
});

it('creates one rematch with swapped colours and restores its active game after replacement', async () => {
  const game = await finished(); await consent(game, 0); await consent(game, 1);
  const childId = getSession(players[0].id).gameId;
  expect(childId).not.toBe(game.id); expect(getSession(players[1].id).gameId).toBe(childId);
  const child = activeGames.get(childId);
  expect(child.redUserId).toBe(game.blackUserId); expect(child.blackUserId).toBe(game.redUserId);
  expect((await record(game.id)).status).toBe('CLOSED');
  expect(await prisma.activeResultViewer.count({ where: { gameRunId: game.id } })).toBe(0);
  await restart();
  expect(getSession(players[0].id).gameId).toBe(childId);
  expect(activeGames.get(childId).recovery).not.toBeNull();
  expect(activeGames.has(game.id)).toBe(false);
});

it('recovers accepted consent without a child and starts when both humans reconnect', async () => {
  const game = await finished();
  getSession(players[1].id).connectionId = null;
  await consent(game, 0);
  const saved = await record(game.id);
  await commitResultCommand({ gameRunId: game.id, expectedRevision: saved.revision,
    action: { type: 'request-rematch', userId: players[1].id } });
  const key = (await record(game.id)).state.rematch.key;
  await restart(); const restored = activeGames.get(game.id);
  connect(0); await reconcileResultUser(players[0].id); await restored.resultStarting;
  expect(getSession(players[0].id).gameId).toBe(game.id);
  connect(1); await reconcileResultUser(players[1].id); await restored.resultStarting;
  const child = await prisma.gameRun.findUniqueOrThrow({ where: { key } });
  expect(getSession(players[0].id).gameId).toBe(child.id);
  expect(getSession(players[1].id).gameId).toBe(child.id);
});

it('cancels an uninstalled reserved child on restart and restores result viewers with fresh consent', async () => {
  const game = await finished(); await consent(game, 0);
  let saved = await record(game.id);
  saved = (await commitResultCommand({ gameRunId: game.id, expectedRevision: saved.revision,
    action: { type: 'request-rematch', userId: players[1].id } })).result;
  const child = await reserveResultRematch(game.id);
  await restart();
  expect((await prisma.gameRun.findUniqueOrThrow({ where: { id: child.id } })).status).toBe('ABORTED');
  expect(activeGames.get(game.id).getState().rematchRequests).toEqual([]);
  expect((await record(game.id)).state.deadline).toBe(saved.state.deadline);
  for (const p of players.slice(0,2)) expect(getSession(p.id).gameId).toBe(game.id);
});

it('accepts bot rematches with no bot session or readiness request', async () => {
  players[1] = await prisma.user.update({ where: { id: players[1].id }, data: { isBot: true } });
  removeSession(players[1].id);
  const game = await finished(); await consent(game, 0);
  expect(getSession(players[0].id).gameId).not.toBe(game.id);
  expect(getSession(players[1].id)).toBeNull();
  const childId = getSession(players[0].id).gameId;
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: childId } })).toBe(1);
  expect((await record(game.id)).status).toBe('CLOSED');
});

it('confirms lost dismissal and rematch reservation responses without reviving viewers or creating another game', async () => {
  const game = await finished(); await consent(game, 0);
  const lost = loseResponse(result => result?.resultSourceId === game.id && result.status === 'OPEN');
  await consent(game, 1); expect(lost()).toBe(true);
  const child = activeGames.get(getSession(players[0].id).gameId);
  expect(await prisma.gameRun.count({ where: { resultSourceId: game.id } })).toBe(1);
  vi.restoreAllMocks(); await child.endGame('black', 'resign');
  const lostLeave = loseResponse(result => result?.result?.gameRunId === child.id && !result.result.state.players.find(p => p.userId === players[0].id).viewing);
  await actions(0)['game:leave']({ gameId: child.id }, request()); expect(lostLeave()).toBe(true);
  expect(getSession(players[0].id).phase).toBe('idle');
  vi.restoreAllMocks(); await restart(); expect(getSession(players[0].id)?.gameId ?? null).toBeNull();
});

it('cancels a reserved rematch when a human disconnects before installation', async () => {
  const game = await finished(); await consent(game, 0);
  const gate = pauseAfter(result => result?.resultSourceId === game.id);
  const starting = consent(game, 1); await gate.inside;
  getSession(players[0].id).connectionId = null; gate.release(); await starting;
  const child = await prisma.gameRun.findFirstOrThrow({ where: { resultSourceId: game.id } });
  expect(child.status).toBe('ABORTED');
  expect((await record(game.id)).status).toBe('OPEN');
  expect(game.getState().rematchRequests).toEqual([]);
  expect(getSession(players[1].id).gameId).toBe(game.id);
});

it('keeps spectators on the old result during a rematch and durably dismisses them after the source room closes', async () => {
  await rooms(0)['room:create']({ allowSpectators: true }); const room = [...gameRooms.values()][0];
  await rooms(1)['room:join']({ roomId: room.id });
  await rooms(2)['room:spectate']({ roomId: room.id });
  await rooms(0)['room:ready']({ roomId: room.id, ready: true, expectedSettings: room.settings });
  await rooms(1)['room:ready']({ roomId: room.id, ready: true, expectedSettings: room.settings });
  const game = activeGames.get(getSession(players[0].id).gameId); await game.endGame('red', 'resign');
  expect(gameRooms.has(room.id)).toBe(false);
  expect(getSession(players[2].id)).toMatchObject({ phase: 'spectating', spectatingGameId: game.id });
  await consent(game, 0); await consent(game, 1); await restart();
  expect(getSession(players[2].id)).toMatchObject({ spectatingGameId: game.id, spectatingRoomId: room.id });
  connect(2); await rooms(2)['room:leave']({ roomId: room.id }, request());
  expect(getSession(players[2].id).phase).toBe('idle');
  expect((await record(game.id)).status).toBe('CLOSED');
});

it('ignores an older room projection after terminal handoff and spectator dismissal', async () => {
  await rooms(0)['room:create']({ allowSpectators: true }); const room = [...gameRooms.values()][0];
  await rooms(1)['room:join']({ roomId: room.id });
  await rooms(2)['room:spectate']({ roomId: room.id });
  await rooms(0)['room:ready']({ roomId: room.id, ready: true, expectedSettings: room.settings });
  await rooms(1)['room:ready']({ roomId: room.id, ready: true, expectedSettings: room.settings });
  const older = await prisma.roomRecord.findUniqueOrThrow({ where: { id: BigInt(room.id) } });
  const gate = pauseAfter(result => Array.isArray(result) && result.some(p => p.id === players[2].id && p.sessionNotices));
  const projection = runGameplayWork(work => acceptRoomRecord(room, older, work)); await gate.inside;
  const game = activeGames.get(getSession(players[0].id).gameId); await game.endGame('red', 'resign');
  await rooms(2)['room:leave']({ roomId: room.id }, request());
  gate.release(); await projection;
  expect(room.status).toBe('closed'); expect(room.revision).toBeGreaterThan(older.revision);
  expect(gameRooms.has(room.id)).toBe(false);
  expect(getSession(players[2].id).phase).toBe('idle');
});

it('does not expire a result early and keeps expiry notices and dismissal authoritative after restart', async () => {
  const game = await finished(), deadline = game.resultRecord.state.deadline;
  await game.expireResultViews(deadline - 1);
  expect(getSession(players[0].id).gameId).toBe(game.id);
  await game.expireResultViews(deadline);
  expect(activeGames.has(game.id)).toBe(false);
  await restart(); connect(0); await reconcileResultUser(players[0].id);
  expect(getSession(players[0].id).phase).toBe('idle');
  expect(await prisma.sessionNotice.count({ where: { effectKey: `game:${game.id}:expired` } })).toBe(2);
});

it('expires an overdue result before startup can restore its viewers', async () => {
  const game = await createGameDirect(players[0].id, players[1].id, 'FRIENDLY', 0, 0);
  await clearRuntime();
  // A previous owner committed this ending but disappeared before publication.
  game.game.gameOver = true; game.game.winner = 'red'; game.endReason = 'resign';
  game.endedAt = Date.now() - GAME_OVER_LINGER_MS - 1000;
  game.startedAt = new Date(game.endedAt - 1000);
  await commitGameTransition({ key: game.settlementKey, expectedRevision: game.stateRevision }, () => encodeCheckpoint(game));
  await restart();
  expect(activeGames.has(game.id)).toBe(false);
  expect(getSession(players[0].id)).toBeNull(); expect(getSession(players[1].id)).toBeNull();
  expect((await record(game.id)).status).toBe('CLOSED');
  expect(await prisma.sessionNotice.count({ where: { effectKey: `game:${game.id}:expired` } })).toBe(2);
});

it('drains settlement after the last viewer leaves and prevents publication from the retired result', async () => {
  const game = await createGameDirect(players[0].id, players[1].id, 'FRIENDLY', 0, 0);
  const gate = pauseAfter(result => result?.replayId && result?.coinRewards);
  const ended = game.endGame('red', 'resign'); await gate.inside;
  await actions(0)['game:leave']({ gameId: game.id }, request());
  await actions(1)['game:leave']({ gameId: game.id }, request());
  expect(activeGames.has(game.id)).toBe(false);
  let drained = false; const stopped = stopGameRuntime().then(() => { drained = true; });
  await new Promise(resolve => setImmediate(resolve)); expect(drained).toBe(false);
  gate.release(); await Promise.all([ended, stopped]);
  expect(game.runtimeStopped).toBe(true); expect(game.resultData).toBeNull();
  expect((await prisma.gameRun.findUniqueOrThrow({ where: { id: game.id } })).status).toBe('SETTLED');
});

it('holds reconnect reconciliation across terminal and dismissal commits that have not yet published', async () => {
  const game = await createGameDirect(players[0].id, players[1].id, 'FRIENDLY', 0, 0);
  let gate = pauseAfter(result => result?.terminalIntent && result?.resultRecord);
  const ending = game.endGame('red', 'resign'); await gate.inside;
  let reconciled = false;
  let reconnect = reconcileResultUser(players[0].id).then(() => { reconciled = true; });
  await new Promise(resolve => setImmediate(resolve)); expect(reconciled).toBe(false);
  gate.release(); await Promise.all([ending, reconnect]); vi.restoreAllMocks();
  expect(getSession(players[0].id).gameId).toBe(game.id); expect(game.game.gameOver).toBe(true);
  gate = pauseAfter(result => result?.result?.gameRunId === game.id && !result.result.state.players[0].viewing);
  const leaving = actions(0)['game:leave']({ gameId: game.id }, request()); await gate.inside;
  reconciled = false; reconnect = reconcileResultUser(players[0].id).then(() => { reconciled = true; });
  await new Promise(resolve => setImmediate(resolve)); expect(reconciled).toBe(false);
  gate.release(); await Promise.all([leaving, reconnect]);
  expect(getSession(players[0].id).phase).toBe('idle');
  expect((await record(game.id)).state.players[0].viewing).toBe(false);
});

it('restores a result in a fresh server first snapshot, then preserves socket dismissal through another replacement', async () => {
  const game = await finished(), id = game.id, replayId = game.replayId;
  await consent(game, 0); await clearRuntime();
  let server = await startGameplayServer();
  try {
    const { socket, snapshot } = await server.connect(players[0]);
    expect(snapshot).toMatchObject({ phase: 'in-game', game: { gameId: id, gameOver: true, replayId,
      rematchRequests: [players[0].id], opponentLeft: false } });
    const response = await socket.timeout(5000).emitWithAck('session:command', {
      protocolVersion: PROTOCOL_VERSION, id: randomUUID(), serverId: snapshot.serverId, context: snapshot.context,
      createdAt: Date.now(), type: 'game:leave', data: { gameId: id }
    });
    expect(response.ok).toBe(true); expect(response.snapshot.phase).toBe('idle');
    await startGameplayOwnership(); expect(await server.exited).toEqual({ code: 0, signal: null });
    await server.close(); server = await startGameplayServer();
    expect((await server.connect(players[0])).snapshot.phase).toBe('idle');
    expect((await server.connect(players[1])).snapshot.game).toMatchObject({ gameId: id, opponentLeft: true });
    await startGameplayOwnership(); expect(await server.exited).toEqual({ code: 0, signal: null });
  } finally { await server.close(); }
});
