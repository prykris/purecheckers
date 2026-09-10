import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { setupSocket } from '../server/socket/index.js';
import { connectedUsers } from '../server/socket/connections.js';
import { activeGames, createGameDirect, stopMatchmaking } from '../server/domain/games.js';
import { gameRooms, leaveRoom } from '../server/domain/rooms.js';
import { getSession, getAllSessions, removeSession } from '../server/domain/sessions.js';
import { quickPlayPool } from '../server/services/quickPlay.js';
import { PROTOCOL_VERSION } from '../shared/protocol.js';

const prisma = new PrismaClient();
let httpServer, io, url, users, clients;
const waitFor = (socket, event, predicate = () => true) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, listener); reject(new Error('Timeout: ' + event)); }, 5000);
  function listener(data) { if (!predicate(data)) return; clearTimeout(timer); socket.off(event, listener); resolve(data); }
  socket.on(event, listener);
});
async function connect(user) {
  const socket = ioClient(url, { autoConnect: false, reconnection: false, transports: ['websocket'], forceNew: true,
    auth: { token: jwt.sign({ userId: user.id, username: user.username, isGuest: user.isGuest }, process.env.JWT_SECRET) } });
  clients.push(socket);
  socket.on('sync:state', snapshot => socket.snapshot = snapshot);
  const synced = waitFor(socket, 'sync:state'); socket.connect(); await synced;
  return socket;
}
async function sync(socket) { return socket.timeout(5000).emitWithAck('sync:request', {}); }
function envelope(socket, type, data = {}) {
  return { protocolVersion: PROTOCOL_VERSION, id: randomUUID(), serverId: socket.snapshot.serverId,
    context: socket.snapshot.context, createdAt: Date.now(), type, data };
}
async function deliver(socket, request) { return socket.timeout(5000).emitWithAck('session:command', request); }
async function command(socket, type, data = {}) { return deliver(socket, envelope(socket, type, data)); }
async function newGame(turnTime = 60) {
  const room = await createGameDirect(users[0].id, users[1].id, 'FRIENDLY', 0, turnTime);
  await Promise.all(clients.slice(0, 2).map(sync)); return room;
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
beforeAll(async () => {
  httpServer = createServer(); io = new Server(httpServer); setupSocket(io);
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  url = 'http://127.0.0.1:' + httpServer.address().port;
});
beforeEach(async () => {
  clients = [];
  await prisma.game.deleteMany(); await prisma.coinTransaction.deleteMany();
  await prisma.inventory.deleteMany(); await prisma.friendship.deleteMany();
  await prisma.pendingPayout.deleteMany(); await prisma.user.deleteMany();
  users = await Promise.all(['Alice', 'Bob', 'Carol'].map(username => prisma.user.create({ data: { username, friendCode: username, coins: 100 } })));
  await connect(users[0]); await connect(users[1]);
});
afterEach(async () => {
  for (const room of activeGames.values()) {
    room.stopTimer(); room.game.gameOver = true;
    if (room.finalization) await room.finalization;
    clearTimeout(room.cleanupTimer);
  }
  clients.forEach(c => c.disconnect());
  await new Promise(resolve => setTimeout(resolve, 20));
  for (const id of getAllSessions().keys()) { quickPlayPool.remove(id); removeSession(id); }
  connectedUsers.clear(); activeGames.clear(); gameRooms.clear();
});
afterAll(async () => { stopMatchmaking(); await new Promise(resolve => io.close(resolve)); await prisma.$disconnect(); });


describe('single authoritative command protocol', () => {
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
    const unlimited = await newGame(0); unlimited.lastClockAt = performance.now()-10000000; unlimited.advanceClock();
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
    if (game.getPlayerColor(users[0].id) === 'red') await move(clients[0], game);
    if (game.game.moveHistory.length < (game.getPlayerColor(users[0].id) === 'red' ? 2 : 1)) await waitFor(clients[0], 'sync:state', s => s.game?.currentPlayer === game.getPlayerColor(users[0].id));
    expect(game.game.currentPlayer).toBe(game.getPlayerColor(users[0].id)); expect(game.game.moveHistory.length).toBeGreaterThan(0);
  });
  it('deletes abandoned bot rooms through the same room cleanup rule', async () => {
    const room = await waitingRoom(); await command(clients[0], 'bot:join', { roomId: room.id, difficulty: 'easy' });
    leaveRoom(room, users[0].id);
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
});
