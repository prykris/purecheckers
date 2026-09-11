import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import prisma from '../server/db.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { runGameplayWork } from '../server/services/gameplayWork.js';
import { enqueueSessionWork } from '../server/domain/sessionWork.js';
import { createRoomActions, gameRooms, stopRoomRuntime } from '../server/domain/rooms.js';
import { createGameDirect, activeGames, stopGameRuntime, createGameActions } from '../server/domain/games.js';
import { getOrCreateSession, getSession, removeSession } from '../server/domain/sessions.js';
import { quickPlayPool } from '../server/services/quickPlay.js';
import * as searchService from '../server/services/searchService.js';
import * as roomRuntime from '../server/domain/roomRuntime.js';

let players, pauses, operations;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function observe(promise) {
  const outcome = promise.then(value => ({ value }), error => ({ error }));
  operations.push(outcome); return outcome;
}
function pauseAfter(object, method, predicate = () => true) {
  const original = object[method], entered = deferred(), release = deferred();
  let paused = false;
  pauses.push(release);
  vi.spyOn(object, method).mockImplementation(async function (...args) {
    const result = await original.apply(this, args);
    if (!paused && predicate(result, args)) { paused = true; entered.resolve(result); await release.promise; }
    return result;
  });
  return { entered: entered.promise, release: release.resolve };
}
function actor(index = 0) {
  const player = players[index], session = getSession(player.id);
  return { userId: player.id, username: player.username, isGuest: false, connectionId: session.connectionId };
}
async function stillDraining(stop) {
  let drained = false;
  const completion = stop().then(() => { drained = true; });
  await new Promise(resolve => setImmediate(resolve));
  expect(drained).toBe(false);
  return { completion };
}
beforeEach(async () => {
  await startGameplayOwnership(); pauses = []; operations = [];
  players = await Promise.all([0, 1].map(i => prisma.user.create({ data: {
    username: `shutdown-${i}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
  for (const player of players) getOrCreateSession(player.id, player.username, false).connectionId = `connection-${player.id}`;
});
afterEach(async () => {
  pauses.forEach(p => p.resolve()); await Promise.all(operations); vi.restoreAllMocks();
  await Promise.all([stopGameRuntime(), stopRoomRuntime()]);
  activeGames.clear(); gameRooms.clear();
  for (const player of players) { quickPlayPool.remove(player.id); removeSession(player.id); }
  const ids = players.map(p => p.id);
  const runs = await prisma.gameRun.findMany({ where: { redPlayerId: { in: ids } }, select: { key: true } });
  const keys = runs.map(r => r.key);
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.roomRecord.deleteMany({ where: { creatorId: { in: ids } } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

it('drains a room creation paused on its QR image and never installs the stopped room', async () => {
  const gate = pauseAfter(QRCode, 'toDataURL');
  const created = observe(createRoomActions(actor())['room:create']({ isPrivate: true }));
  await gate.entered;
  const { completion } = await stillDraining(stopRoomRuntime);
  gate.release();
  expect((await created).error.message).toMatch(/runtime stopped/);
  await completion;
  expect(gameRooms.size).toBe(0);
  expect(getSession(players[0].id).phase).toBe('idle');
});

it('rechecks the runtime at installation after a committed room projection returns', async () => {
  const original = roomRuntime.persistNewRoom;
  let draining;
  vi.spyOn(roomRuntime, 'persistNewRoom').mockImplementationOnce(async (...args) => {
    const room = await original(...args);
    draining = stopRoomRuntime();
    return room;
  });
  const result = await observe(createRoomActions(actor())['room:create']({}));
  expect(result.error.message).toMatch(/runtime stopped/);
  await draining;
  expect(gameRooms.size).toBe(0);
  expect(getSession(players[0].id).phase).toBe('idle');
  // Shutdown cannot erase the accepted room. Replacement startup owns recovery.
  expect(await prisma.roomRecord.count({ where: { creatorId: players[0].id } })).toBe(1);
});

it('denies new work even if shutdown precedes the first operation of this owner', async () => {
  await stopRoomRuntime();
  const query = vi.spyOn(prisma.user, 'findUnique');
  await expect(createRoomActions(actor())['room:create']({})).rejects.toThrow(/runtime stopped/);
  await expect(createGameDirect(players[0].id, players[1].id, 'FRIENDLY')).rejects.toThrow(/runtime stopped/);
  expect(query).not.toHaveBeenCalled();
});

it('drains queued session work and fences it before any deferred mutation begins', async () => {
  const session = getSession(players[0].id), gate = deferred(), mutation = vi.fn();
  pauses.push(gate);
  observe(enqueueSessionWork([session], () => gate.promise));
  const queued = observe(runGameplayWork(mutation, action => enqueueSessionWork([session], action)));
  const { completion } = await stillDraining(stopRoomRuntime);
  gate.resolve();
  expect((await queued).error.message).toMatch(/runtime stopped/);
  await completion;
  expect(mutation).not.toHaveBeenCalled();
});

it('drains a game start paused on account lookup without reserving stakes', async () => {
  const gate = pauseAfter(prisma.user, 'findUnique', (_result, [args]) => args.where.id === players[0].id);
  const created = observe(createGameDirect(players[0].id, players[1].id, 'RANKED', 20));
  await gate.entered;
  const { completion } = await stillDraining(stopGameRuntime);
  gate.release();
  expect((await created).error.message).toMatch(/runtime stopped/);
  await completion;
  expect(await prisma.gameRun.count({ where: { redPlayerId: players[0].id } })).toBe(0);
  expect(activeGames.size).toBe(0);
});

it.each(['reservation', 'reveal checkpoint'])('refunds an uninstalled start paused after its %s commits and drains before returning', async stage => {
  const gate = pauseAfter(prisma, '$transaction', result => stage === 'reservation'
    ? result?.initialState && result.status === 'OPEN' : result?.checkpoint && result.revision === 1);
  const created = observe(createGameDirect(players[0].id, players[1].id, 'RANKED', 20));
  await gate.entered;
  expect((await prisma.user.findUnique({ where: { id: players[0].id } })).coins).toBe(80);
  const { completion } = await stillDraining(stopGameRuntime);
  gate.release();
  expect((await created).error.startAborted).toBe(true);
  await completion;
  const run = await prisma.gameRun.findFirst({ where: { redPlayerId: players[0].id } });
  expect(run.status).toBe('ABORTED');
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: run.id } })).toBe(0);
  expect(activeGames.size).toBe(0);
  for (const player of players) {
    expect((await prisma.user.findUnique({ where: { id: player.id } })).coins).toBe(100);
    expect(await prisma.coinTransaction.count({ where: { receiverId: player.id, reason: 'WAGER_REFUND' } })).toBe(1);
    expect(getSession(player.id).phase).toBe('idle');
  }
});

it('does not let a stale room command adopt a new owner after its await', async () => {
  const gate = pauseAfter(QRCode, 'toDataURL');
  const old = observe(createRoomActions(actor())['room:create']({}));
  await gate.entered;
  const { completion } = await stillDraining(stopRoomRuntime);
  await startGameplayOwnership();
  // A fresh owner's actions may proceed, while the old captured work stays invalid.
  await createRoomActions(actor(1))['room:create']({});
  gate.release();
  expect((await old).error.message).toMatch(/runtime stopped/);
  await completion;
  expect(gameRooms.size).toBe(1);
  expect([...gameRooms.values()][0].hostId).toBe(players[1].id);
  expect(getSession(players[0].id).phase).toBe('idle');
});

it('drains the whole ready-to-start room action without publishing a waiting room after shutdown', async () => {
  const host = createRoomActions(actor()), guest = createRoomActions(actor(1));
  await host['room:create']({ buyIn: 20 });
  const room = [...gameRooms.values()][0];
  await guest['room:join']({ roomId: room.id });
  await host['room:ready']({ roomId: room.id, ready: true, expectedSettings: room.settings });
  const gate = pauseAfter(prisma, '$transaction', result => result?.initialState && result.status === 'OPEN');
  const starting = observe(guest['room:ready']({ roomId: room.id, ready: true, expectedSettings: room.settings }));
  await gate.entered;
  const { completion } = await stillDraining(() => Promise.all([stopGameRuntime(), stopRoomRuntime()]));
  expect(room.status).toBe('starting');
  gate.release();
  expect((await starting).error.message).toMatch(/runtime stopped/);
  await completion;
  expect(room).toMatchObject({ status: 'starting', gameId: null, runtimeStopped: true });
  expect(activeGames.size).toBe(0);
  expect(getSession(players[0].id).phase).toBe('in-room');
  expect((await prisma.gameRun.findUnique({ where: { key: room.startAttempt.key } })).status).toBe('ABORTED');
});

it('leaves a committed uninstalled start for the new owner instead of refunding with an obsolete fence', async () => {
  const gate = pauseAfter(prisma, '$transaction', result => result?.initialState && result.status === 'OPEN');
  const created = observe(createGameDirect(players[0].id, players[1].id, 'RANKED', 20));
  const reserved = await gate.entered;
  const { completion } = await stillDraining(stopGameRuntime);
  await startGameplayOwnership();
  gate.release();
  expect((await created).error.message).toMatch(/newer server owns gameplay/);
  await completion;
  expect(activeGames.size).toBe(0);
  expect((await prisma.gameRun.findUnique({ where: { id: reserved.id } })).status).toBe('OPEN');
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: reserved.id } })).toBe(2);
  expect((await prisma.user.findUnique({ where: { id: players[0].id } })).coins).toBe(80);
  expect(await prisma.coinTransaction.count({ where: { receiverId: players[0].id, reason: 'WAGER_REFUND' } })).toBe(0);
});

it('does not re-enter matchmaking after shutdown while the account query was pending', async () => {
  const gate = pauseAfter(prisma.user, 'findUnique');
  const joined = observe(createGameActions(actor())['matchmaking:join']({}));
  await gate.entered;
  const { completion } = await stillDraining(stopGameRuntime);
  gate.release();
  expect((await joined).error.message).toMatch(/runtime stopped/);
  await completion;
  expect(getSession(players[0].id).phase).toBe('idle');
  expect(getSession(players[0].id).fallbackTimer).toBeNull();
});

it('drains nested work and failures without leaving an unhandled rejected cleanup promise', async () => {
  const entered = deferred(), release = deferred(); pauses.push(release);
  const work = observe(runGameplayWork(() => runGameplayWork(async scope => {
    entered.resolve(); await release.promise; scope.assertCurrent();
  })));
  await entered.promise;
  const { completion } = await stillDraining(stopGameRuntime);
  release.resolve();
  expect((await work).error.message).toMatch(/runtime stopped/);
  await completion;
});

it('drains optional move analysis that ignores cancellation without publishing a late reaction', async () => {
  const game = await createGameDirect(players[0].id, players[1].id, 'FRIENDLY', 0, 0);
  const red = createGameActions(actor()), black = createGameActions(actor(1));
  await red['game:reveal-done']({ gameId: game.id });
  await black['game:reveal-done']({ gameId: game.id });
  const entered = deferred(), release = deferred(); pauses.push(release);
  vi.spyOn(searchService, 'analyzeMoveQuality').mockImplementation(async () => {
    entered.resolve(); await release.promise; return { rating: 'good', scoreDiff: 0 };
  });
  const move = game.game.getAllValidMoves()[0];
  await red['game:move']({ gameId: game.id, expectedPly: 0, ...move });
  await entered.promise;
  const { completion } = await stillDraining(stopGameRuntime);
  const lookup = vi.spyOn(prisma.user, 'findUnique');
  expect(game.analysisWork.signal.aborted).toBe(true);
  release.resolve();
  await completion;
  expect(lookup).not.toHaveBeenCalled();
  expect(game.game.moveHistory).toHaveLength(1);
  expect(game.timerInterval).toBeNull();
});

it('does not rearm result cleanup after a pending settlement name lookup finishes during shutdown', async () => {
  const game = await createGameDirect(players[0].id, players[1].id, 'FRIENDLY', 0, 0);
  game.playerNames = {};
  const gate = pauseAfter(prisma.user, 'findUnique');
  const ended = observe(createGameActions(actor())['game:resign']({ gameId: game.id }));
  await gate.entered;
  const { completion } = await stillDraining(stopGameRuntime);
  gate.release();
  await ended; await completion;
  expect(game.runtimeStopped).toBe(true);
  expect(game.cleanupTimer).toBeFalsy();
  expect((await prisma.gameRun.findUnique({ where: { id: game.id } })).status).toBe('SETTLED');
});

it('does not create disconnect chat messages for games already stopped by transport shutdown', async () => {
  const game = await createGameDirect(players[0].id, players[1].id, 'FRIENDLY', 0, 0);
  await stopGameRuntime();
  const create = vi.spyOn(prisma.chatMessage, 'create');
  createGameActions(actor()).disconnect();
  expect(create).not.toHaveBeenCalled();
  expect(game.runtimeStopped).toBe(true);
});
