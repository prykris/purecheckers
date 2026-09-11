import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../server/app.js';
import * as searchService from '../server/services/searchService.js';
import serverPrisma from '../server/db.js';
import { setupSocket } from '../server/socket/index.js';
import { connectedUsers } from '../server/socket/connections.js';
import { getStats } from '../server/socket/presenceHandler.js';
import { activeGames, createGameDirect, stopMatchmaking, gameConfig, matchmakingConfig, publishRecoveredSettlement, stopGameRuntime } from '../server/domain/games.js';
import { gameRooms, leaveRoom, stopRoomRuntime, expireRoomMember, createQuickPlayRoom } from '../server/domain/rooms.js';
import { getSession, getAllSessions, removeSession, setPhase } from '../server/domain/sessions.js';
import { quickPlayPool } from '../server/services/quickPlay.js';
import { createSettlementRecovery } from '../server/services/settlementRecovery.js';
import { expireDisconnectedGame } from '../server/domain/lifecycle.js';
import { claimGameplayOwnership, startGameplayOwnership, onGameplayOwnershipLost } from '../server/services/gameplayOwnership.js';
import { commitGameTransition } from '../server/services/gameTransitions.js';
import { encodeCheckpoint, decodeCheckpoint } from '../server/domain/gameCheckpoint.js';
import { PROTOCOL_VERSION } from '../shared/protocol.js';
import { CHAT_EVENTS } from '../shared/chat.js';
import { retireExpiredGuest } from '../server/services/guestCleanup.js';
import { commitRoomRecord } from '../server/services/roomRecords.js';
import { createGameRun } from '../server/services/gameRuns.js';
import { projectRoomRecord } from '../server/domain/roomRuntime.js';
import { MATCHMAKING_BOT_FALLBACK_MS, COINS_BOT_WIN, BOT_WIN_DAILY_CAP, GUEST_LIFETIME_MS } from '../shared/constants.js';

const prisma = new PrismaClient();
let httpServer, io, url, users, clients;
const waitFor = (socket, event, predicate = () => true) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, listener); reject(new Error('Timeout: ' + event)); }, 5000);
  function listener(data) { if (!predicate(data)) return; clearTimeout(timer); socket.off(event, listener); resolve(data); }
  socket.on(event, listener);
});
async function connect(user, waitForSync = true) {
  const socket = ioClient(url, { autoConnect: false, reconnection: false, transports: ['websocket'], forceNew: true,
    auth: { token: jwt.sign({ userId: user.id, username: user.username, isGuest: user.isGuest }, process.env.JWT_SECRET) } });
  clients.push(socket);
  socket.on('sync:state', snapshot => socket.snapshot = snapshot);
  const ready = waitFor(socket, waitForSync ? 'sync:state' : 'connect'); socket.connect(); await ready;
  return socket;
}
async function sync(socket) { return socket.timeout(5000).emitWithAck('sync:request', {}); }
function envelope(socket, type, data = {}) {
  if (type === 'room:ready') data = { expectedSettings: socket.snapshot.room?.settings, ...data };
  return { protocolVersion: PROTOCOL_VERSION, id: randomUUID(), serverId: socket.snapshot.serverId,
    context: socket.snapshot.context, createdAt: Date.now(), type, data };
}
async function deliver(socket, request) { return socket.timeout(5000).emitWithAck('session:command', request); }
async function command(socket, type, data = {}) { return deliver(socket, envelope(socket, type, data)); }

it('delivers profile invitations through snapshots, recovers them on reconnect and starts only after acceptance and readiness', async () => {
  const invitation = waitFor(clients[1], 'sync:state', snapshot => snapshot.invitations?.length === 1);
  const request = envelope(clients[0], 'challenge:send', { userId: users[1].id });
  const sent = await deliver(clients[0], request);
  expect(sent.ok).toBe(true);
  const roomId = sent.snapshot.room.id;
  expect((await deliver(clients[0], request)).ok).toBe(true);
  expect(gameRooms.size).toBe(1);
  const received = await invitation;
  expect(received.phase).toBe('idle');
  clients[1].disconnect();
  const returning = await connect(users[1]);
  expect(returning.snapshot.invitations).toMatchObject([{ roomId }]);
  const accepted = await command(returning, 'room:join', { code: received.invitations[0].code });
  expect(accepted).toMatchObject({ ok: true, snapshot: { phase: 'in-room', invitations: [] } });
  expect(activeGames.size).toBe(0);
  await command(clients[0], 'room:ready', { roomId, ready: true });
  const started = await command(returning, 'room:ready', { roomId, ready: true });
  expect(started).toMatchObject({ ok: true, snapshot: { phase: 'in-game' } });
  const game = activeGames.get(started.snapshot.game.gameId);
  await finishReveal(game, clients[0], returning);
  expect(game.started).toBe(true);
});
async function revealedGame(turnTime = 60) {
  const room = await createGameDirect(users[0].id, users[1].id, 'FRIENDLY', 0, turnTime);
  await Promise.all(clients.slice(0, 2).map(sync)); return room;
}
async function finishReveal(room, ...sockets) {
  for (const socket of sockets) expect((await command(socket, 'game:reveal-done', { gameId: room.id })).ok).toBe(true);
}
// A game whose colour reveal both players have completed, so the clock runs and moves are accepted.
async function newGame(turnTime = 60) {
  const room = await revealedGame(turnTime);
  await finishReveal(room, clients[0], clients[1]); return room;
}
function move(socket, room, fromRow = 5, fromCol = 0, toRow = 4, toCol = 1, expectedPly = room.game.moveHistory.length) {
  return command(socket, 'game:move', { gameId: room.id, fromRow, fromCol, toRow, toCol, expectedPly });
}
async function waitingRoom() {
  const created = await command(clients[0], 'room:create');
  expect(created.ok).toBe(true);
  return gameRooms.get(created.snapshot.room.id);
}
async function twoPlayerRoom() {
  const room = await waitingRoom();
  expect((await command(clients[1], 'room:join', { roomId: room.id })).ok).toBe(true);
  return room;
}
async function reservedWaitingRoom() {
  const created = await command(clients[0], 'room:create', { buyIn: 20 });
  const room = gameRooms.get(created.snapshot.room.id);
  await command(clients[1], 'room:join', { roomId: room.id });
  await command(clients[0], 'room:ready', { roomId: room.id, ready: true });
  // Stage the durable boundary between reservation and installation directly.
  // A single lost response now confirms automatically in the live start flow.
  let record = await commitRoomRecord({ roomId: room.id, expectedRevision: room.revision }, draft => {
    draft.players.forEach(p => p.ready = true);
  });
  const key = randomUUID(), order = room.players.map(p => p.userId);
  record = await commitRoomRecord({ roomId: room.id, expectedRevision: record.room.revision }, draft => {
    draft.status = 'STARTING'; draft.startAttempt = { key, players: order };
  });
  await createGameRun({ key, roomId: room.id, redPlayerId: order[0], blackPlayerId: order[1], mode: 'RANKED', buyIn: 20, turnTime: 60, origin: 'room' });
  Object.assign(room, await projectRoomRecord(await prisma.roomRecord.findUnique({ where: { id: BigInt(room.id) } }), room));
  expect(room.status).toBe('playing');
  expect(await prisma.activeGamePlayer.count()).toBe(2);
  return room;
}
async function elapsedRoomDeadline(room, userId) {
  await room.changes;
  const result = await commitRoomRecord({ roomId: room.id, expectedRevision: room.revision }, draft => {
    const member = draft.players.find(p => p.userId === userId);
    member.online = false; member.disconnectDeadline = Date.now() - 1; member.ready = false;
  });
  Object.assign(room, await projectRoomRecord(result.room, room));
  clearTimeout(room.expiryTimer);
}
function pauseNextRoomImage() {
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const original = QRCode.toDataURL;
  const spy = vi.spyOn(QRCode, 'toDataURL').mockImplementationOnce(async (...args) => {
    entered(); await gate; return original(...args);
  });
  return { started, release, restore: () => spy.mockRestore() };
}
beforeAll(async () => {
  await startGameplayOwnership();
  httpServer = createServer(); io = new Server(httpServer); setupSocket(io);
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  url = 'http://127.0.0.1:' + httpServer.address().port;
});
beforeEach(async () => {
  await startGameplayOwnership();
  clients = [];
  await prisma.gameSettlementJob.deleteMany();
  await prisma.gameRun.deleteMany();
  await prisma.roomRecord.deleteMany();
  await prisma.game.deleteMany(); await prisma.coinTransaction.deleteMany();
  await prisma.inventory.deleteMany(); await prisma.friendship.deleteMany();
  await prisma.pendingPayout.deleteMany(); await prisma.user.deleteMany();
  users = await Promise.all(['Alice', 'Bob', 'Carol'].map(username => prisma.user.create({ data: { username, friendCode: username, coins: 100 } })));
  await connect(users[0]); await connect(users[1]);
});
afterEach(async () => {
  await stopRoomRuntime();
  for (const room of activeGames.values()) {
    room.stopTimer();
    clearTimeout(room.revealTimer);
    await room.transitions;
    room.game.gameOver = true;
    if (room.finalization) await room.finalization;
    clearTimeout(room.cleanupTimer);
  }
  clients.forEach(c => c.disconnect());
  await new Promise(resolve => setTimeout(resolve, 20));
  for (const id of getAllSessions().keys()) { quickPlayPool.remove(id); removeSession(id); }
  connectedUsers.clear(); activeGames.clear(); gameRooms.clear();
  await prisma.gameSettlementJob.deleteMany();
  await prisma.gameRun.deleteMany();
  await prisma.roomRecord.deleteMany();
});
afterAll(async () => { stopMatchmaking(); await new Promise(resolve => io.close(resolve)); await prisma.$disconnect(); });


