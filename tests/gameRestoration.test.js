import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createGameRun } from '../server/services/gameRuns.js';
import { getBotUser } from '../server/services/botPlayer.js';
import { loadRestorableGames } from '../server/services/gameRestoration.js';
import { commitGameTransition } from '../server/services/gameTransitions.js';
import { settleQueuedGame } from '../server/services/settlementRecovery.js';
import { encodeCheckpoint, decodeCheckpoint } from '../server/domain/gameCheckpoint.js';
import { activeGames, restoreActiveGames, stopGameRuntime, createGameActions } from '../server/domain/games.js';
import { getSession, getAllSessions, removeSession, handleReconnect, handleDisconnect } from '../server/domain/sessions.js';
import { expireDisconnectedGame } from '../server/domain/lifecycle.js';
import { CheckersGame } from '../shared/game.js';
import { revealView } from '../src/lib/colorReveal.js';
import { PROTOCOL_VERSION } from '../shared/protocol.js';
import { buildSyncPayload } from '../server/domain/snapshots.js';

let players, ownedPlayers, keys;
beforeEach(async () => {
  await startGameplayOwnership(); keys = [];
  players = await Promise.all(['r', 'b', 'c'].map(c => prisma.user.create({ data: {
    username: `restore-${c}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
  ownedPlayers = [...players];
});
async function clearRuntime() {
  await stopGameRuntime(); activeGames.clear();
  for (const id of getAllSessions().keys()) removeSession(id);
}
afterEach(async () => {
  await clearRuntime();
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ownedPlayers.map(p => p.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: ownedPlayers.map(p => p.id) } } });
});
async function create(changes = {}) {
  const key = randomUUID(); keys.push(key);
  return createGameRun({ key, redPlayerId: players[0].id, blackPlayerId: players[1].id,
    mode: 'FRIENDLY', turnTime: 60, ...changes });
}
// Model records left by binaries predating the membership repository. Normal
// creation must reject these overlaps; restoration still has to diagnose them.
async function legacyRun(changes = {}) {
  const key = randomUUID(); keys.push(key);
  return prisma.gameRun.create({ data: { key, redPlayerId: players[0].id, blackPlayerId: players[1].id,
    mode: 'FRIENDLY', buyIn: 0, turnTime: 60, origin: 'room', initialState: JSON.parse(JSON.stringify(new CheckersGame(60))), ...changes } });
}
function checkpoint(changes = {}) {
  const game = new CheckersGame(60);
  const move = game.getAllValidMoves()[0]; game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
  game.redTime = 22.25; game.blackTime = 33.5;
  return encodeCheckpoint({ game, started: true, startedAt: new Date('2026-09-01T12:00:00Z'), endedAt: null,
    endReason: null, revealAcks: new Set(players.slice(0, 2).map(p => p.id)), revealDeadline: 1,
    pendingDrawOffer: players[0].id, lastDrawOffer: { [players[0].id]: 1 }, ...changes });
}
async function save(run, value = checkpoint()) {
  await commitGameTransition({ key: run.key, expectedRevision: run.revision }, () => value);
  return value;
}
function connect(index, connection = randomUUID()) { handleReconnect(players[index].id, connection); return connection; }
function ready(room, index) { return room.acknowledgeRecovery(players[index].id, room.recovery.generation); }
async function expire(room) {
  await room.commit(draft => room.evaluateRecovery(draft, draft.recovery.deadline));
  await room.finalization;
}

it('refunds only a versioned, never-checkpointed start and leaves no live session', async () => {
  const run = await create({ mode: 'RANKED', buyIn: 20 });
  expect(run.recoveryVersion).toBe(1);
  expect(await restoreActiveGames()).toEqual({ restored: 0, cancelledStarts: 1 });
  expect(await restoreActiveGames()).toEqual({ restored: 0, cancelledStarts: 0 });
  expect(await prisma.gameRun.findUnique({ where: { key: run.key } })).toMatchObject({ status: 'ABORTED' });
  expect((await prisma.user.findUnique({ where: { id: players[0].id } })).coins).toBe(100);
  expect(await prisma.coinTransaction.count({ where: { receiverId: players[0].id, reason: 'WAGER_REFUND' } })).toBe(1);
});

it('rejects legacy null checkpoints before refunding or installing any game', async () => {
  const modern = await create({ mode: 'RANKED', buyIn: 20 });
  const legacy = await legacyRun();
  expect(legacy.recoveryVersion).toBe(0); // old writers omit the version field
  await expect(restoreActiveGames()).rejects.toThrow('no trustworthy checkpoint');
  expect(activeGames.size).toBe(0);
  expect((await prisma.gameRun.findUnique({ where: { id: modern.id } })).status).toBe('OPEN');
  expect((await prisma.user.findUnique({ where: { id: players[0].id } })).coins).toBe(80);
});

it('rejects overlapping saved human games without selecting an arbitrary membership', async () => {
  await save(await create());
  await save(await legacyRun({ blackPlayerId: players[2].id }));
  await expect(loadRestorableGames()).rejects.toThrow('overlapping unfinished games');
  expect(activeGames.size).toBe(0); expect(getAllSessions().size).toBe(0);
});

it('restores durable invitation evidence in only the invited participant snapshot', async () => {
  const run = await create(); await save(run);
  await prisma.gameRun.update({ where: { id: run.id }, data: { invitedPlayerIds: [players[1].id] } });
  await restoreActiveGames();
  const deps = { activeGames, gameRooms: new Map() };
  expect(buildSyncPayload(players[0].id, deps).game.enteredViaInvite).toBe(false);
  expect(buildSyncPayload(players[1].id, deps).game.enteredViaInvite).toBe(true);
  expect(buildSyncPayload(players[1].id, deps).game).not.toHaveProperty('invitedPlayerIds');
});

it('restores the accepted board, clocks and route context and resumes only after both current connections are ready', async () => {
  const run = await create(), state = await save(run);
  await restoreActiveGames();
  const room = activeGames.get(run.id);
  expect(getSession(players[0].id)).toMatchObject({ phase: 'in-game', gameId: run.id, gameColor: 'red' });
  expect(encodeCheckpoint(room).engine).toEqual(state.engine);
  expect(room.pendingDrawOffer).toBe(players[0].id);
  expect(room.timerInterval).toBeNull();
  room.lastClockAt = performance.now() - 100_000;
  await room.advanceClock();
  expect(room.game.blackTime).toBe(33.5);
  connect(0); connect(1);
  const actor = createGameActions({ userId: players[1].id, connectionId: getSession(players[1].id).connectionId });
  const move = room.game.getAllValidMoves()[0];
  await expect(actor['game:move']({ gameId: run.id, expectedPly: 1, ...move })).rejects.toThrow('Waiting for players');
  await ready(room, 0); expect(room.recoveryView().readyUserIds).toEqual([players[0].id]);
  expect(room.recovery).not.toBeNull();
  await ready(room, 1);
  expect(room.recovery).toBeNull(); expect(room.timerInterval).not.toBeNull();
  expect(room.game.blackTime).toBe(33.5); expect(room.startedAt.toISOString()).toBe(state.startedAt);
  await actor['game:move']({ gameId: run.id, expectedPly: 1, ...move });
  expect(room.game.moveHistory).toHaveLength(2);
});

it('invalidates readiness after connection replacement and ignores the ordinary disconnect forfeiture during recovery', async () => {
  const run = await create(); await save(run); await restoreActiveGames();
  const room = activeGames.get(run.id);
  connect(0); await ready(room, 0); handleDisconnect(players[0].id);
  await expireDisconnectedGame(players[0].id, room.id);
  expect(room.game.gameOver).toBe(false);
  connect(0); connect(1); await ready(room, 1);
  expect(room.recoveryView().readyUserIds).toEqual([players[1].id]);
  await ready(room, 0); expect(room.recovery).toBeNull();
});

it('restores and completes the same mandatory capture chain after players resume', async () => {
  const run = await create(), state = decodeCheckpoint(checkpoint());
  state.game = new CheckersGame(60);
  state.game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  state.game.board[5][0] = { color: 'red', queen: false };
  for (const [r, c] of [[4, 1], [2, 3], [0, 7]]) state.game.board[r][c] = { color: 'black', queen: false };
  state.game.positionHistory = [state.game._boardHash()];
  expect(state.game.makeMove(5, 0, 3, 2)).toBeTruthy();
  await save(run, encodeCheckpoint(state)); await restoreActiveGames();
  const room = activeGames.get(run.id); connect(0); connect(1); await ready(room, 0); await ready(room, 1);
  expect(room.game.chainPiece).toEqual({ row: 3, col: 2 });
  expect(room.game.positionHistory).toEqual(state.game.positionHistory);
  const actor = createGameActions({ userId: players[0].id, connectionId: getSession(players[0].id).connectionId });
  await actor['game:move']({ gameId: run.id, expectedPly: 1, fromRow: 3, fromCol: 2, toRow: 1, toCol: 4 });
  expect(room.game.chainPiece).toBeNull(); expect(room.game.moveHistory).toHaveLength(2);
  expect(room.game.board[2][3]).toBeNull();
});

it('restarts the grace period and clears acknowledgements after a second writer takeover', async () => {
  const run = await create(); const state = await save(run); await restoreActiveGames();
  let room = activeGames.get(run.id); connect(0); await ready(room, 0);
  const previousGeneration = room.recovery.generation;
  await clearRuntime(); await startGameplayOwnership(); await restoreActiveGames();
  room = activeGames.get(run.id); connect(0);
  expect(room.recovery.generation).toBeGreaterThan(previousGeneration);
  expect(room.recoveryView().readyUserIds).toEqual([]);
  await expect(room.acknowledgeRecovery(players[0].id, previousGeneration)).rejects.toThrow('older server');
  expect(encodeCheckpoint(room).engine).toEqual(state.engine);
});

it('cancels an unattended ranked recovery with one refund and no rating, statistics or consolation rewards', async () => {
  const run = await create({ mode: 'RANKED', buyIn: 20 }); await save(run); await restoreActiveGames();
  const room = activeGames.get(run.id); await expire(room);
  expect(room.resultData.result).toBe('ABORTED'); expect(room.recoveryTimer).toBeNull();
  await settleQueuedGame(run.key);
  for (const player of players.slice(0, 2)) {
    expect(await prisma.user.findUnique({ where: { id: player.id } })).toMatchObject({ coins: 100, elo: player.elo, gamesPlayed: 0, wins: 0, losses: 0 });
    const ledger = await prisma.coinTransaction.findMany({ where: { receiverId: player.id } });
    expect(ledger.map(entry => entry.reason).sort()).toEqual(['WAGER_REFUND', 'WAGER_STAKE']);
  }
});

it('awards the returning human a disconnect win when the other human never resumes', async () => {
  const run = await create(); await save(run); await restoreActiveGames();
  const room = activeGames.get(run.id); connect(1); await ready(room, 1); await expire(room);
  expect(room.resultData).toMatchObject({ result: 'BLACK_WIN', endReason: 'restart-disconnect' });
});

it('never gives a bot a win because its human did not return', async () => {
  players[1] = await getBotUser('easy');
  const run = await create({ mode: 'BOT' }); await save(run); await restoreActiveGames();
  const room = activeGames.get(run.id); await expire(room);
  expect(room.resultData.result).toBe('ABORTED');
});

it('shows the restored board instead of replaying an interrupted colour wheel', async () => {
  const run = await create(); await save(run, checkpoint({ game: new CheckersGame(60), started: false, revealAcks: new Set() }));
  await restoreActiveGames(); const room = activeGames.get(run.id);
  expect(revealView(room.getState(), players[0].id).active).toBe(false);
  connect(0); connect(1); await ready(room, 0); await ready(room, 1);
  expect(room.started).toBe(true); expect(room.game.moveHistory).toEqual([]);
});

it('does not publish or resume a recovery whose readiness transaction rolls back', async () => {
  const run = await create(); await save(run); await restoreActiveGames();
  const room = activeGames.get(run.id); connect(0); connect(1); await ready(room, 0);
  const transaction = prisma.$transaction.bind(prisma);
  const failing = vi.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transaction(async tx => {
    await callback(tx); throw Error('lost database transaction');
  }));
  try { await expect(ready(room, 1)).rejects.toThrow('lost database transaction'); }
  finally { failing.mockRestore(); }
  expect(room.recoveryView().readyUserIds).toEqual([players[0].id]); expect(room.timerInterval).toBeNull();
  await ready(room, 1); expect(room.recovery).toBeNull();
});

it('retries a failed deadline transaction without leaving an unattended game paused forever', async () => {
  const run = await create(); await save(run); await restoreActiveGames();
  const room = activeGames.get(run.id);
  await room.commit(draft => { draft.recovery.deadline = Date.now(); });
  const transaction = prisma.$transaction.bind(prisma);
  const failing = vi.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transaction(async tx => {
    await callback(tx); throw Error('deadline storage unavailable');
  }));
  try {
    room.armRecovery(0);
    await vi.waitFor(() => expect(room.persistStatus).toBe('saved'), { timeout: 4000 });
    expect(room.resultData.result).toBe('ABORTED');
    expect(await prisma.game.count({ where: { settlementKey: run.key } })).toBe(1);
  } finally { failing.mockRestore(); }
});

it.each([false, true])('loads committed play in the actual fresh server and resumes without a page refresh (bot=%s)', async (bot) => {
  if (bot) players[1] = await getBotUser('easy');
  const run = await create({ mode: bot ? 'BOT' : 'FRIENDLY' }); const state = await save(run);
  const child = fork('tests/fixtures/owned-gameplay-server.js', [], {
    env: { ...process.env, NODE_ENV: 'test', PORT: '0', SITE_URL: 'http://127.0.0.1' },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  let output = ''; const clients = [];
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output = (output + data).slice(-4000); });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  try {
    const { port } = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error(`Startup timeout: ${output}`)), 7000);
      child.once('message', value => { clearTimeout(timer); resolve(value); });
      child.once('exit', () => { clearTimeout(timer); reject(Error(`Startup failed: ${output}`)); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
    });
    for (const player of players.slice(0, bot ? 1 : 2)) {
      const socket = ioClient(`http://127.0.0.1:${port}`, { autoConnect: false, transports: ['websocket'], reconnection: false,
        auth: { token: jwt.sign({ userId: player.id, username: player.username }, process.env.JWT_SECRET) } });
      clients.push(socket);
      socket.on('sync:state', snapshot => { socket.snapshot = snapshot; });
      const initial = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Snapshot timeout')), 5000);
        socket.once('sync:state', snapshot => { clearTimeout(timer); resolve(snapshot); });
      });
      socket.connect(); const snapshot = await initial;
      expect(snapshot).toMatchObject({ phase: 'in-game', context: { gameId: run.id }, game: {
        board: state.engine.board, moveHistory: state.engine.moveHistory, currentPlayer: 'black', redTime: 22.25, blackTime: 33.5,
        recovery: { readyUserIds: [] }
      } });
    }
    for (const socket of clients) {
      const response = await socket.timeout(5000).emitWithAck('session:command', {
        protocolVersion: PROTOCOL_VERSION, id: randomUUID(), serverId: socket.snapshot.serverId, context: socket.snapshot.context,
        createdAt: Date.now(), type: 'game:recovery-ready', data: { gameId: run.id, generation: socket.snapshot.game.recovery.generation }
      });
      expect(response.ok).toBe(true);
    }
    const resumed = await clients[0].timeout(5000).emitWithAck('sync:request', {});
    expect(resumed.game.recovery).toBeNull(); expect(resumed.game.moveHistory).toEqual(state.engine.moveHistory);
    if (bot) {
      // The opponent owns the restored first turn. The next move must arrive
      // through the normal snapshot subscription, with no extra sync request.
      await vi.waitFor(() => expect(clients[0].snapshot.game.moveHistory).toHaveLength(2), { timeout: 5000 });
      expect(clients[0].snapshot.game.currentPlayer).toBe('red');
    }
    // Ownership takeover exercises the real clean shutdown path, not a test exit.
    await startGameplayOwnership();
    expect(await exited).toEqual({ code: 0, signal: null });
  } finally {
    for (const socket of clients) socket.disconnect();
    if (child.exitCode === null && child.signalCode === null) { child.kill(); await exited; }
  }
});
