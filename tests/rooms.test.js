import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import app from '../server/app.js';
import { inviteRateLimit } from '../server/routes/rooms.js';
import { createRoomActions, gameRooms, sanitizeRoom, findRoomByCode, JOIN_CODE_PATTERN, stopRoomRuntime, roomListing } from '../server/domain/rooms.js';
import { canStartRoom, resetReadiness } from '../server/domain/roomRules.js';
import { getOrCreateSession, getSession, removeSession } from '../server/domain/sessions.js';
import { CommandRejected } from '../server/domain/sessionCommands.js';
import { SITE_URL } from '../server/config.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';

// Rooms live in memory in the same process as the API, so a room created through the
// domain actions is immediately visible to the invite pre-check.
const prisma = new PrismaClient();
let host, guest;

function actorFor(user) {
  const session = getOrCreateSession(user.id, user.username, !!user.isGuest);
  session.connectionId = 'conn-' + user.id;
  return { userId: user.id, username: user.username, isGuest: !!user.isGuest, connectionId: session.connectionId };
}

beforeAll(async () => {
  await startGameplayOwnership();
  await prisma.game.deleteMany(); await prisma.coinTransaction.deleteMany(); await prisma.user.deleteMany();
  host = await prisma.user.create({ data: { username: 'Chris', friendCode: 'CHRIS001', coins: 100 } });
  guest = await prisma.user.create({ data: { username: 'Bold Owl 7', friendCode: 'OWL00001', isGuest: true, guestExpiresAt: new Date(Date.now() + 86400000) } });
});
afterAll(async () => { await prisma.user.deleteMany(); await prisma.$disconnect(); });
beforeEach(() => startGameplayOwnership());
afterEach(async () => { await stopRoomRuntime(); gameRooms.clear(); removeSession(host.id); removeSession(guest.id); inviteRateLimit.reset(); await prisma.roomRecord.deleteMany(); });

