import { randomUUID } from 'node:crypto';
import prisma from '../server/db.js';
import { startGameplayOwnership, gameplayOwner, inGameplayTransaction } from '../server/services/gameplayOwnership.js';
import { lockEconomyUsers } from '../server/services/economy.js';
import { appendSessionNotice, readSessionNotice, dismissSessionNotice } from '../server/services/sessionNotices.js';
import { commitRoomRecord } from '../server/services/roomRecords.js';
import { createRoomActions, gameRooms, stopRoomRuntime } from '../server/domain/rooms.js';
import { createGameDirect, createGameActions, activeGames, stopGameRuntime } from '../server/domain/games.js';
import { getSession, getOrCreateSession, getAllSessions, removeSession, applySessionNotice } from '../server/domain/sessions.js';
import { createNoticeActions, restoreSessionNotice } from '../server/domain/notices.js';
import { startGameplayServer } from './helpers/gameplayServer.js';
import { PROTOCOL_VERSION } from '../shared/protocol.js';

let players, gates;
const actor = index => ({ userId: players[index].id, connectionId: `notice-socket-${index}` });
const rooms = index => createRoomActions(actor(index));
const connect = index => { const p = players[index]; getOrCreateSession(p.id, p.username, false).connectionId = actor(index).connectionId; };
beforeEach(async () => {
  await startGameplayOwnership(); gates = [];
  players = await Promise.all([0, 1, 2].map(i => prisma.user.create({ data: {
    username: `notice-${i}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
  players.forEach((_, i) => connect(i));
});
afterEach(async () => {
  gates.forEach(g => g()); vi.restoreAllMocks();
  await Promise.all([stopGameRuntime(), stopRoomRuntime()]);
  gameRooms.clear(); activeGames.clear();
  for (const id of getAllSessions().keys()) removeSession(id);
  const ids = players.map(p => p.id);
  const runs = await prisma.gameRun.findMany({ where: { OR: [{ redPlayerId: { in: ids } }, { blackPlayerId: { in: ids } }] } });
  const keys = runs.map(r => r.key);
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.roomRecord.deleteMany({ where: { creatorId: { in: ids } } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});
async function notice(index = 0, key = randomUUID(), changes = {}) {
  const userId = players[index].id;
  return inGameplayTransaction(gameplayOwner(), null, async tx => {
    await lockEconomyUsers(tx, [userId]);
    return appendSessionNotice(tx, { userId, effectKey: key, reason: 'room-kicked', context: { roomId: 9 }, ...changes });
  });
}
async function waiting() {
  await rooms(0)['room:create']({});
  const room = [...gameRooms.values()][0];
  await rooms(1)['room:join']({ roomId: room.id }); return room;
}
async function finishedGame() {
  const game = await createGameDirect(players[0].id, players[1].id, 'FRIENDLY', 0, 0);
  await game.endGame('red', 'resign');
  return game;
}
function pauseTransaction(predicate, before = false) {
  const original = prisma.$transaction;
  let entered, release, paused = false;
  const inside = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; }); gates.push(release);
  vi.spyOn(prisma, '$transaction').mockImplementation(async function (work, ...options) {
    if (before) return original.call(this, async tx => {
      if (!paused) { paused = true; entered(); await gate; }
      return work(tx);
    }, ...options);
    const result = await original.call(this, work, ...options);
    if (!paused && predicate(result)) { paused = true; entered(); await gate; }
    return result;
  });
  return { inside, release };
}

it('commits a kick and its notice together and restores the same event after session reconstruction', async () => {
  const room = await waiting();
  await rooms(0)['room:kick']({ roomId: room.id, userId: players[1].id });
  const accepted = getSession(players[1].id).notice;
  expect(accepted).toMatchObject({ reason: 'room-kicked', context: { roomId: room.id } });
  expect(await prisma.activeRoomMember.findUnique({ where: { userId: players[1].id } })).toBeNull();
  removeSession(players[1].id); connect(1); await restoreSessionNotice(players[1].id);
  expect(getSession(players[1].id).notice).toEqual(accepted);
  await createNoticeActions(getSession(players[1].id))['notice:dismiss']({ noticeId: accepted.id });
  removeSession(players[1].id); connect(1); await restoreSessionNotice(players[1].id);
  expect(getSession(players[1].id).notice).toBeNull();
});

it('rolls back notice, membership and command receipt together', async () => {
  const room = await waiting(), key = randomUUID();
  await expect(prisma.$transaction(async tx => {
    await commitRoomRecord({ roomId: room.id, expectedRevision: room.revision,
      departure: { userId: players[1].id, reason: 'room-kicked' },
      command: { userId: players[0].id, key, payload: { type: 'room:kick' } }
    }, draft => { draft.players = draft.players.filter(p => p.userId !== players[1].id); }, tx);
    throw Error('Transaction rollback');
  })).rejects.toThrow(/Transaction rollback/);
  expect((await prisma.roomRecord.findUnique({ where: { id: BigInt(room.id) } })).revision).toBe(room.revision);
  expect(await readSessionNotice(players[1].id)).toBeNull();
  expect(await prisma.activeRoomMember.findUnique({ where: { userId: players[1].id } })).not.toBeNull();
  expect(await prisma.roomCommandReceipt.count({ where: { key } })).toBe(0);
});

it('notifies remaining spectators when the final human leaves without notifying the voluntary leaver', async () => {
  await rooms(0)['room:create']({}); const room = [...gameRooms.values()][0];
  await rooms(2)['room:spectate']({ roomId: room.id });
  await rooms(0)['room:leave']({ roomId: room.id });
  expect(await readSessionNotice(players[0].id)).toBeNull();
  expect(getSession(players[2].id)).toMatchObject({ phase: 'idle', notice: { reason: 'room-closed' } });
  expect((await readSessionNotice(players[2].id)).id).toBe(getSession(players[2].id).notice.id);
});

it('never revives dismissed or superseded events when an effect is retried', async () => {
  const key = randomUUID(), first = await notice(0, key);
  await dismissSessionNotice(players[0].id, first.id);
  const repeated = await notice(0, key);
  expect(repeated.id).toBe(first.id); expect(repeated.dismissedAt).not.toBeNull();
  const second = await notice();
  await notice(0, key);
  expect((await readSessionNotice(players[0].id)).id).toBe(second.id);
  await expect(notice(0, key, { reason: 'room-closed' })).rejects.toThrow(/identity conflict/);
});

it('keeps newer notices intact when an older notice or another account notice is dismissed', async () => {
  const old = await notice(), current = await notice(), other = await notice(1);
  expect((await dismissSessionNotice(players[0].id, old.id)).id).toBe(current.id);
  expect((await dismissSessionNotice(players[0].id, other.id)).id).toBe(current.id);
  expect((await readSessionNotice(players[1].id)).dismissedAt).toBeNull();
});

it('ignores late projection of older notices and pre-dismissal reads', async () => {
  const old = await notice(), current = await notice();
  applySessionNotice(players[0].id, current); applySessionNotice(players[0].id, old);
  expect(getSession(players[0].id).notice.id).toBe(current.id);
  const dismissed = await dismissSessionNotice(players[0].id, current.id);
  applySessionNotice(players[0].id, dismissed); applySessionNotice(players[0].id, current);
  expect(getSession(players[0].id).notice).toBeNull();
});

it('confirms a dismissal response lost after commit without reviving the notice after reconstruction', async () => {
  const record = await notice(); applySessionNotice(players[0].id, record);
  const original = prisma.$transaction; let lost = false;
  vi.spyOn(prisma, '$transaction').mockImplementation(async function (...args) {
    const result = await original.apply(this, args);
    if (!lost && result?.id === record.id && result.dismissedAt) { lost = true; throw Error('Response lost'); }
    return result;
  });
  await createNoticeActions(getSession(players[0].id))['notice:dismiss']({ noticeId: record.id });
  expect(lost).toBe(true); expect(getSession(players[0].id).notice).toBeNull();
  removeSession(players[0].id); connect(0); await restoreSessionNotice(players[0].id);
  expect(getSession(players[0].id).notice).toBeNull();
});

it('retains result views during a notice persistence outage and expires them once storage recovers', async () => {
  const game = await finishedGame();
  const failed = vi.spyOn(prisma, '$transaction').mockRejectedValue(Error('Storage unavailable'));
  await expect(game.expireResultViews(game.resultRecord.state.deadline)).rejects.toThrow(/Storage unavailable/);
  expect(activeGames.has(game.id)).toBe(true);
  expect(getSession(players[0].id).phase).toBe('in-game');
  expect(getSession(players[0].id).notice).toBeNull();
  failed.mockRestore();
  await game.expireResultViews(game.resultRecord.state.deadline);
  expect(activeGames.has(game.id)).toBe(false);
  for (const player of players.slice(0, 2)) {
    expect(getSession(player.id)).toMatchObject({ phase: 'idle', notice: { reason: 'game-expired' } });
    expect((await readSessionNotice(player.id)).id).toBe(getSession(player.id).notice.id);
  }
});

it('confirms a lost result-expiry commit without duplicate notices', async () => {
  const game = await finishedGame(), original = prisma.$transaction; let lost = false;
  vi.spyOn(prisma, '$transaction').mockImplementation(async function (...args) {
    const result = await original.apply(this, args);
    if (!lost && result?.result?.gameRunId === game.id && result.result.status === 'CLOSED') { lost = true; throw Error('Expiry response lost'); }
    return result;
  });
  await game.expireResultViews(game.resultRecord.state.deadline);
  expect(lost).toBe(true);
  expect(await prisma.sessionNotice.count({ where: { effectKey: `game:${game.id}:expired` } })).toBe(2);
  expect(getSession(players[0].id).phase).toBe('idle');
});

it('does not issue an expiry notice for a player whose dismissal commits before expiry', async () => {
  const game = await finishedGame();
  const gate = pauseTransaction(result => result?.result?.state.players[0]?.viewing === false);
  const leaving = createGameActions(actor(0))['game:leave']({ gameId: game.id });
  await gate.inside;
  const expired = game.expireResultViews(game.resultRecord.state.deadline);
  gate.release(); await Promise.all([leaving, expired]);
  expect(await readSessionNotice(players[0].id)).toBeNull();
  expect(getSession(players[1].id).notice.reason).toBe('game-expired');
});

it('drains expiry committed before shutdown without publishing a late idle transition', async () => {
  const game = await finishedGame();
  const gate = pauseTransaction(result => result?.result?.gameRunId === game.id && result.result.status === 'CLOSED');
  const expired = game.expireResultViews(game.resultRecord.state.deadline).then(() => null, error => error);
  await gate.inside;
  let drained = false; const stopped = stopGameRuntime().then(() => { drained = true; });
  await new Promise(resolve => setImmediate(resolve)); expect(drained).toBe(false);
  gate.release(); expect((await expired).message).toMatch(/runtime stopped/); await stopped;
  expect(getSession(players[0].id).phase).toBe('in-game');
  expect(getSession(players[0].id).notice).toBeNull();
  expect((await readSessionNotice(players[0].id)).reason).toBe('game-expired');
});

it('restores a committed kick in the first snapshot of a fresh process and preserves socket dismissal through another restart', async () => {
  const room = await waiting(), request = { id: randomUUID(), type: 'room:kick', data: { roomId: room.id, userId: players[1].id } };
  const original = prisma.$transaction; let lost = false;
  const spy = vi.spyOn(prisma, '$transaction').mockImplementation(async function (...args) {
    const result = await original.apply(this, args);
    if (!lost && result?.room?.revision === room.revision + 1 && !result.room.state.players.some(p => p.userId === players[1].id)) {
      lost = true; throw Error('Kick committed but response lost');
    }
    return result;
  });
  await rooms(0)['room:kick'](request.data, request);
  spy.mockRestore(); expect(lost).toBe(true);
  const accepted = getSession(players[1].id).notice;
  await Promise.all([stopGameRuntime(), stopRoomRuntime()]);
  gameRooms.clear(); activeGames.clear();
  for (const id of getAllSessions().keys()) removeSession(id);
  let server = await startGameplayServer();
  try {
    const { socket, snapshot } = await server.connect(players[1]);
    expect(snapshot).toMatchObject({ phase: 'idle', notice: accepted });
    const response = await socket.timeout(5000).emitWithAck('session:command', {
      protocolVersion: PROTOCOL_VERSION, id: randomUUID(), serverId: snapshot.serverId, context: snapshot.context,
      createdAt: Date.now(), type: 'notice:dismiss', data: { noticeId: accepted.id }
    });
    expect(response.ok).toBe(true); expect(response.snapshot.notice).toBeNull();
    await startGameplayOwnership(); expect(await server.exited).toEqual({ code: 0, signal: null });
    await server.close(); server = await startGameplayServer();
    expect((await server.connect(players[1])).snapshot.notice).toBeNull();
    await startGameplayOwnership(); expect(await server.exited).toEqual({ code: 0, signal: null });
  } finally { await server.close(); }
  expect(await prisma.sessionNotice.count({ where: { userId: players[1].id } })).toBe(1);
});