describe('single authoritative command protocol', () => {
  it('acknowledges canonical emotes, rejects unowned and legacy payloads, and rate limits repeats', async () => {
    const room = await newGame();
    const items = await Promise.all([0, 10].map(price => prisma.shopItem.create({ data: {
      slug: randomUUID(), name: 'Socket emote', type: 'EMOTE', price, data: { emoji: '🤝', label: 'GG' }
    } })));
    try {
      const send = payload => clients[0].timeout(5000).emitWithAck('emote:send', { gameId: room.id, ...payload });
      expect(await clients[1].timeout(5000).emitWithAck('emote:send', { gameId: room.id, itemId: items[1].id })).toMatchObject({ ok: false, code: 'EMOTE_UNAVAILABLE' });
      expect(await send({ emote: { emoji: 'FORGED', label: 'forged' } })).toMatchObject({ ok: false, code: 'INVALID_EMOTE' });
      const received = waitFor(clients[1], 'emote:show');
      expect(await send({ itemId: items[0].id, emote: { emoji: 'FORGED' } })).toEqual({ ok: true });
      expect(await received).toEqual({ gameId: room.id, userId: users[0].id, username: users[0].username,
        emote: { id: items[0].id, name: 'Socket emote', emoji: '🤝', label: 'GG' } });
      expect(await send({ itemId: items[0].id })).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
      const spectator = await connect(users[2]);
      expect(await spectator.timeout(5000).emitWithAck('emote:send', { gameId: room.id, itemId: items[0].id })).toMatchObject({ ok: false, code: 'GAME_UNAVAILABLE' });
    } finally { await prisma.shopItem.deleteMany({ where: { id: { in: items.map(i => i.id) } } }); }
  });

  it('catches asynchronous entitlement failures and permits a later explicit emote retry', async () => {
    const room = await newGame();
    const item = await prisma.shopItem.create({ data: { slug: randomUUID(), name: 'Retry emote', type: 'EMOTE', price: 0, data: { emoji: '🤝', label: 'GG' } } });
    const failure = vi.spyOn(serverPrisma.shopItem, 'findFirst').mockRejectedValueOnce(Error('temporary lookup failure'));
    try {
      const send = () => clients[0].timeout(5000).emitWithAck('emote:send', { gameId: room.id, itemId: item.id });
      expect(await send()).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
      expect(await send()).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
      await new Promise(resolve => setTimeout(resolve, 2050));
      expect(await send()).toEqual({ ok: true });
    } finally { failure.mockRestore(); await prisma.shopItem.delete({ where: { id: item.id } }); }
  });

  it('loads current database identity when a socket presents an older guest name and flag', async () => {
    const socket = await connect({ ...users[2], username: 'Old Guest Name', isGuest: true });
    expect(getSession(users[2].id)).toMatchObject({ username: users[2].username, isGuest: false, connectionId: socket.id });
  });

  it('rejects a valid socket token for a retired guest instead of recreating a session', async () => {
    const retired = await prisma.user.update({ where: { id: users[2].id }, data: { isGuest: true, coins: 0, guestExpiresAt: new Date(Date.now() - 10000) } });
    expect(await retireExpiredGuest(retired.id)).toBe('retired');
    const socket = ioClient(url, { autoConnect: false, transports: ['websocket'], reconnection: false,
      auth: { token: jwt.sign({ userId: retired.id, username: retired.username, isGuest: true }, process.env.JWT_SECRET, { expiresIn: '1d' }) } });
    clients.push(socket);
    const denied = waitFor(socket, 'connect_error'); socket.connect();
    expect((await denied).message).toMatch(/no longer available/);
    expect(getSession(retired.id)).toBeNull();
  });

  it('updates a room guest flag during account upgrade so its next game uses the current registered status', async () => {
    const created = await request(app).post('/api/guest').send({ username: 'Room Guest' });
    const guestSocket = await connect(created.body.user);
    const waiting = await command(guestSocket, 'room:create');
    const room = gameRooms.get(waiting.snapshot.room.id);
    await command(clients[1], 'room:join', { roomId: room.id });
    expect((await sync(guestSocket)).room.effectiveMode).toBe('FRIENDLY');
    const upgraded = await request(app).post('/api/auth/upgrade').set('Authorization', `Bearer ${created.body.token}`)
      .send({ username: 'Room Registered', email: 'room-upgrade@test.invalid', password: 'password123' });
    expect(upgraded.status).toBe(200);
    expect((await sync(guestSocket)).room).toMatchObject({ hostName: 'Room Registered', effectiveMode: 'RANKED' });
    expect(room.players.find(player => player.userId === created.body.user.id).isGuest).toBe(false);
    await command(guestSocket, 'room:ready', { roomId: room.id, ready: true });
    const started = await command(clients[1], 'room:ready', { roomId: room.id, ready: true });
    expect(started.ok).toBe(true); expect(started.snapshot.game.mode).toBe('RANKED');
  });

  it('retains forced room removal reasons across reconnect and acknowledges dismissal', async () => {
    const room = await twoPlayerRoom();
    const removed = waitFor(clients[1], 'sync:state', s => s.phase === 'idle' && s.notice?.reason === 'room-kicked');
    await command(clients[0], 'room:kick', { roomId: room.id, userId: users[1].id });
    const notice = (await removed).notice;
    clients[1].disconnect(); const reconnected = await connect(users[1]);
    expect(reconnected.snapshot.notice).toEqual(notice);
    expect((await command(reconnected, 'notice:dismiss', { noticeId: 'old-notice' })).snapshot.notice).toEqual(notice);
    expect((await command(reconnected, 'notice:dismiss', { noticeId: notice.id })).snapshot.notice).toBeNull();
    expect((await sync(reconnected)).notice).toBeNull();
  });
  it('acknowledges complete public room reads and publishes versioned removals', async () => {
    const room = await waitingRoom();
    const list = await clients[1].timeout(5000).emitWithAck('room:list', {});
    expect(list.ok).toBe(true); expect(list.rooms.map(r => r.id)).toContain(room.id);
    const removed = waitFor(clients[1], 'room:list-update', value => value.room.id === room.id && value.room.closed);
    await command(clients[0], 'room:leave', { roomId: room.id });
    expect((await removed).revision).toBeGreaterThan(list.revision);
    expect((await clients[1].timeout(5000).emitWithAck('room:list', {})).rooms).toEqual([]);
  });
  it('acknowledges chat once and restores its persisted content after reconnect', async () => {
    const room = await newGame();
    const data = { channelId: `game:${room.id}`, content: '<b>Hello</b> &lt;literal&gt;', clientMessageId: randomUUID() };
    const received = waitFor(clients[1], CHAT_EVENTS.message, m => m.clientMessageId === data.clientMessageId);
    const first = await clients[0].timeout(5000).emitWithAck(CHAT_EVENTS.send, data);
    expect(first.ok).toBe(true); expect((await received).content).toBe(data.content);
    clients[0].disconnect(); const reconnected = await connect(users[0]);
    const retry = await reconnected.timeout(5000).emitWithAck(CHAT_EVENTS.send, data);
    expect(retry.message.id).toBe(first.message.id);
    const history = await reconnected.timeout(5000).emitWithAck(CHAT_EVENTS.history, { channelId: data.channelId });
    expect(history.messages.filter(m => m.clientMessageId === data.clientMessageId)).toEqual([first.message]);
    expect(await prisma.chatMessage.count({ where: { clientMessageId: data.clientMessageId } })).toBe(1);
  });
  it('publishes disconnect deadlines, connected spectators and names after room cleanup', async () => {
    const waiting = await twoPlayerRoom();
    await command(clients[0], 'room:ready', { roomId: waiting.id, ready: true });
    await command(clients[1], 'room:ready', { roomId: waiting.id, ready: true });
    const watcher = await connect(users[2]);
    const watched = await command(watcher, 'room:spectate', { roomId: waiting.id });
    expect(watched.ok).toBe(true);
    expect((await sync(clients[0])).game.spectatorCount).toBe(1);
    const game = activeGames.get(waiting.gameId);
    gameRooms.delete(waiting.id);
    const recovered = await sync(watcher);
    expect(recovered.spectate.redName).toBe(game.playerNames[game.redUserId]);
    expect(recovered.spectate.blackName).toBe(game.playerNames[game.blackUserId]);
    const countChanged = waitFor(clients[0], 'sync:state', s => s.game?.spectatorCount === 0);
    watcher.disconnect(); await countChanged;
    const away = waitFor(clients[0], 'sync:state', s => s.game?.opponentOnline === false);
    clients[1].disconnect(); const disconnected = await away;
    expect(disconnected.game.opponentReconnectDeadline).toBeGreaterThan(disconnected.serverTime + 29000);
    expect((await sync(clients[0])).game.opponentReconnectDeadline).toBe(disconnected.game.opponentReconnectDeadline);
    expect((await sync(clients[0])).game.opponentIsBot).toBe(false);
  });
  it('matches two searchers through explicit room/start transitions', async () => {
    const found = waitFor(clients[0], 'sync:state', s => s.phase === 'in-game');
    expect((await command(clients[0], 'matchmaking:join')).snapshot.phase).toBe('matchmaking');
    await command(clients[1], 'matchmaking:join');
    const state = await found;
    expect(state.game.board).toHaveLength(8);
    expect(state.game.gameId).toBe((await sync(clients[1])).game.gameId);
  });
  it('acknowledges moves with the full resulting state and rejects stale plies', async () => {
    const room = await newGame();
    const result = await move(clients[0], room);
    expect(result.ok).toBe(true); expect(result.snapshot.game.board[4][1].color).toBe('red');
    expect((await move(clients[0], room, 5, 0, 4, 1, 0)).ok).toBe(false);
    expect(room.game.moveHistory).toHaveLength(1);
  });
  it('replays a receipt after a lost acknowledgement without reapplying the move', async () => {
    const room = await newGame();
    const request = envelope(clients[0], 'game:move', { gameId: room.id, fromRow: 5, fromCol: 0, toRow: 4, toCol: 1, expectedPly: 0 });
    const moved = waitFor(clients[1], 'sync:state', s => s.game?.moveHistory.length === 1);
    clients[0].emit('session:command', request, () => {}); await moved;
    clients[0].disconnect(); const replacement = await connect(users[0]);
    expect((await deliver(replacement, request)).ok).toBe(true);
    expect(room.game.moveHistory).toHaveLength(1);
    expect((await deliver(replacement, { ...request, data: { ...request.data, toCol: 3 } })).error).toMatch(/reused/);
  });
  it('rejects expired, malformed, unknown and previous-context commands with recoverable snapshots', async () => {
    const room = await newGame();
    const base = envelope(clients[0], 'game:move', { gameId: room.id });
    for (const request of [null, { ...base, type: 'unknown' }, { ...base, createdAt: Date.now()-40000 }, { ...base, context: { roomId: null, gameId: 9, spectatingRoomId: null } }]) {
      const reply = await deliver(clients[0], request);
      expect(reply.ok).toBe(false); expect(reply.snapshot.phase).toBe('in-game');
    }
    for (const fromRow of [null, '5', 1.5, {}, -1, 99]) expect((await move(clients[0], room, fromRow)).ok).toBe(false);
    expect((await move(clients[0], room)).ok).toBe(true);
  });
  it('does not register legacy mutation events', async () => {
    const room = await newGame();
    clients[0].emit('game:resign', { gameId: room.id });
    expect((await sync(clients[0])).game.gameOver).toBe(false);
    expect(connectedUsers.get(users[0].id).socket.listeners('game:move')).toHaveLength(0);
  });
  it('cannot leave a live game or cancel it through an unrelated command', async () => {
    const room = await newGame();
    for (const type of ['game:leave', 'matchmaking:leave', 'room:leave']) expect((await command(clients[0], type, { gameId: room.id, roomId: 123 })).ok).toBe(false);
    expect((await sync(clients[0])).phase).toBe('in-game');
  });
  it('restores a capture chain and opponent presence after transport replacement', async () => {
    const room = await newGame();
    room.game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    room.game.board[5][0] = { color: 'red', queen: false };
    for (const [r,c] of [[4,1],[2,3],[0,7]]) room.game.board[r][c] = { color: 'black', queen: false };
    await move(clients[0], room, 5, 0, 3, 2);
    const offline = waitFor(clients[1], 'sync:state', s => s.game?.opponentOnline === false);
    clients[0].disconnect(); await offline;
    const replacement = await connect(users[0]);
    expect(replacement.snapshot.game.chainPiece).toEqual({ row: 3, col: 2 });
    expect(getSession(users[0].id).disconnectTimer).toBeNull();
    expect((await move(replacement, room, 3, 2, 1, 4)).ok).toBe(true);
    expect(room.game.chainPiece).toBeNull();
  });
  it('supersedes an old connection without disconnecting its replacement', async () => {
    const room = await newGame();
    const kicked = waitFor(clients[0], 'session:kicked');
    const replacement = await connect(users[0]); await kicked;
    expect(getSession(users[0].id).connectionId).toBe(replacement.id);
    expect(getSession(users[0].id).disconnectTimer).toBeNull();
    expect((await move(replacement, room)).ok).toBe(true);
  });
  it('latches competing terminal events and restores the completed result on reconnect', async () => {
    const room = await newGame();
    const result = await command(clients[0], 'game:resign', { gameId: room.id });
    expect(result.snapshot.game.gameOver).toBe(true);
    const first = room.finalization;
    expect(room.endGame('red')).toBe(first);
    await first;
    expect(await prisma.game.count()).toBe(1);
    const replacement = await connect(users[0]);
    expect(replacement.snapshot.game.resultData.winner).toBe('black');
  });
  it('charges elapsed time before accepting a late move and honors unlimited clocks', async () => {
    const room = await newGame(30); room.game.redTime = 0.01; room.lastClockAt = performance.now()-100;
    expect((await move(clients[0], room)).ok).toBe(false);
    expect(room.game.gameOver).toBe(true); expect(room.game.moveHistory).toHaveLength(0);
    await room.finalization;
    await command(clients[0], 'game:leave', { gameId: room.id }); await command(clients[1], 'game:leave', { gameId: room.id });
    const unlimited = await newGame(0); unlimited.lastClockAt = performance.now()-10000000; await unlimited.advanceClock();
    expect(unlimited.game.gameOver).toBe(false);
  });
  it('restores draw offers, declines and cooldown from snapshots', async () => {
    const room = await newGame();
    await command(clients[0], 'game:draw-offer', { gameId: room.id });
    expect((await sync(clients[1])).game.pendingDrawOffer).toBe(users[0].id);
    await command(clients[1], 'game:draw-response', { gameId: room.id, accepted: false });
    expect((await sync(clients[0])).game.pendingDrawOffer).toBeNull();
    expect((await command(clients[0], 'game:draw-offer', { gameId: room.id })).ok).toBe(false);
  });
  it('serializes duplicate room creation and explicit readiness commands', async () => {
    const request = envelope(clients[0], 'room:create');
    const [a,b] = await Promise.all([deliver(clients[0], request), deliver(clients[0], request)]);
    expect(a.snapshot.room.id).toBe(b.snapshot.room.id); expect(gameRooms.size).toBe(1);
    const roomId = a.snapshot.room.id;
    await command(clients[0], 'room:ready', { roomId, ready: true });
    await command(clients[0], 'room:ready', { roomId, ready: true });
    expect((await sync(clients[0])).room.players[0].ready).toBe(true);
    expect((await command(clients[0], 'room:ready', { roomId })).ok).toBe(false);
  });
  it('reserves the last seat across concurrent joins', async () => {
    const room = await waitingRoom(); const third = await connect(users[2]);
    const responses = await Promise.all([command(clients[1], 'room:join', { roomId: room.id }), command(third, 'room:join', { roomId: room.id })]);
    expect(responses.filter(result => result.ok)).toHaveLength(1); expect(room.players).toHaveLength(2);
  });
  it('clears readiness on disconnect and restores room membership on reconnect', async () => {
    const room = await twoPlayerRoom();
    await command(clients[0], 'room:ready', { roomId: room.id, ready: true });
    const offline = waitFor(clients[1], 'sync:state', s => s.room?.players[0].online === false);
    clients[0].disconnect(); await offline;
    const replacement = await connect(users[0]);
    expect(replacement.snapshot.phase).toBe('in-room'); expect(replacement.snapshot.room.players[0].ready).toBe(false);
  });
  it('keeps bots ready after a human leaves and closes a bot-only room', async () => {
    const room = await waitingRoom();
    await command(clients[0], 'bot:join', { roomId: room.id, difficulty: 'easy' });
    expect(room.players.find(p => p.isBot).ready).toBe(true);
    await command(clients[0], 'room:leave', { roomId: room.id });
    expect(gameRooms.has(room.id)).toBe(false);
  });
  it('starts bot play with one command and the bot takes its turn', async () => {
    const result = await command(clients[0], 'bot:play', { difficulty: 'easy' });
    expect(result.ok).toBe(true); expect(result.snapshot.phase).toBe('in-game');
    const game = activeGames.get(result.snapshot.game.gameId);
    expect(result.snapshot.game.started).toBe(false);
    expect(result.snapshot.game.revealAcks).toEqual([game.botIds.values().next().value]); // the bot is already past the wheel
    expect((await command(clients[0], 'game:reveal-done', { gameId: game.id })).snapshot.game.started).toBe(true);
    if (game.getPlayerColor(users[0].id) === 'red') await move(clients[0], game);
    if (game.game.moveHistory.length < (game.getPlayerColor(users[0].id) === 'red' ? 2 : 1)) await waitFor(clients[0], 'sync:state', s => s.game?.currentPlayer === game.getPlayerColor(users[0].id));
    expect(game.game.currentPlayer).toBe(game.getPlayerColor(users[0].id)); expect(game.game.moveHistory.length).toBeGreaterThan(0);
  });
  it('discards a delayed bot proposal after resignation and cancels its work', async () => {
    let release, started;
    const submitted = new Promise(resolve => { started = resolve; });
    let signal;
    const proposal = vi.spyOn(searchService, 'chooseBotMove').mockImplementation((game, difficulty, options) => {
      signal = options.signal;
      const legal = game.getAllValidMoves()[0];
      started();
      return new Promise(resolve => { release = () => resolve(legal); });
    });
    try {
      const bot = await prisma.user.create({ data: { username: 'Bot Hard', botKey: 'hard', isBot: true, friendCode: 'LATEBOT' } });
      const room = await createGameDirect(bot.id, users[0].id, 'FRIENDLY', 0, 0);
      await sync(clients[0]);
      await command(clients[0], 'game:reveal-done', { gameId: room.id });
      await submitted;
      expect((await command(clients[0], 'game:resign', { gameId: room.id })).ok).toBe(true);
      expect(signal.aborted).toBe(true);
      release();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(room.game.moveHistory).toEqual([]);
      expect(room.botScheduled).toBe(false);
      expect((await sync(clients[0])).game.gameOver).toBe(true);
    } finally { release?.(); proposal.mockRestore(); }
  });
  it('deletes abandoned bot rooms through the same room cleanup rule', async () => {
    const room = await waitingRoom(); await command(clients[0], 'bot:join', { roomId: room.id, difficulty: 'easy' });
    await leaveRoom(room, users[0].id);
    expect(gameRooms.size).toBe(0); expect((await sync(clients[0])).phase).toBe('idle');
  });
  it('recovers spectators before and after a game starts, and releases subscriptions on leave', async () => {
    const room = await twoPlayerRoom(); const spectator = await connect(users[2]);
    await command(spectator, 'room:spectate', { roomId: room.id });
    spectator.disconnect(); const replacement = await connect(users[2]);
    expect(replacement.snapshot.spectate.room.spectators).toHaveLength(1);
    await command(clients[0], 'room:ready', { roomId: room.id, ready: true });
    await command(clients[1], 'room:ready', { roomId: room.id, ready: true });
    const state = await sync(replacement); expect(state.spectate.gameState.board).toHaveLength(8);
    await command(replacement, 'room:leave', { roomId: room.id });
    const subscriptions = connectedUsers.get(users[2].id).socket.rooms;
    expect([...subscriptions].some(name => /^(room:|game:|chat:room:|chat:game:)/.test(name))).toBe(false);
  });
  it('assigns colours immediately but waits for both players to finish the reveal', async () => {
    const room = await revealedGame();
    expect(clients[0].snapshot.game).toMatchObject({ started: false, revealAcks: [] });
    expect(clients[0].snapshot.game.revealDeadline).toBeGreaterThan(Date.now());
    expect(room.timerInterval).toBeNull();
    expect((await move(clients[0], room)).error).toMatch(/not started/);
    const partial = await command(clients[0], 'game:reveal-done', { gameId: room.id });
    expect(partial.snapshot.game).toMatchObject({ started: false, revealAcks: [users[0].id] });
    expect((await command(clients[0], 'game:reveal-done', { gameId: room.id })).snapshot.game.revealAcks).toEqual([users[0].id]);
    const started = waitFor(clients[0], 'sync:state', s => s.game?.started === true);
    expect((await command(clients[1], 'game:reveal-done', { gameId: room.id })).snapshot.game.started).toBe(true);
    await started;
    expect(room.timerInterval).not.toBeNull();
    expect(room.game.redTime).toBe(60);
    expect((await move(clients[0], room)).ok).toBe(true);
  });
  it('keeps a finished reveal across reconnect and starts the game when the deadline passes', async () => {
    gameConfig.revealTimeoutMs = 300;
    try {
      const room = await revealedGame();
      await command(clients[0], 'game:reveal-done', { gameId: room.id });
      clients[0].disconnect(); const replacement = await connect(users[0]);
      expect(replacement.snapshot.game).toMatchObject({ started: false, revealAcks: [users[0].id] });
      await waitFor(replacement, 'sync:state', s => s.game?.started === true);
      expect(room.started).toBe(true); expect(room.timerInterval).not.toBeNull();
    } finally { gameConfig.revealTimeoutMs = 12000; }
  });
  it('ends a game during the reveal without ever starting its clock', async () => {
    const room = await revealedGame();
    const result = await command(clients[1], 'game:resign', { gameId: room.id });
    expect(result.snapshot.game).toMatchObject({ gameOver: true, started: false, winner: 'red' });
    await room.finalization;
    expect(room.revealTimer).toBeNull(); expect(room.timerInterval).toBeNull();
    expect((await command(clients[0], 'game:reveal-done', { gameId: room.id })).snapshot.game.started).toBe(false);
  });
});