describe('autoReady rooms', () => {
  it.each([true, false])('records invitation entry only for an accepted code join: %s', async byCode => {
    await createRoomActions(actorFor(host))['room:create']({});
    const room = [...gameRooms.values()][0];
    await createRoomActions(actorFor(guest))['room:join'](byCode ? { code: room.joinCode } : { roomId: room.id, joinedViaInvite: true });
    const record = await prisma.roomRecord.findUnique({ where: { id: BigInt(room.id) } });
    expect(record.state.players.find(p => p.userId === guest.id).joinedViaInvite).toBe(byCode);
    expect(record.state.players.find(p => p.userId === host.id).joinedViaInvite).not.toBe(true);
  });
  it('allows invitation-code spectating without recording player entry', async () => {
    await createRoomActions(actorFor(host))['room:create']({ isPrivate: true });
    const room = [...gameRooms.values()][0];
    const actions = createRoomActions(actorFor(guest));
    await expect(actions['room:join']({ code: 'AAAAAA' })).rejects.toThrow('Room not found');
    await actions['room:spectate']({ code: room.joinCode });
    const record = await prisma.roomRecord.findUnique({ where: { id: BigInt(room.id) } });
    expect(record.state.players).toHaveLength(1);
    expect(record.state.spectators).toHaveLength(1);
    expect(record.state.spectators[0]).not.toHaveProperty('joinedViaInvite');
    expect(getSession(guest.id).phase).toBe('spectating');
  });
  it('stores the flag, exposes it with hostId and the two links, and points the image at the app route', async () => {
    await createRoomActions(actorFor(host))['room:create']({ autoReady: true, isPrivate: true });
    const room = [...gameRooms.values()][0];
    expect(room.settings).toEqual({ buyIn: 0, turnTimer: 60, isPrivate: true, allowSpectators: true, autoReady: true });
    expect(room.origin).toBe('room');
    const view = sanitizeRoom(room);
    expect(view).toMatchObject({ hostId: host.id, hostName: 'Chris', autoReady: true, status: 'waiting', settings: { autoReady: true } });
    expect(view.joinUrl).toBe(`${SITE_URL}/join/${room.joinCode}`);
    expect(view.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const { default: QRCode } = await import('qrcode');
    expect(view.qrDataUrl).toBe(await QRCode.toDataURL(`${SITE_URL}/invite/${room.joinCode}`, { width: 768, margin: 2 }));
    expect(JOIN_CODE_PATTERN.test(room.joinCode)).toBe(true);
    expect(getSession(host.id)).toMatchObject({ phase: 'in-room', roomId: room.id });
  });
  it('defaults to false and rejects the flag together with a buy-in', async () => {
    const actions = createRoomActions(actorFor(host));
    await expect(actions['room:create']({ autoReady: true, buyIn: 5 })).rejects.toThrow(/buy-in/i);
    await expect(actions['room:create']({ autoReady: 1 })).rejects.toBeInstanceOf(CommandRejected);
    expect(gameRooms.size).toBe(0);
    await actions['room:create']({});
    expect(sanitizeRoom([...gameRooms.values()][0]).autoReady).toBe(false);
  });
  it('treats connected humans as ready only when the flag is set', () => {
    const players = [{ userId: 1, ready: false, online: true }, { userId: 2, ready: false, online: true }];
    const plain = { status: 'waiting', settings: { autoReady: false }, players };
    const auto = { status: 'waiting', settings: { autoReady: true }, players };
    expect(canStartRoom(plain)).toBe(false);
    expect(canStartRoom(auto)).toBe(true);
    resetReadiness(auto); // the flags that disconnect and resetReadiness clear do not matter
    expect(canStartRoom(auto)).toBe(true);
    auto.players[0].online = false;
    expect(canStartRoom(auto)).toBe(false); // an offline host still blocks the start
    auto.players[0].online = true; auto.status = 'playing';
    expect(canStartRoom(auto)).toBe(false);
  });

  it('projects effective readiness and start availability from the same server rule', async () => {
    await createRoomActions(actorFor(host))['room:create']({ autoReady: true });
    const room = [...gameRooms.values()][0];
    room.players.push({ userId: guest.id, ready: false, online: true, isGuest: true });
    let view = sanitizeRoom(room);
    expect(view.players.map(p => p.ready)).toEqual([true, true]);
    expect(view.readyToStart).toBe(true);
    room.players[0].online = false;
    view = sanitizeRoom(room);
    expect(view.players[0].ready).toBe(false); expect(view.readyToStart).toBe(false);
    room.players[0].online = true; room.pending = true;
    expect(sanitizeRoom(room).readyToStart).toBe(false);
    room.pending = false; room.status = 'starting';
    expect(sanitizeRoom(room).readyToStart).toBe(false);
  });

  it('offers a bot only for an available free room and enforces the same rule on the command', async () => {
    const actions = createRoomActions(actorFor(host));
    await actions['room:create']({ buyIn: 20 });
    const room = [...gameRooms.values()][0];
    expect(sanitizeRoom(room).canAddBot).toBe(false);
    await expect(actions['bot:join']({ roomId: room.id })).rejects.toThrow('A bot requires a free room');
    // Projection cases use the same eligibility predicate as admission.
    room.settings.buyIn = 0;
    expect(sanitizeRoom(room).canAddBot).toBe(true);
    room.pending = true; expect(sanitizeRoom(room).canAddBot).toBe(false);
    room.pending = false; room.players.push({ userId: guest.id, online: true, ready: false });
    expect(sanitizeRoom(room).canAddBot).toBe(false);
  });
});

describe('GET /api/rooms/invite/:code', () => {
  it('describes a live room without player ids and accepts lower-case codes', async () => {
    await createRoomActions(actorFor(host))['room:create']({ autoReady: true, isPrivate: true, turnTimer: 30 });
    const room = [...gameRooms.values()][0];
    const res = await request(app).get('/api/rooms/invite/' + room.joinCode.toLowerCase());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hostName: 'Chris', status: 'waiting', playerCount: 1, buyIn: 0, turnTimer: 30, autoReady: true });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(findRoomByCode(room.joinCode)).toBe(room);
  });
  it('reports a plain room and a started one by status', async () => {
    await createRoomActions(actorFor(host))['room:create']({ buyIn: 0, turnTimer: 90 });
    const room = [...gameRooms.values()][0];
    room.players.push({ userId: guest.id, username: guest.username, elo: 1000, isGuest: true, isBot: false, ready: true, online: true });
    room.status = 'playing';
    const res = await request(app).get('/api/rooms/invite/' + room.joinCode);
    expect(res.body).toEqual({ hostName: 'Chris', status: 'playing', playerCount: 2, buyIn: 0, turnTimer: 90, autoReady: false });
  });
  it('404s for an unknown code and 400s for a malformed one', async () => {
    const missing = await request(app).get('/api/rooms/invite/ABCDEF');
    expect(missing.status).toBe(404); expect(missing.body).toEqual({ error: 'Room not found' });
    for (const bad of ['ABC', 'ABCDEFG', 'ABC1DE', 'AB0CDE', 'ab-cde', 'ABCDE%20']) {
      const res = await request(app).get('/api/rooms/invite/' + bad);
      expect(res.status).toBe(400); expect(res.body).toEqual({ error: 'Invalid invite code' });
    }
  });
  it('rate limits a client after sixty requests in a minute', async () => {
    for (let i = 0; i < 60; i++) expect((await request(app).get('/api/rooms/invite/ABCDEF')).status).toBe(404);
    const limited = await request(app).get('/api/rooms/invite/ABCDEF');
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('60');
    inviteRateLimit.reset();
    expect((await request(app).get('/api/rooms/invite/ABCDEF')).status).toBe(404);
  });
});

