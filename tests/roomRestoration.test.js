import { randomUUID } from 'node:crypto';
import { startGameplayServer } from './helpers/gameplayServer.js';
import prisma from '../server/db.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { commitRoomRecord } from '../server/services/roomRecords.js';
import { createGameRun } from '../server/services/gameRuns.js';
import { createRoomActions, gameRooms, stopRoomRuntime, reconcileRoomPresence } from '../server/domain/rooms.js';
import { restoreRooms } from '../server/domain/roomRestoration.js';
import { activeGames, restoreActiveGames, stopGameRuntime } from '../server/domain/games.js';
import { getSession, getAllSessions, getOrCreateSession, removeSession } from '../server/domain/sessions.js';

let players;
const actor = index => ({ userId: players[index].id, connectionId: `socket-${index}` });
const actions = index => createRoomActions(actor(index));
async function clearRuntime() {
  await Promise.all([stopGameRuntime(), stopRoomRuntime()]);
  activeGames.clear(); gameRooms.clear();
  for (const id of getAllSessions().keys()) removeSession(id);
}
beforeEach(async () => {
  await startGameplayOwnership();
  players = await Promise.all([0, 1, 2].map(i => prisma.user.create({ data: {
    username: `rooms-${i}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
  players.forEach((p, i) => { getOrCreateSession(p.id, p.username, false).connectionId = actor(i).connectionId; });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await clearRuntime();
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
async function room(settings = {}) {
  await actions(0)['room:create'](settings);
  return [...gameRooms.values()][0];
}
async function restart(options) {
  await clearRuntime(); await startGameplayOwnership();
  await restoreActiveGames(); return restoreRooms(options);
}
async function reserve(value) {
  await actions(1)['room:join']({ roomId: value.id });
  let saved = await commitRoomRecord({ roomId: value.id, expectedRevision: value.revision }, draft => {
    draft.players.forEach(p => p.ready = true);
  });
  const key = randomUUID(), order = players.slice(0, 2).map(p => p.id);
  saved = await commitRoomRecord({ roomId: value.id, expectedRevision: saved.room.revision }, draft => {
    draft.status = 'STARTING'; draft.startAttempt = { key, players: order };
  });
  return { saved, input: { key, roomId: value.id, redPlayerId: order[0], blackPlayerId: order[1],
    mode: 'RANKED', buyIn: value.settings.buyIn, turnTime: value.settings.turnTimer, origin: 'room' } };
}

it('restores private invites, player and spectator roles with one durable deadline across repeated restarts', async () => {
  const value = await room({ isPrivate: true });
  await actions(0)['room:ready']({ roomId: value.id, ready: true, expectedSettings: value.settings });
  await actions(2)['room:spectate']({ roomId: value.id, code: value.joinCode });
  expect(await restart()).toEqual({ restored: 1, closed: 0 });
  let restored = gameRooms.get(value.id);
  expect(restored.joinCode).toBe(value.joinCode);
  expect(restored.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  expect(restored.players[0]).toMatchObject({ online: false, ready: false });
  expect(getSession(players[0].id)).toMatchObject({ phase: 'in-room', roomId: value.id });
  expect(getSession(players[2].id)).toMatchObject({ phase: 'spectating', spectatingRoomId: value.id });
  const deadline = restored.players[0].disconnectDeadline;
  await restart(); restored = gameRooms.get(value.id);
  expect(restored.players[0].disconnectDeadline).toBe(deadline);
  expect(restored.spectators[0].disconnectDeadline).toBe(deadline);
});

it('restores a bot as ready while requiring fresh human readiness', async () => {
  const value = await room();
  await actions(0)['bot:join']({ roomId: value.id, difficulty: 'easy' });
  await restart();
  const restored = gameRooms.get(value.id);
  expect(restored.players.find(p => p.isBot)).toMatchObject({ online: true, ready: true, disconnectDeadline: null });
  expect(restored.players.find(p => !p.isBot).ready).toBe(false);
});

it('resets an accepted start with no game reservation without inventing a refund', async () => {
  const value = await room({ buyIn: 20 }); await reserve(value);
  await restart();
  expect(gameRooms.get(value.id)).toMatchObject({ status: 'waiting', startAttempt: null, gameId: null });
  expect(await prisma.coinTransaction.count({ where: { receiverId: players[0].id } })).toBe(0);
});

it('refunds an uninstalled reservation once and restores room claims before admitting connections', async () => {
  const value = await room({ buyIn: 20 }), { input } = await reserve(value);
  const run = await createGameRun(input);
  await restart(); await restart();
  expect((await prisma.gameRun.findUnique({ where: { id: run.id } })).status).toBe('ABORTED');
  expect(gameRooms.get(value.id)).toMatchObject({ status: 'waiting', startAttempt: null });
  expect(await prisma.activeRoomMember.count({ where: { roomId: BigInt(value.id), role: 'PLAYER' } })).toBe(2);
  for (const player of players.slice(0, 2)) {
    expect((await prisma.user.findUnique({ where: { id: player.id } })).coins).toBe(100);
    expect(await prisma.coinTransaction.count({ where: { receiverId: player.id, reason: 'WAGER_REFUND' } })).toBe(1);
  }
});

it('restores spectators onto the associated active game while players keep their recovered game roles', async () => {
  const value = await room(); await actions(1)['room:join']({ roomId: value.id });
  await actions(2)['room:spectate']({ roomId: value.id });
  await actions(0)['room:ready']({ roomId: value.id, ready: true, expectedSettings: value.settings });
  await actions(1)['room:ready']({ roomId: value.id, ready: true, expectedSettings: value.settings });
  const game = activeGames.get(value.gameId);
  await game.acknowledgeReveal(players[0].id); await game.acknowledgeReveal(players[1].id);
  await restart();
  expect(getSession(players[0].id)).toMatchObject({ phase: 'in-game', gameId: game.id });
  expect(getSession(players[2].id)).toMatchObject({ phase: 'spectating', spectatingRoomId: value.id, spectatingGameId: game.id });
  expect(activeGames.get(game.id).recovery).not.toBeNull();
});

it('expires restored spectators and closes abandoned human-and-bot rooms', async () => {
  const value = await room(); await actions(0)['bot:join']({ roomId: value.id, difficulty: 'easy' });
  await actions(2)['room:spectate']({ roomId: value.id });
  await restart({ graceMs: 80 });
  await vi.waitFor(() => expect(gameRooms.has(value.id)).toBe(false));
  expect((await prisma.roomRecord.findUnique({ where: { id: BigInt(value.id) } })).status).toBe('CLOSED');
  expect(await prisma.activeRoomMember.count({ where: { roomId: BigInt(value.id) } })).toBe(0);
});

it('fails startup on unknown versions without installing a partial room list', async () => {
  const value = await room();
  await prisma.roomRecord.update({ where: { id: BigInt(value.id) }, data: { stateVersion: 99 } });
  await expect(restart()).rejects.toThrow(/Unsupported room recovery version/);
  expect(gameRooms.size).toBe(0);
});

it('keeps departure available when an existing wager participant can no longer afford a new start', async () => {
  const value = await room({ buyIn: 20 }); await actions(1)['room:join']({ roomId: value.id });
  await prisma.user.update({ where: { id: players[1].id }, data: { coins: 0 } });
  getSession(players[1].id).connectionId = null;
  await reconcileRoomPresence(value);
  expect(value.players.find(p => p.userId === players[1].id).online).toBe(false);
  await actions(0)['room:leave']({ roomId: value.id });
  expect(value.players.map(p => p.userId)).toEqual([players[1].id]);
  expect(getSession(players[0].id).phase).toBe('idle');
});

it('confirms lost creation and departure commit responses without duplicate rooms or claims', async () => {
  const create = { id: randomUUID(), type: 'room:create', data: {} };
  const leave = { id: randomUUID(), type: 'room:leave', data: {} };
  const original = prisma.$transaction;
  let creationLost = false, departureLost = false;
  vi.spyOn(prisma, '$transaction').mockImplementation(async function (...args) {
    const result = await original.apply(this, args);
    if (!creationLost && result?.creationKey === create.id) { creationLost = true; throw Error('Lost creation response'); }
    if (!departureLost && result?.room?.status === 'CLOSED') { departureLost = true; throw Error('Lost departure response'); }
    return result;
  });
  await actions(0)['room:create']({}, create);
  const value = [...gameRooms.values()][0];
  expect(creationLost).toBe(true);
  expect(await prisma.roomRecord.count({ where: { creatorId: players[0].id } })).toBe(1);
  leave.data.roomId = value.id;
  await actions(0)['room:leave'](leave.data, leave);
  expect(departureLost).toBe(true);
  expect(getSession(players[0].id).phase).toBe('idle');
  expect(await prisma.activeRoomMember.count({ where: { roomId: BigInt(value.id) } })).toBe(0);
  expect(await prisma.roomCommandReceipt.count({ where: { roomId: BigInt(value.id), key: leave.id } })).toBe(1);
});

it('retries failed disconnect persistence and arms cleanup from the accepted deadline', async () => {
  const value = await room(); getSession(players[0].id).connectionId = null;
  vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(Error('Storage unavailable'));
  await expect(reconcileRoomPresence(value)).rejects.toThrow(/Storage unavailable/);
  expect(value.players[0].online).toBe(true);
  await vi.waitFor(() => expect(value.players[0].online).toBe(false), { timeout: 3000 });
  const saved = await prisma.roomRecord.findUnique({ where: { id: BigInt(value.id) } });
  expect(saved.state.players[0].disconnectDeadline).toBe(value.players[0].disconnectDeadline);
  expect(value.expiryTimer).toBeTruthy();
  expect(getSession(players[0].id).disconnectTimer).toBeNull();
});

it('sends a restored waiting-room snapshot as the first state from a fresh server process', async () => {
  const value = await room({ isPrivate: true });
  await clearRuntime();
  const server = await startGameplayServer();
  try {
    expect((await server.connect(players[0])).snapshot).toMatchObject({ phase: 'in-room', context: { roomId: value.id },
      room: { id: value.id, joinCode: value.joinCode, status: 'waiting' } });
    await startGameplayOwnership();
    expect(await server.exited).toEqual({ code: 0, signal: null });
  } finally { await server.close(); }
});