describe('first session on an empty server', () => {
  // A bot game the human can end at will; returns the GameRoom.
  async function botGame(socket = clients[0], difficulty = 'easy') {
    const result = await command(socket, 'bot:play', { difficulty });
    expect(result.ok).toBe(true); expect(result.snapshot.phase).toBe('in-game');
    return activeGames.get(result.snapshot.game.gameId);
  }
  async function finished(room, winner) {
    await room.endGame(winner); await room.finalization; return room;
  }
  const settle = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));

  describe('scan-to-play rooms', () => {
    it("starts an autoReady room inside the friend's join, with no room:ready from anyone", async () => {
      const created = await command(clients[0], 'room:create', { autoReady: true, isPrivate: true });
      expect(created.ok).toBe(true);
      expect(created.snapshot.room).toMatchObject({ autoReady: true, hostId: users[0].id, settings: { autoReady: true, isPrivate: true } });
      expect(created.snapshot.room.joinUrl).toMatch(new RegExp('/join/' + created.snapshot.room.joinCode + '$'));
      expect(created.snapshot.room.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      const hostStarted = waitFor(clients[0], 'sync:state', s => s.phase === 'in-game');
      const joined = await command(clients[1], 'room:join', { code: created.snapshot.room.joinCode });
      expect(joined.ok).toBe(true);
      expect(joined.snapshot.phase).toBe('in-game');
      expect(joined.snapshot.game).toMatchObject({ origin: 'room', mode: 'RANKED', persistStatus: 'pending', endedAt: null, replayId: null, opponentLeft: false });
      expect((await hostStarted).game).toMatchObject({ gameId: joined.snapshot.game.gameId, enteredViaInvite: false });
      expect(joined.snapshot.game.enteredViaInvite).toBe(true);
      expect((await prisma.gameRun.findUnique({ where: { id: joined.snapshot.game.gameId } })).invitedPlayerIds).toEqual([users[1].id]);
      clients[1].disconnect(); const reconnected = await connect(users[1]);
      expect((await sync(reconnected)).game.enteredViaInvite).toBe(true);
      expect(gameRooms.get(created.snapshot.room.id).status).toBe('playing');
    });
    it('encodes the app route in the scannable image', async () => {
      const created = await command(clients[0], 'room:create', { autoReady: true, isPrivate: true });
      const { default: QRCode } = await import('qrcode');
      const { SITE_URL } = await import('../server/config.js');
      const expected = await QRCode.toDataURL(SITE_URL + '/invite/' + created.snapshot.room.joinCode, { width: 200, margin: 1 });
      expect(created.snapshot.room.qrDataUrl).toBe(expected);
    });
    it('keeps the ready dance for a room created without autoReady', async () => {
      const room = await twoPlayerRoom();
      expect(room.status).toBe('waiting');
      const snapshot = await sync(clients[1]);
      expect(snapshot.phase).toBe('in-room'); expect(snapshot.room.autoReady).toBe(false);
    });
    it('rejects autoReady with a buy-in and non-boolean flags', async () => {
      const rejected = await command(clients[0], 'room:create', { autoReady: true, buyIn: 10 });
      expect(rejected.ok).toBe(false); expect(rejected.error).toMatch(/buy-in/i);
      expect((await command(clients[0], 'room:create', { autoReady: 'yes' })).ok).toBe(false);
      expect(rejected.snapshot.phase).toBe('idle'); expect(gameRooms.size).toBe(0);
    });
    it("waits for an offline host and starts on the host's reconnect", async () => {
      const created = await command(clients[0], 'room:create', { autoReady: true, isPrivate: true });
      const code = created.snapshot.room.joinCode;
      clients[0].disconnect(); await settle();
      const joined = await command(clients[1], 'room:join', { code });
      expect(joined.ok).toBe(true); expect(joined.snapshot.phase).toBe('in-room');
      expect(joined.snapshot.room.players.find(p => p.userId === users[0].id).online).toBe(false);
      const started = waitFor(clients[1], 'sync:state', s => s.phase === 'in-game');
      const replacement = await connect(users[0]);
      expect((await started).game.gameId).toBe((await sync(replacement)).game.gameId);
    });
    it('retries a failed auto-start with room:ready', async () => {
      const created = await command(clients[0], 'room:create', { autoReady: true, isPrivate: true });
      const original = serverPrisma.user.findUnique;
      let calls = 0;
      // The joiner's lookup succeeds; both automatic start attempts fail.
      serverPrisma.user.findUnique = async (...args) => { if (++calls > 1) throw new Error('database hiccup'); return original.apply(serverPrisma.user, args); };
      try {
        const joined = await command(clients[1], 'room:join', { code: created.snapshot.room.joinCode });
        expect(joined.ok).toBe(false); expect(joined.error).toMatch(/could not start/i);
        expect(joined.snapshot.phase).toBe('in-room'); expect(joined.snapshot.room.status).toBe('waiting');
        expect(joined.snapshot.room.readyToStart).toBe(true);
      } finally { serverPrisma.user.findUnique = original; }
      const retried = await command(clients[1], 'room:ready', { roomId: created.snapshot.room.id, ready: true });
      expect(retried.ok).toBe(true); expect(retried.snapshot.phase).toBe('in-game');
    });
    it('serves the invite pre-check for a live room and 404s once it is gone', async () => {
      const created = await command(clients[0], 'room:create', { autoReady: true, isPrivate: true });
      const code = created.snapshot.room.joinCode;
      const live = await request(app).get('/api/rooms/invite/' + code.toLowerCase());
      expect(live.status).toBe(200);
      expect(live.body).toEqual({ hostName: 'Alice', status: 'waiting', playerCount: 1, buyIn: 0, turnTimer: 60, autoReady: true });
      await command(clients[0], 'room:leave', { roomId: created.snapshot.room.id });
      const gone = await request(app).get('/api/rooms/invite/' + code);
      expect(gone.status).toBe(404); expect(gone.body).toEqual({ error: 'Room not found' });
      expect((await request(app).get('/api/rooms/invite/ABC')).status).toBe(400);
      expect((await request(app).get('/api/rooms/invite/ABC10O')).status).toBe(400);
    });
  });

  describe('search fallback', () => {
    it('publishes the server deadline and opens it immediately when nobody else is online', async () => {
      const before = Date.now();
      const joined = await command(clients[0], 'matchmaking:join');
      const { matchmaking } = joined.snapshot;
      expect(matchmaking.joinedAt).toBeGreaterThanOrEqual(before);
      expect(matchmaking.botFallbackAt).toBe(matchmaking.joinedAt + MATCHMAKING_BOT_FALLBACK_MS);
      expect(matchmaking.fallbackOpen).toBe(false);
      expect((await sync(clients[0])).matchmaking.joinedAt).toBe(matchmaking.joinedAt); // not regenerated per snapshot
      await command(clients[0], 'matchmaking:leave');
      expect(getSession(users[0].id).fallbackTimer).toBeNull();
      clients[1].disconnect(); await settle();
      const alone = await command(clients[0], 'matchmaking:join');
      expect(alone.snapshot.matchmaking.botFallbackAt).toBe(alone.snapshot.matchmaking.joinedAt);
      expect(alone.snapshot.matchmaking.fallbackOpen).toBe(true);
    });
    it('republishes at the deadline so fallbackOpen flips without a client clock', async () => {
      matchmakingConfig.botFallbackMs = 200;
      try {
        const opened = waitFor(clients[0], 'sync:state', s => s.matchmaking?.fallbackOpen === true);
        const joined = await command(clients[0], 'matchmaking:join');
        expect(joined.snapshot.matchmaking.fallbackOpen).toBe(false);
        const snapshot = await opened;
        expect(snapshot.phase).toBe('matchmaking');
        expect(Date.now()).toBeGreaterThanOrEqual(snapshot.matchmaking.botFallbackAt);
      } finally { matchmakingConfig.botFallbackMs = MATCHMAKING_BOT_FALLBACK_MS; }
    });
    it('starts a bot game from the search with one command and leaves no pool entry behind', async () => {
      await command(clients[0], 'matchmaking:join');
      expect(quickPlayPool.has(users[0].id)).toBe(true);
      const result = await command(clients[0], 'bot:play', { difficulty: 'easy' });
      expect(result.ok).toBe(true); expect(result.snapshot.phase).toBe('in-game');
      expect(result.snapshot.game.origin).toBe('bot');
      expect(quickPlayPool.has(users[0].id)).toBe(false);
      expect(getSession(users[0].id).fallbackTimer).toBeNull();
      // Another searcher arriving cannot pair with the player who left for a bot game.
      quickPlayPool.add(users[1].id, 1000, false);
      expect(quickPlayPool.tryMatch()).toEqual([]);
      expect(getSession(users[0].id).phase).toBe('in-game');
      expect((await command(clients[0], 'matchmaking:leave')).ok).toBe(false);
    });
    it('counts only the quick-play queue as searching', async () => {
      const stats = waitFor(clients[1], 'presence:stats', s => s.searching === 1);
      await command(clients[0], 'matchmaking:join');
      expect(await stats).toEqual({ online: 2, humansOnline: 2, searching: 1 });
      await command(clients[1], 'room:create');
      expect(getStats()).toEqual({ online: 2, humansOnline: 2, searching: 1 });
      expect((await request(app).get('/api/presence')).body).toEqual({ online: 2, humansOnline: 2, searching: 1 });
    });
  });

  describe('session work ordering', () => {
    it('lets an already-admitted human pair finish before a bot fallback command', async () => {
      stopMatchmaking();
      await command(clients[0], 'matchmaking:join');
      await command(clients[1], 'matchmaking:join');
      const [pair] = quickPlayPool.tryMatch(), gate = pauseNextRoomImage();
      let paired, fallback;
      try {
        paired = createQuickPlayRoom(pair.a, pair.b);
        await gate.started;
        const received = new Promise(resolve => connectedUsers.get(users[0].id).socket.once('session:command', resolve));
        fallback = command(clients[0], 'bot:play', { difficulty: 'easy' });
        await received;
        gate.release(); await paired;
        expect((await fallback).ok).toBe(false);
        expect(activeGames.size).toBe(1);
        const game = [...activeGames.values()][0];
        expect(game.getPlayerColor(users[0].id)).toBeTruthy();
        expect(game.getPlayerColor(users[1].id)).toBeTruthy();
        expect((await sync(clients[0])).game.origin).toBe('quickplay');
      } finally { gate.release(); await Promise.allSettled([paired, fallback]); gate.restore(); }
    });

    it('lets an earlier bot command finish before examining a captured human pair', async () => {
      stopMatchmaking();
      await command(clients[0], 'matchmaking:join');
      await command(clients[1], 'matchmaking:join');
      const [pair] = quickPlayPool.tryMatch(), gate = pauseNextRoomImage();
      let paired, fallback;
      try {
        fallback = command(clients[0], 'bot:play', { difficulty: 'easy' });
        await gate.started;
        paired = createQuickPlayRoom(pair.a, pair.b);
        gate.release();
        expect((await fallback).ok).toBe(true);
        await paired;
        expect(activeGames.size).toBe(1);
        expect((await sync(clients[0])).game.origin).toBe('bot');
        expect((await sync(clients[1])).phase).toBe('matchmaking');
        expect(quickPlayPool.has(users[1].id)).toBe(true);
        expect(await prisma.roomRecord.count()).toBe(1);
      } finally { gate.release(); await Promise.allSettled([paired, fallback]); gate.restore(); }
    });

    it('recovers a replacement connection only after its obsolete creation has settled', async () => {
      const gate = pauseNextRoomImage();
      let creation, replacement;
      try {
        creation = command(clients[0], 'room:create').catch(() => null);
        await gate.started;
        replacement = await connect(users[0], false);
        expect(replacement.snapshot).toBeUndefined();
        const restored = waitFor(replacement, 'sync:state');
        gate.release();
        expect((await restored).phase).toBe('idle');
        await creation;
        expect(await prisma.roomRecord.count()).toBe(0);
        expect((await command(replacement, 'room:create')).ok).toBe(true);
      } finally { gate.release(); await Promise.allSettled([creation]); gate.restore(); }
    });
  });

  describe('game over', () => {
    it('accepts idle commands from a finished game and releases it first', async () => {
      const room = await botGame();
      expect((await command(clients[0], 'bot:play', { difficulty: 'easy' })).ok).toBe(false); // live game: still bound to the phase
      await finished(room, room.getPlayerColor(users[0].id) === 'red' ? 'black' : 'red');
      expect((await sync(clients[0])).game.gameOver).toBe(true);
      const again = await command(clients[0], 'bot:play', { difficulty: 'medium' });
      expect(again.ok).toBe(true); expect(again.snapshot.phase).toBe('in-game');
      expect(again.snapshot.game.gameId).not.toBe(room.id);
      expect(getSession(users[0].id).gameId).toBe(again.snapshot.game.gameId);
      const second = activeGames.get(again.snapshot.game.gameId);
      await finished(second, second.getPlayerColor(users[0].id));
      expect((await command(clients[0], 'room:ready', { roomId: 1, ready: true })).ok).toBe(false); // not an idle command
      const searching = await command(clients[0], 'matchmaking:join');
      expect(searching.ok).toBe(true); expect(searching.snapshot.phase).toBe('matchmaking');
      await command(clients[0], 'matchmaking:leave');
      const third = await botGame();
      await finished(third, third.getPlayerColor(users[0].id));
      const created = await command(clients[0], 'room:create', { autoReady: true, isPrivate: true });
      expect(created.ok).toBe(true); expect(created.snapshot.phase).toBe('in-room');
    });
    it('shows a departed opponent and refuses the rematch, publishing each request', async () => {
      const room = await newGame();
      await command(clients[1], 'game:resign', { gameId: room.id }); await room.finalization;
      const seen = waitFor(clients[1], 'sync:state', s => s.game?.rematchRequests?.includes(users[0].id));
      expect((await command(clients[0], 'game:rematch-request', { gameId: room.id })).ok).toBe(true);
      expect((await seen).game.opponentLeft).toBe(false);
      const left = waitFor(clients[0], 'sync:state', s => s.game?.opponentLeft === true);
      expect((await command(clients[1], 'game:leave', { gameId: room.id })).snapshot.phase).toBe('idle');
      await left;
      const rematch = await command(clients[0], 'game:rematch-request', { gameId: room.id });
      expect(rematch.ok).toBe(false); expect(rematch.error).toBe('Your opponent has left');
      expect(rematch.snapshot.game).toMatchObject({ opponentLeft: true, mode: 'FRIENDLY', origin: 'room' });
    });
    it('releases the finished game for the opponent when an idle command is accepted', async () => {
      const room = await newGame();
      await command(clients[0], 'game:resign', { gameId: room.id }); await room.finalization;
      const left = waitFor(clients[1], 'sync:state', s => s.game?.opponentLeft === true);
      expect((await command(clients[0], 'matchmaking:join')).snapshot.phase).toBe('matchmaking');
      await left;
    });
  });

  describe('replay id plumbing', () => {
    it('reports the database Game.id and its persistence status to players and the game log', async () => {
      const room = await botGame();
      expect((await sync(clients[0])).game).toMatchObject({ persistStatus: 'pending', replayId: null, endedAt: null });
      const announced = waitFor(clients[1], 'global:game-ended');
      await finished(room, room.getPlayerColor(users[0].id) === 'red' ? 'black' : 'red');
      expect(room.resultData.persistStatus).toBe('saved');
      expect(typeof room.resultData.replayId).toBe('number');
      expect(room.resultData.endedAt).toBe(room.endedAt);
      const served = await request(app).get('/api/leaderboard/game/' + room.resultData.replayId);
      expect(served.status).toBe(200);
      expect(served.body.game).toMatchObject({ id: room.resultData.replayId, isBotGame: true, mode: 'FRIENDLY', redEloChange: 0, blackEloChange: 0 });
      expect(new Date(served.body.game.endedAt).getTime()).toBe(room.endedAt);
      expect(served.body.game.endReason).toBe(room.resultData.endReason);
      const payload = await announced;
      expect(payload).toMatchObject({ id: room.resultData.replayId, isBotGame: true, mode: 'FRIENDLY' });
      const snapshot = await sync(clients[0]);
      expect(snapshot.game).toMatchObject({ replayId: room.resultData.replayId, persistStatus: 'saved', endedAt: room.endedAt, origin: 'bot' });
      expect(snapshot.game.resultData.replayId).toBe(room.resultData.replayId);
    });
    it('retains a committed terminal intent and publishes the saved result after settlement recovery', async () => {
      const room = await botGame();
      const original = serverPrisma.$transaction;
      let terminalCommitted = false;
      serverPrisma.$transaction = async function (...args) {
        if (terminalCommitted) throw new Error('database unavailable');
        const result = await original.apply(this, args);
        if (result?.terminalIntent) terminalCommitted = true;
        return result;
      };
      const announced = vi.fn(); clients[1].on('global:game-ended', announced);
      try { await finished(room, room.getPlayerColor(users[0].id)); }
      finally { serverPrisma.$transaction = original; }
      expect(room.resultData).toMatchObject({ persistStatus: 'failed', replayId: null });
      expect((await sync(clients[0])).game.persistStatus).toBe('failed');
      await settle(50);
      expect(announced).not.toHaveBeenCalled();
      expect(await prisma.game.count()).toBe(0);
      expect(await prisma.gameSettlementJob.findUnique({ where: { key: room.settlementKey } })).not.toBeNull();
      const recovered = waitFor(clients[0], 'sync:state', state => state.game?.persistStatus === 'saved');
      const worker = createSettlementRecovery({ onSettled: publishRecoveredSettlement });
      expect(await worker.runOnce()).toBe(1);
      const snapshot = await recovered;
      expect(snapshot.game.resultData.replayId).toBe(room.replayId);
      expect(room.terminalIntent).not.toBeNull();
      await settle(20);
      expect(announced).toHaveBeenCalledTimes(1);
      expect(await worker.runOnce()).toBe(0);
      expect(await prisma.game.count()).toBe(1);
      await worker.stop();
    });
  });

  describe('bot wins', () => {
    it('pays COINS_BOT_WIN to a human winner, guests included, up to the daily cap', async () => {
      await prisma.user.update({ where: { id: users[0].id }, data: { isGuest: true, guestExpiresAt: new Date(Date.now() + 1000), coins: 0 } });
      clients[0].disconnect(); await settle();
      const guest = await connect({ ...users[0], isGuest: true });
      for (let game = 1; game <= BOT_WIN_DAILY_CAP + 1; game++) {
        const room = await botGame(guest);
        const me = room.getPlayerColor(users[0].id);
        await finished(room, me);
        const breakdown = room.resultData.coinBreakdown[me];
        if (game <= BOT_WIN_DAILY_CAP) {
          expect(room.resultData.coinRewards[me]).toBe(COINS_BOT_WIN);
          expect(breakdown).toEqual([{ label: 'Bot win', amount: COINS_BOT_WIN }]);
        } else {
          expect(room.resultData.coinRewards[me]).toBe(0);
          expect(breakdown).toEqual([{ label: 'Daily bot-win limit reached', amount: 0 }]);
        }
        expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(COINS_BOT_WIN * Math.min(game, BOT_WIN_DAILY_CAP));
      }
      expect(await prisma.coinTransaction.count({ where: { receiverId: users[0].id, reason: 'BOT_WIN' } })).toBe(BOT_WIN_DAILY_CAP);
      // Every persisted game slides the guest's expiry by the full lifetime.
      const refreshed = await prisma.user.findUnique({ where: { id: users[0].id } });
      expect(refreshed.guestExpiresAt.getTime()).toBeGreaterThan(Date.now() + GUEST_LIFETIME_MS - 60000);
    });
    it('pays nothing to the bot or for a loss, and the roster names the bot', async () => {
      const room = await botGame();
      const me = room.getPlayerColor(users[0].id);
      await finished(room, me === 'red' ? 'black' : 'red');
      expect(room.resultData.coinRewards).toEqual({ red: 0, black: 0 });
      expect(room.resultData.coinBreakdown).toEqual({ red: [], black: [] });
      expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(100);
      const roster = await request(app).get('/api/bots');
      expect(roster.status).toBe(200);
      expect(roster.body.bots.map(b => b.displayName)).toEqual(['Pip', 'Marge', 'The Colonel']);
      expect(roster.body.bots.find(b => b.key === 'easy')).toMatchObject({ difficulty: 'easy', tagline: 'learning the ropes', rating: 600, wins: 1, losses: 0, gamesPlayed: 1 });
      expect(roster.body.bots.find(b => b.key === 'hard')).toMatchObject({ rating: 1400, wins: 0, losses: 0, gamesPlayed: 0 });
    });
  });
});


