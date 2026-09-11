import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { executeFriendshipAction as act, readFriends } from '../server/services/friendships.js';
import { getUserStatus } from '../server/socket/presenceHandler.js';
import { getOrCreateSession, handleReconnect, handleDisconnect, setPhase, removeSession } from '../server/domain/sessions.js';

let users;
const command = payload => ({ requestId: randomUUID(), ...payload });
beforeEach(async () => {
  users = await Promise.all([0, 1, 2, 3].map(() => prisma.user.create({ data: { username: randomUUID(), friendCode: randomUUID().slice(0, 8).toUpperCase() } })));
});
afterEach(async () => {
  for (const user of users) removeSession(user.id);
  const ids = users.map(u => u.id);
  await prisma.friendship.deleteMany({ where: { OR: [{ requesterId: { in: ids } }, { receiverId: { in: ids } }] } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});
const send = (a = 0, b = 1) => act(users[a].id, 'request', command({ friendCode: users[b].friendCode }));

it('uses the same explicit request and acceptance flow for room player IDs, including guests', async () => {
  await prisma.user.update({ where: { id: users[1].id }, data: { isGuest: true, guestExpiresAt: new Date(Date.now() + 86400000) } });
  const body = command({ userId: users[1].id });
  const sent = await act(users[0].id, 'request', body);
  expect(sent.friendship).toMatchObject({ requesterId: users[0].id, receiverId: users[1].id, status: 'PENDING' });
  expect(await act(users[0].id, 'request', body)).toEqual(sent);
  await expect(act(users[0].id, 'request', { ...body, userId: users[2].id })).rejects.toMatchObject({ status: 409 });
  expect(() => act(users[0].id, 'request', command({ userId: users[2].id, friendCode: users[2].friendCode }))).toThrow('Choose one valid player');
  expect((await readFriends(users[1].id)).requests[0].id).toBe(sent.friendship.id);
  await act(users[1].id, 'accept', command({ friendshipId: sent.friendship.id }));
  expect((await readFriends(users[0].id)).friends[0].id).toBe(users[1].id);
  expect((await readFriends(users[1].id)).friends[0].id).toBe(users[0].id);
  await expect(act(users[0].id, 'request', command({ userId: users[0].id }))).rejects.toThrow('yourself');
  await prisma.user.update({ where: { id: users[2].id }, data: { isBot: true } });
  await expect(act(users[0].id, 'request', command({ userId: users[2].id }))).rejects.toThrow('human');
});

it('serializes simultaneous opposite-direction requests without implying acceptance', async () => {
  const outcomes = await Promise.allSettled([send(), send(1, 0)]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.find(result => result.status === 'rejected').reason.status).toBe(409);
  const rows = await prisma.friendship.findMany({ where: { OR: [{ requesterId: users[0].id }, { receiverId: users[0].id }] } });
  expect(rows).toHaveLength(1); expect(rows[0].status).toBe('PENDING');
  await expect(prisma.friendship.create({ data: { requesterId: rows[0].receiverId, receiverId: rows[0].requesterId } })).rejects.toMatchObject({ code: 'P2002' });
});

it('replays old request and acceptance receipts after removal without recreating the relationship', async () => {
  const body = command({ friendCode: users[1].friendCode.toLowerCase() });
  const sent = await act(users[0].id, 'request', body);
  const acceptance = command({ friendshipId: sent.friendship.id, displayName: 'Display only' });
  const accepted = await act(users[1].id, 'accept', acceptance);
  await act(users[0].id, 'remove', command({ friendshipId: sent.friendship.id }));
  expect(await act(users[0].id, 'request', { ...body, friendCode: ' ' + users[1].friendCode + ' ' })).toEqual(sent);
  expect(await act(users[1].id, 'accept', { ...acceptance, displayName: 'Renamed' })).toEqual(accepted);
  expect(await prisma.friendship.findUnique({ where: { id: sent.friendship.id } })).toBeNull();
  await expect(act(users[0].id, 'request', { ...body, friendCode: users[2].friendCode })).rejects.toMatchObject({ status: 409 });
});

it('keeps a new relationship intact when an old removal is confirmed again', async () => {
  const sent = await send(), removal = command({ friendshipId: sent.friendship.id });
  const removed = await act(users[0].id, 'remove', removal);
  const newer = await send(1, 0);
  expect(await act(users[0].id, 'remove', removal)).toEqual(removed);
  expect(await prisma.friendship.findUnique({ where: { id: newer.friendship.id } })).not.toBeNull();
});

it('allows only the recipient to accept and only either participant to remove', async () => {
  const sent = await send(), body = command({ friendshipId: sent.friendship.id });
  await expect(act(users[0].id, 'accept', body)).rejects.toMatchObject({ status: 403 });
  await expect(act(users[2].id, 'remove', body)).rejects.toMatchObject({ status: 403 });
  await act(users[1].id, 'remove', body); // recipient can decline
  expect(await prisma.friendship.findUnique({ where: { id: sent.friendship.id } })).toBeNull();
});

it('rejects bots, retired players and attempts to change a blocked relationship', async () => {
  await prisma.user.update({ where: { id: users[1].id }, data: { isBot: true } });
  await expect(send()).rejects.toMatchObject({ status: 400 });
  await prisma.user.update({ where: { id: users[1].id }, data: { isBot: false, guestRetiredAt: new Date() } });
  await expect(send()).rejects.toMatchObject({ status: 404 });
  await prisma.user.update({ where: { id: users[1].id }, data: { guestRetiredAt: null } });
  const sent = await send();
  await prisma.friendship.update({ where: { id: sent.friendship.id }, data: { status: 'BLOCKED' } });
  await expect(send(1, 0)).rejects.toMatchObject({ status: 403 });
  await expect(act(users[1].id, 'accept', command({ friendshipId: sent.friendship.id }))).rejects.toMatchObject({ status: 403 });
  await expect(act(users[0].id, 'remove', command({ friendshipId: sent.friendship.id }))).rejects.toMatchObject({ status: 403 });
});

it('rolls the effect and its receipt back together', async () => {
  const body = command({ friendCode: users[1].friendCode });
  await expect(prisma.$transaction(async tx => {
    await act(users[0].id, 'request', body, tx);
    throw Error('rollback');
  })).rejects.toThrow('rollback');
  expect(await prisma.friendshipOperation.count({ where: { userId: users[0].id } })).toBe(0);
  expect((await readFriends(users[0].id)).outgoing).toHaveLength(0);
  expect((await act(users[0].id, 'request', body)).friendship.status).toBe('PENDING');
});

it('reads one private snapshot with accepted, incoming and outgoing relationships and current session presence', async () => {
  const accepted = await send();
  await act(users[1].id, 'accept', command({ friendshipId: accepted.friendship.id }));
  await send(2, 0); await send(0, 3); await send(2, 3);
  getOrCreateSession(users[1].id, users[1].username, false);
  expect(getUserStatus(users[1].id)).toBe('offline');
  handleReconnect(users[1].id, 'first'); expect(getUserStatus(users[1].id)).toBe('online');
  expect(setPhase(users[1].id, 'in-game', { gameId: 'test-game', gameColor: 'red' })).toBe(true);
  expect(getUserStatus(users[1].id)).toBe('in-game');
  const data = await readFriends(users[0].id, getUserStatus);
  expect(data.friends).toMatchObject([{ id: users[1].id, status: 'in-game' }]);
  expect(data.requests.map(row => row.requester.id)).toEqual([users[2].id]);
  expect(data.outgoing.map(row => row.receiver.id)).toEqual([users[3].id]);
  handleDisconnect(users[1].id); expect(getUserStatus(users[1].id)).toBe('offline');
  handleReconnect(users[1].id, 'replacement'); expect(getUserStatus(users[1].id)).toBe('in-game');
  await prisma.user.update({ where: { id: users[2].id }, data: { guestRetiredAt: new Date() } });
  expect((await readFriends(users[0].id)).requests).toEqual([]);
});

it('requires authentication, never caches private reads, and rejects malformed deletion targets', async () => {
  await request(app).get('/api/friends').expect(401);
  const token = jwt.sign({ userId: users[0].id }, process.env.JWT_SECRET);
  const sent = await send();
  const response = await request(app).get('/api/friends').set('Authorization', 'Bearer ' + token).expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  for (const id of [sent.friendship.id + 'junk', '-1', '2147483648']) {
    await request(app).delete('/api/friends/' + id).set('Authorization', 'Bearer ' + token).send(command({})).expect(400);
  }
  expect(await prisma.friendship.findUnique({ where: { id: sent.friendship.id } })).not.toBeNull();
});

it('migrates legacy duplicates conservatively and enforces unordered uniqueness and distinct users', async () => {
  // Temporary relations shadow production-named tables on this isolated test
  // connection. The deliberate rollback removes the entire fixture and DDL.
  const sql = readFileSync(new URL('../prisma/migrations/20260911120000_friendship_operations/migration.sql', import.meta.url), 'utf8')
    .replace('CREATE TABLE "FriendshipOperation"', 'CREATE TEMP TABLE "FriendshipOperation"');
  await expect(prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "User" (id INTEGER PRIMARY KEY)');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "Friendship" (id INTEGER PRIMARY KEY, "requesterId" INTEGER, "receiverId" INTEGER, status TEXT, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    await tx.$executeRawUnsafe(`INSERT INTO "Friendship" (id, "requesterId", "receiverId", status) VALUES
      (1, 1, 1, 'ACCEPTED'), (2, 1, 2, 'PENDING'), (3, 2, 1, 'ACCEPTED'),
      (4, 3, 4, 'ACCEPTED'), (5, 4, 3, 'BLOCKED'), (6, 5, 6, 'PENDING'), (7, 6, 5, 'PENDING')`);
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
    expect(await tx.$queryRawUnsafe('SELECT id, status FROM "Friendship" ORDER BY id')).toEqual([
      { id: 3, status: 'ACCEPTED' }, { id: 5, status: 'BLOCKED' }, { id: 6, status: 'PENDING' }
    ]);
    for (const [values, code] of [["(8, 6, 5, 'PENDING')", '23505'], ["(9, 7, 7, 'PENDING')", '23514']]) {
      await tx.$executeRawUnsafe('SAVEPOINT constraint_test');
      await expect(tx.$executeRawUnsafe('INSERT INTO "Friendship" (id, "requesterId", "receiverId", status) VALUES ' + values)).rejects.toMatchObject({ meta: { code } });
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT constraint_test');
    }
    throw Error('fixture rollback');
  })).rejects.toThrow('fixture rollback');
});