describe('GET /api/bots', () => {
  it('lists the roster with presentation fields and zero records before any account exists', async () => {
    const res = await request(app).get('/api/bots');
    expect(res.status).toBe(200);
    expect(res.body.bots).toEqual([
      { key: 'easy', difficulty: 'easy', displayName: 'Pip', tagline: 'learning the ropes', avatar: '🐣', rating: 600, wins: 0, losses: 0, gamesPlayed: 0 },
      { key: 'medium', difficulty: 'medium', displayName: 'Marge', tagline: 'solid and patient', avatar: '🦉', rating: 1000, wins: 0, losses: 0, gamesPlayed: 0 },
      { key: 'hard', difficulty: 'hard', displayName: 'The Colonel', tagline: 'does not forgive blunders', avatar: '🎖️', rating: 1400, wins: 0, losses: 0, gamesPlayed: 0 },
    ]);
    expect(await prisma.user.count({ where: { isBot: true } })).toBe(0); // reading the roster provisions nothing
  });
  it('reads the record from the bot account once it exists', async () => {
    await prisma.user.create({ data: { username: 'Bot Medium', botKey: 'medium', isBot: true, friendCode: 'BOT-MED', elo: 1000, wins: 14, losses: 9, gamesPlayed: 23 } });
    const res = await request(app).get('/api/bots');
    expect(res.body.bots.find(b => b.key === 'medium')).toMatchObject({ displayName: 'Marge', wins: 14, losses: 9, gamesPlayed: 23 });
  });
});