describe('durable game creation', () => {
  it('reuses a committed reservation after the start response is lost', async () => {
    const created = await command(clients[0], 'room:create', { buyIn: 20 });
    const waiting = gameRooms.get(created.snapshot.room.id);
    await command(clients[1], 'room:join', { roomId: waiting.id });
    await command(clients[0], 'room:ready', { roomId: waiting.id, ready: true });
    const original = serverPrisma.$transaction;
    let drop = true;
    serverPrisma.$transaction = async function (...args) {
      const result = await original.apply(this, args);
      if (drop && result?.initialState && result?.buyIn === 20) {
        drop = false; throw Error('creation committed but response lost');
      }
      return result;
    };
    try {
      const started = await command(clients[1], 'room:ready', { roomId: waiting.id, ready: true });
      expect(started.ok).toBe(true); expect(started.snapshot.phase).toBe('in-game');
      expect(drop).toBe(false);
    } finally { serverPrisma.$transaction = original; }
    const key = waiting.startAttempt.key;
    const reserved = await prisma.gameRun.findUnique({ where: { key } });
    expect(reserved.status).toBe('OPEN');
    expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
    expect((await sync(clients[1])).game.gameId).toBe(reserved.id);
    expect(await prisma.gameRun.count()).toBe(1);
    expect(await prisma.coinTransaction.count({ where: { reason: 'WAGER_STAKE' } })).toBe(2);
  });

  it('prevents competing starts from attaching the same human to two games', async () => {
    await connect(users[2]);
    const result = await Promise.allSettled([
      createGameDirect(users[0].id, users[1].id, 'RANKED', 20),
      createGameDirect(users[0].id, users[2].id, 'RANKED', 20)
    ]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(activeGames.size).toBe(1);
    expect(await prisma.gameRun.count()).toBe(1);
    expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
  });

  it('refunds a committed start when its participant context changes before installation', async () => {
    const original = serverPrisma.$transaction;
    let release, entered;
    const committed = new Promise(resolve => { entered = resolve; });
    serverPrisma.$transaction = async function (...args) {
      const result = await original.apply(this, args);
      if (result?.initialState && result.status === 'OPEN') {
        entered(); await new Promise(resolve => { release = resolve; });
      }
      return result;
    };
    try {
      const starting = createGameDirect(users[0].id, users[1].id, 'RANKED', 20);
      await committed;
      setPhase(users[0].id, 'matchmaking');
      release();
      await expect(starting).rejects.toThrow('context changed');
    } finally { serverPrisma.$transaction = original; }
    expect(activeGames.size).toBe(0);
    expect((await prisma.gameRun.findFirst()).status).toBe('ABORTED');
    expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(100);
    expect((await prisma.user.findUnique({ where: { id: users[1].id } })).coins).toBe(100);
    expect(getSession(users[0].id).phase).toBe('matchmaking');
  });
});


describe('committed gameplay transitions', () => {
  it('keeps speculative moves out of sync snapshots until the transaction commits', async () => {
    const room = await newGame(0);
    const original = serverPrisma.$transaction;
    let pause = true, entered, release;
    const pending = new Promise(resolve => { entered = resolve; });
    serverPrisma.$transaction = function (work, ...options) {
      return original.call(this, async tx => {
        const result = await work(tx);
        if (pause && result?.checkpoint?.engine.moveHistory.length === 1) {
          pause = false; entered(); await new Promise(resolve => { release = resolve; });
        }
        return result;
      }, ...options);
    };
    try {
      const moving = move(clients[0], room);
      await pending;
      expect((await sync(clients[1])).game.moveHistory).toHaveLength(0);
      expect((await prisma.gameRun.findUnique({ where: { id: room.id } })).checkpoint.engine.moveHistory).toHaveLength(0);
      release();
      const ack = await moving;
      expect(ack.ok).toBe(true);
      const saved = await prisma.gameRun.findUnique({ where: { id: room.id } });
      expect(ack.snapshot.game.moveHistory).toEqual(saved.checkpoint.engine.moveHistory);
      expect(ack.snapshot.game.board).toEqual(saved.checkpoint.engine.board);
    } finally { release?.(); serverPrisma.$transaction = original; }
  });

  it('rolls back a failed move without publishing it, then accepts a new attempt', async () => {
    const room = await newGame(0);
    const original = serverPrisma.$transaction;
    serverPrisma.$transaction = function (work, ...options) {
      return original.call(this, async tx => {
        const result = await work(tx);
        if (result?.checkpoint?.engine.moveHistory.length === 1) throw Error('move commit failed');
        return result;
      }, ...options);
    };
    try {
      const result = await move(clients[0], room);
      expect(result.ok).toBe(false);
      expect(result.snapshot.game.moveHistory).toHaveLength(0);
      expect((await prisma.gameRun.findUnique({ where: { id: room.id } })).checkpoint.engine.moveHistory).toHaveLength(0);
    } finally { serverPrisma.$transaction = original; }
    expect((await move(clients[0], room)).ok).toBe(true);
    expect(room.game.moveHistory).toHaveLength(1);
  });

  it('confirms a move after a lost commit response and uses its durable receipt after cache loss', async () => {
    const room = await newGame(0);
    const original = serverPrisma.$transaction;
    let lose = true;
    serverPrisma.$transaction = async function (...args) {
      const result = await original.apply(this, args);
      if (lose && result?.checkpoint?.engine.moveHistory.length === 1) {
        lose = false; throw Error('response lost after move commit');
      }
      return result;
    };
    const request = envelope(clients[0], 'game:move', { gameId: room.id, fromRow: 5, fromCol: 0, toRow: 4, toCol: 1, expectedPly: 0 });
    try { expect((await deliver(clients[0], request)).ok).toBe(true); }
    finally { serverPrisma.$transaction = original; }
    getSession(users[0].id).receipts.clear();
    expect((await deliver(clients[0], request)).ok).toBe(true);
    expect(room.game.moveHistory).toHaveLength(1);
    expect(await prisma.gameCommandReceipt.count({ where: { gameRunId: room.id, key: request.id } })).toBe(1);
  });

  it('does not reset elapsed time when a player sends an invalid move', async () => {
    const room = await newGame(30);
    room.stopTimer(); room.lastClockAt = performance.now() - 5000;
    expect((await move(clients[0], room, 99)).ok).toBe(false);
    await room.advanceClock();
    expect(room.game.redTime).toBeLessThanOrEqual(25);
    expect(room.game.redTime).toBeGreaterThan(23);
  });

  it('does not publish a terminal result if its transition and job cannot commit', async () => {
    const room = await newGame(0);
    const original = serverPrisma.$transaction;
    serverPrisma.$transaction = async () => { throw Error('database unavailable'); };
    try {
      const result = await command(clients[0], 'game:resign', { gameId: room.id });
      expect(result.ok).toBe(false); expect(result.snapshot.game.gameOver).toBe(false);
    } finally { serverPrisma.$transaction = original; }
    expect(await prisma.gameSettlementJob.findUnique({ where: { key: room.settlementKey } })).toBeNull();
    expect((await command(clients[0], 'game:resign', { gameId: room.id })).ok).toBe(true);
    expect(room.game.winner).toBe('black');
    expect((await prisma.gameRun.findUnique({ where: { id: room.id } })).checkpoint.engine.gameOver).toBe(true);
  });

  it('retries the first bot move when its database commit fails', async () => {
    const bot = await prisma.user.create({ data: { username: 'CheckpointBot', friendCode: randomUUID(), isBot: true, botKey: 'easy' } });
    const room = await createGameDirect(bot.id, users[0].id, 'FRIENDLY', 0, 0);
    await sync(clients[0]);
    const original = serverPrisma.$transaction;
    let fail = true;
    serverPrisma.$transaction = function (work, ...options) {
      return original.call(this, async tx => {
        const result = await work(tx);
        if (fail && result?.checkpoint?.engine.moveHistory.length === 1) { fail = false; throw Error('bot commit unavailable'); }
        return result;
      }, ...options);
    };
    try {
      const moved = waitFor(clients[0], 'sync:state', state => state.game?.moveHistory.length === 1);
      await finishReveal(room, clients[0]);
      await moved;
      expect(fail).toBe(false);
      expect((await prisma.gameRun.findUnique({ where: { id: room.id } })).checkpoint.engine.moveHistory).toHaveLength(1);
    } finally { serverPrisma.$transaction = original; }
  });

  it('cancels a queued disconnect forfeiture when the player reconnects before transition evaluation', async () => {
    const room = await newGame(0);
    clients[0].disconnect();
    await vi.waitFor(() => expect(getSession(users[0].id).connectionId).toBeNull());
    const original = serverPrisma.$transaction;
    let release, entered;
    const enteredTransaction = new Promise(resolve => { entered = resolve; });
    let pause = true;
    serverPrisma.$transaction = function (work, ...options) {
      return original.call(this, async tx => {
        if (pause) { pause = false; entered(); await new Promise(resolve => { release = resolve; }); }
        return work(tx);
      }, ...options);
    };
    try {
      const expiration = expireDisconnectedGame(users[0].id, room.id);
      await enteredTransaction;
      await connect(users[0], false);
      release(); await expiration;
      expect(room.game.gameOver).toBe(false);
      expect(room.ending).toBeNull();
    } finally { release?.(); serverPrisma.$transaction = original; }
  });
});


it('stops a fenced runtime instead of adopting and mutating the replacement writer checkpoint', async () => {
  const room = await newGame(0);
  const previous = await prisma.gameRun.findUnique({ where: { id: room.id } });
  const replacement = await claimGameplayOwnership();
  const newer = decodeCheckpoint(previous.checkpoint);
  const firstMove = newer.game.getAllValidMoves()[0];
  newer.game.makeMove(firstMove.fromRow, firstMove.fromCol, firstMove.toRow, firstMove.toCol);
  await commitGameTransition({ key: room.settlementKey, expectedRevision: previous.revision }, () => encodeCheckpoint(newer), null, replacement);
  let stopped;
  const unsubscribe = onGameplayOwnershipLost(() => { stopped = stopGameRuntime(); });
  try {
    const result = await move(clients[0], room);
    expect(result.ok).toBe(false);
    await stopped;
    expect(room.runtimeStopped).toBe(true);
    expect(room.timerInterval).toBeNull();
    expect(room.game.moveHistory).toHaveLength(0);
    expect(room.stateRevision).toBe(previous.revision);
    expect((await prisma.gameRun.findUnique({ where: { id: room.id } })).revision).toBe(previous.revision + 1);
  } finally { unsubscribe(); await startGameplayOwnership(); }
});

it('retries a bot start after losing its committed creation response without leaving an occupied orphan seat', async () => {
  const original = serverPrisma.$transaction;
  let lost = false;
  serverPrisma.$transaction = async function (...args) {
    const result = await original.apply(this, args);
    if (!lost && result?.initialState && result.status === 'OPEN') {
      lost = true; throw Error('Creation response lost after commit');
    }
    return result;
  };
  try {
    const started = await command(clients[0], 'bot:play', { difficulty: 'easy' });
    expect(lost).toBe(true); expect(started.ok).toBe(true); expect(started.snapshot.phase).toBe('in-game');
    const previous = await prisma.gameRun.findFirst({ where: { OR: [{ redPlayerId: users[0].id }, { blackPlayerId: users[0].id }] } });
    expect(previous.status).toBe('OPEN');
    const gameId = started.snapshot.game.gameId;
    expect(gameId).toBe(previous.id);
    expect(await prisma.gameRun.count()).toBe(1);
    expect(await prisma.activeGamePlayer.findUnique({ where: { userId: users[0].id } })).toMatchObject({ gameRunId: gameId });
    expect(await prisma.activeGamePlayer.count({ where: { gameRunId: gameId } })).toBe(1);
    expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(100);
  } finally { serverPrisma.$transaction = original; }
});

describe('room departure and start reservations', () => {
  it('permits leaving a failed start that never committed a reservation', async () => {
    const created = await command(clients[0], 'room:create', { buyIn: 20 });
    const room = gameRooms.get(created.snapshot.room.id);
    await command(clients[1], 'room:join', { roomId: room.id });
    await command(clients[0], 'room:ready', { roomId: room.id, ready: true });
    await prisma.user.update({ where: { id: users[1].id }, data: { coins: 0 } });
    expect((await command(clients[1], 'room:ready', { roomId: room.id, ready: true })).ok).toBe(false);
    expect(room.startAttempt).toBeNull();
    expect(await prisma.gameRun.count()).toBe(0);
    const result = await command(clients[0], 'room:leave', { roomId: room.id });
    expect(result.ok).toBe(true); expect(result.snapshot.phase).toBe('idle');
    expect(await prisma.coinTransaction.count({ where: { reason: 'WAGER_REFUND' } })).toBe(0);
    expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(100);
  });
  it('keeps membership visible and blocks a new start until refund and departure commit', async () => {
    const room = await reservedWaitingRoom(), key = room.startAttempt.key;
    const original = serverPrisma.$transaction;
    let entered, release;
    const inside = new Promise(resolve => { entered = resolve; });
    serverPrisma.$transaction = function (work, ...options) {
      return original.call(this, async tx => {
        const result = await work(tx);
        if (result?.status === 'ABORTED') { entered(); await new Promise(resolve => { release = resolve; }); }
        return result;
      }, ...options);
    };
    try {
      const leaving = command(clients[0], 'room:leave', { roomId: room.id });
      await inside;
      const snapshot = await sync(clients[1]);
      expect(snapshot.room.status).toBe('updating'); expect(snapshot.room.players).toHaveLength(2);
      expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
      expect((await command(clients[1], 'room:ready', { roomId: room.id, ready: true })).ok).toBe(false);
      release(); const result = await leaving;
      expect(result.ok).toBe(true); expect(result.snapshot.phase).toBe('idle');
      expect((await prisma.gameRun.findUnique({ where: { key } })).status).toBe('ABORTED');
      expect(await prisma.activeGamePlayer.count()).toBe(0);
      for (const player of users.slice(0, 2)) expect((await prisma.user.findUnique({ where: { id: player.id } })).coins).toBe(100);
      expect(room.players.map(player => player.userId)).toEqual([users[1].id]);
      expect(room.hostId).toBe(users[1].id); expect(room.startAttempt).toBeNull();
    } finally { release?.(); serverPrisma.$transaction = original; }
  });

  it('retains the room and reservation when cancellation is unavailable, then permits an explicit retry', async () => {
    const room = await reservedWaitingRoom(), key = room.startAttempt.key;
    const original = serverPrisma.$transaction;
    serverPrisma.$transaction = async () => { throw Error('Database unavailable'); };
    try {
      const result = await command(clients[0], 'room:leave', { roomId: room.id });
      expect(result.ok).toBe(false); expect(result.snapshot.phase).toBe('in-room');
      expect(room.status).toBe('playing'); expect(room.players).toHaveLength(2);
      expect(room.startAttempt.key).toBe(key);
    } finally { serverPrisma.$transaction = original; }
    expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
    expect((await command(clients[0], 'room:leave', { roomId: room.id })).ok).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(100);
  });

  it('confirms a cancellation response lost after commit without refunding twice', async () => {
    const room = await reservedWaitingRoom();
    const original = serverPrisma.$transaction;
    let lost = false;
    serverPrisma.$transaction = async function (...args) {
      const result = await original.apply(this, args);
      if (!lost && result?.status === 'ABORTED') { lost = true; throw Error('Cancellation response lost'); }
      return result;
    };
    try {
      const result = await command(clients[0], 'room:leave', { roomId: room.id });
      expect(lost).toBe(true); expect(result.ok).toBe(true); expect(result.snapshot.phase).toBe('idle');
      for (const player of users.slice(0, 2)) expect(await prisma.coinTransaction.count({ where: { receiverId: player.id, reason: 'WAGER_REFUND' } })).toBe(1);
    } finally { serverPrisma.$transaction = original; }
  });

  it('refunds both players before publishing a kick, while preserving the remaining host room', async () => {
    const room = await reservedWaitingRoom();
    const kicked = await command(clients[0], 'room:kick', { roomId: room.id, userId: users[1].id });
    expect(kicked.ok).toBe(true);
    expect((await sync(clients[1]))).toMatchObject({ phase: 'idle', notice: { reason: 'room-kicked' } });
    expect(room.players.map(player => player.userId)).toEqual([users[0].id]);
    expect(room.startAttempt).toBeNull(); expect(room.status).toBe('waiting');
    expect(await prisma.activeGamePlayer.count()).toBe(0);
    for (const player of users.slice(0, 2)) expect((await prisma.user.findUnique({ where: { id: player.id } })).coins).toBe(100);
  });

  it('does not cancel player reservations when a spectator leaves', async () => {
    const room = await reservedWaitingRoom(), key = room.startAttempt.key;
    const spectator = await connect(users[2]);
    expect((await command(spectator, 'room:spectate', { roomId: room.id })).ok).toBe(true);
    expect((await command(spectator, 'room:leave', { roomId: room.id })).ok).toBe(true);
    expect(room.startAttempt.key).toBe(key); expect((await prisma.gameRun.findUnique({ where: { key } })).status).toBe('OPEN');
    expect(await prisma.activeGamePlayer.count()).toBe(2);
  });

  it('does not expire a player who reconnects while cancellation is waiting for storage', async () => {
    const room = await reservedWaitingRoom(), key = room.startAttempt.key;
    clients[0].disconnect(); await vi.waitFor(() => expect(getSession(users[0].id).connectionId).toBeNull());
    await elapsedRoomDeadline(room, users[0].id);
    const original = serverPrisma.$transaction;
    let entered, release;
    const inside = new Promise(resolve => { entered = resolve; });
    let pause = true;
    serverPrisma.$transaction = function (work, ...options) {
      return original.call(this, async tx => {
        if (pause) { pause = false; entered(); await new Promise(resolve => { release = resolve; }); }
        return work(tx);
      }, ...options);
    };
    try {
      const expiry = expireRoomMember(room, users[0].id);
      await inside; const replacement = await connect(users[0], false);
      release(); await expiry;
      expect((await sync(replacement)).phase).toBe('in-room');
      expect(getSession(users[0].id).notice).toBeNull(); expect(room.players).toHaveLength(2);
      expect((await prisma.gameRun.findUnique({ where: { key } })).status).toBe('OPEN');
      expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
    } finally { release?.(); serverPrisma.$transaction = original; }
  });

  it('retries a disconnected-room expiry after storage recovers', async () => {
    const room = await reservedWaitingRoom();
    clients[0].disconnect(); await vi.waitFor(() => expect(getSession(users[0].id).connectionId).toBeNull());
    await elapsedRoomDeadline(room, users[0].id);
    const original = serverPrisma.$transaction;
    serverPrisma.$transaction = async () => { throw Error('Expiry database unavailable'); };
    try {
      await expireRoomMember(room, users[0].id);
      expect(getSession(users[0].id).phase).toBe('in-room');
      expect(room.players.find(p => p.userId === users[0].id).disconnectDeadline).toBeLessThan(Date.now());
    } finally { serverPrisma.$transaction = original; }
    await vi.waitFor(() => expect(getSession(users[0].id).phase).toBe('idle'), { timeout: 4000 });
    expect(getSession(users[0].id).notice.reason).toBe('room-expired');
    expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(100);
    expect(await prisma.activeGamePlayer.count()).toBe(0);
  });

  it('keeps a reconnected player in the room when the refund commits before expiry can publish departure', async () => {
    const room = await reservedWaitingRoom();
    clients[0].disconnect(); await vi.waitFor(() => expect(getSession(users[0].id).connectionId).toBeNull());
    await elapsedRoomDeadline(room, users[0].id);
    const original = serverPrisma.$transaction;
    let entered, release;
    const inside = new Promise(resolve => { entered = resolve; });
    serverPrisma.$transaction = function (work, ...options) {
      return original.call(this, async tx => {
        const result = await work(tx);
        if (result?.status === 'ABORTED') { entered(); await new Promise(resolve => { release = resolve; }); }
        return result;
      }, ...options);
    };
    try {
      const expiry = expireRoomMember(room, users[0].id);
      await inside; const replacement = await connect(users[0], false);
      release(); await expiry;
      expect((await sync(replacement)).phase).toBe('in-room');
      expect(room.startAttempt).toBeNull(); expect(room.status).toBe('waiting');
      expect(getSession(users[0].id).notice).toBeNull();
      expect(await prisma.activeGamePlayer.count()).toBe(0);
      for (const player of users.slice(0, 2)) expect((await prisma.user.findUnique({ where: { id: player.id } })).coins).toBe(100);
    } finally { release?.(); serverPrisma.$transaction = original; }
  });
});
