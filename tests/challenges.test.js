import { randomUUID } from 'node:crypto';
import prisma from '../server/db.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createRoomActions, gameRooms, stopRoomRuntime, expireChallenge, sanitizeRoom } from '../server/domain/rooms.js';
import { getOrCreateSession, getSession, removeSession } from '../server/domain/sessions.js';
import { restoreRooms } from '../server/domain/roomRestoration.js';
import { challengeInvitations } from '../shared/challenges.js';

let users;
const actor = user => {
  const session = getOrCreateSession(user.id, user.username, false);
  session.connectionId = 'connection-' + user.id;
  return { userId: user.id, connectionId: session.connectionId };
};
const command = (type, data = {}) => ({ id: randomUUID(), type, data, createdAt: Date.now() });
const invitations = id => challengeInvitations(gameRooms.values(), id);
async function send(from = users[0], to = users[1], request = command('challenge:send', { userId: to.id })) {
  await createRoomActions(actor(from))['challenge:send']({ userId: to.id }, request);
  return [...gameRooms.values()].find(room => room.hostId === from.id);
}
beforeEach(async () => {
  await startGameplayOwnership();
  users = await Promise.all(Array.from({ length: 8 }, () => prisma.user.create({ data: { username: randomUUID(), friendCode: randomUUID() } })));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await stopRoomRuntime(); gameRooms.clear(); users.forEach(user => removeSession(user.id));
  await prisma.roomRecord.deleteMany();
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
});

it('reserves only the sender, projects the invitation privately and restricts acceptance to its recipient', async () => {
  actor(users[1]);
  const room = await send();
  expect(getSession(users[0].id).phase).toBe('in-room');
  expect(getSession(users[1].id).phase).toBe('idle');
  expect(await prisma.activeRoomMember.findUnique({ where: { userId: users[1].id } })).toBeNull();
  expect(invitations(users[1].id)).toHaveLength(1);
  expect(invitations(users[2].id)).toEqual([]);
  expect(sanitizeRoom(room).canAddBot).toBe(false);
  expect(createRoomActions(actor(users[2]))['room:list']().rooms).toEqual([]);
  await expect(createRoomActions(actor(users[2]))['room:join']({ code: room.joinCode })).rejects.toThrow('Invitation');
  await createRoomActions(actor(users[1]))['room:join']({ code: room.joinCode });
  expect(invitations(users[1].id)).toEqual([]);
  expect(getSession(users[1].id).roomId).toBe(room.id);
  expect(room.players.every(player => !player.ready)).toBe(true);
  expect(room.players[1].joinedViaInvite).toBe(true);
});

it('declines with a durable receipt, closes the sender room and releases its membership', async () => {
  const room = await send(), data = { roomId: room.id };
  const request = command('challenge:decline', data);
  await createRoomActions(actor(users[1]))['challenge:decline'](data, request);
  expect(gameRooms.size).toBe(0);
  expect(getSession(users[0].id).phase).toBe('idle');
  expect(getSession(users[0].id).notice.reason).toBe('challenge-declined');
  expect(await prisma.activeRoomMember.count({ where: { roomId: BigInt(room.id) } })).toBe(0);
  expect(await prisma.roomCommandReceipt.findUnique({ where: { roomId_userId_key: { roomId: BigInt(room.id), userId: users[1].id, key: request.id } } })).not.toBeNull();
});

it('rejects late acceptance even before the timer runs, and expiry releases the sender', async () => {
  const room = await send();
  vi.spyOn(Date, 'now').mockReturnValue(room.challenge.expiresAt);
  expect(invitations(users[1].id)).toEqual([]);
  await expect(createRoomActions(actor(users[1]))['room:join']({ code: room.joinCode })).rejects.toThrow('Invitation');
  await expireChallenge(room);
  expect(gameRooms.size).toBe(0);
  expect(getSession(users[0].id).phase).toBe('idle');
  expect(getSession(users[0].id).notice.reason).toBe('challenge-expired');
});

it('does not expire an accepted room, and closes it when either player leaves', async () => {
  const room = await send();
  await createRoomActions(actor(users[1]))['room:join']({ code: room.joinCode });
  vi.spyOn(Date, 'now').mockReturnValue(room.challenge.expiresAt + 1);
  await expireChallenge(room);
  expect(gameRooms.get(room.id)).toBe(room);
  await createRoomActions(actor(users[1]))['room:leave']({ roomId: room.id });
  expect(gameRooms.size).toBe(0);
  expect(getSession(users[0].id).phase).toBe('idle');
});

it('restores the same invitation and deadline after restart without creating recipient membership', async () => {
  const room = await send(), deadline = room.challenge.expiresAt;
  await stopRoomRuntime(); gameRooms.clear(); users.forEach(user => removeSession(user.id));
  await startGameplayOwnership(); await restoreRooms();
  expect(invitations(users[1].id)).toMatchObject([{ roomId: room.id, expiresAt: deadline }]);
  expect(await prisma.activeRoomMember.findUnique({ where: { userId: users[1].id } })).toBeNull();
});

it('caps concurrent invitations to a recipient under the existing ordered account locks', async () => {
  const results = await Promise.allSettled(users.slice(1).map(from => send(from, users[0])));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(5);
  expect(invitations(users[0].id)).toHaveLength(5);
});

it('rejects self, private, guest and bot targets without creating a room', async () => {
  await expect(send(users[0], users[0])).rejects.toThrow('another player');
  for (const data of [{ profilePublic: false }, { profilePublic: true, isGuest: true }, { isGuest: false, isBot: true }]) {
    await prisma.user.update({ where: { id: users[1].id }, data });
    await expect(send()).rejects.toThrow('cannot receive');
  }
  expect(gameRooms.size).toBe(0);
});