describe('shared editable rooms', () => {
  function edit(actions, room, changes, expectedRevision = room.revision) {
    const data = { roomId: room.id, settings: { ...room.settings, ...changes, autoReady: false }, expectedRevision };
    return actions['room:settings'](data, { id: randomUUID(), type: 'room:settings', data });
  }
  it('lists private rooms without invitation credentials and preserves the invite when visibility changes', async () => {
    const actions = createRoomActions(actorFor(host));
    await actions['room:create']({ isPrivate: true });
    const room = [...gameRooms.values()][0], code = room.joinCode;
    const listing = actions['room:list']().rooms.find(value => value.id === room.id);
    expect(listing.settings.isPrivate).toBe(true);
    for (const field of ['joinCode', 'joinUrl', 'qrDataUrl', 'challenge']) expect(listing).not.toHaveProperty(field);
    await expect(createRoomActions(actorFor(guest))['room:join']({ roomId: room.id })).rejects.toThrow('Room not found');
    await edit(actions, room, { isPrivate: false, turnTimer: 90 });
    expect(room.joinCode).toBe(code);
    expect(roomListing(room).settings).toMatchObject({ isPrivate: false, turnTimer: 90 });
    await edit(actions, room, { isPrivate: true });
    expect(actions['room:list']().rooms.find(value => value.id === room.id).settings.isPrivate).toBe(true);
    await createRoomActions(actorFor(guest))['room:join']({ roomId: room.id, code });
    expect(room.players).toHaveLength(2);
    expect(room.players.find(p => p.userId === guest.id).joinedViaInvite).toBe(true);
  });
  it('requires the host, rejects stale edits/readiness, locks settings when ready and unlocks after unready', async () => {
    const actions = createRoomActions(actorFor(host)), other = createRoomActions(actorFor(guest));
    await actions['room:create']({});
    const room = [...gameRooms.values()][0];
    await other['room:join']({ roomId: room.id });
    await expect(edit(other, room, { turnTimer: 30 })).rejects.toThrow('Only the host');
    const oldSettings = { ...room.settings }, oldRevision = room.revision;
    await edit(actions, room, { turnTimer: 90 });
    await expect(edit(actions, room, { turnTimer: 30 }, oldRevision)).rejects.toThrow('Room changed');
    await expect(other['room:ready']({ roomId: room.id, ready: true, expectedSettings: oldSettings })).rejects.toThrow('settings changed');
    await expect(other['room:ready']({ roomId: room.id, ready: true })).rejects.toThrow('settings changed');
    expect(room.players.every(p => !p.ready)).toBe(true);
    await other['room:ready']({ roomId: room.id, ready: true, expectedSettings: { ...room.settings } });
    expect(sanitizeRoom(room).canEditSettings).toBe(false);
    await expect(edit(actions, room, { isPrivate: true })).rejects.toThrow('Only the host');
    await other['room:ready']({ roomId: room.id, ready: false });
    await edit(actions, room, { isPrivate: true });
    expect(sanitizeRoom(room).canEditSettings).toBe(true);
    const saved = await prisma.roomRecord.findUnique({ where: { id: BigInt(room.id) } });
    expect(saved.state.settings).toMatchObject({ turnTimer: 90, isPrivate: true });
  });
  it('validates wagers against every seated account and does not evict spectators to change settings', async () => {
    const actions = createRoomActions(actorFor(host)), other = createRoomActions(actorFor(guest));
    await actions['room:create']({});
    const room = [...gameRooms.values()][0];
    await expect(edit(actions, room, { buyIn: 101 })).rejects.toThrow('afford');
    await other['room:spectate']({ roomId: room.id });
    await expect(edit(actions, room, { allowSpectators: false })).rejects.toThrow('Remove spectators');
    await other['room:leave']({ roomId: room.id });
    await other['room:join']({ roomId: room.id });
    await expect(edit(actions, room, { buyIn: 10 })).rejects.toThrow('registered');
    expect(room.settings.buyIn).toBe(0);
  });
  it('converts an existing single-player auto-start room through the same settings transition', async () => {
    const actions = createRoomActions(actorFor(host));
    await actions['room:create']({ autoReady: true, isPrivate: true });
    const room = [...gameRooms.values()][0];
    await edit(actions, room, { turnTimer: 30 });
    expect(room.settings.autoReady).toBe(false);
    expect(sanitizeRoom(room).players[0].ready).toBe(false);
  });
});
