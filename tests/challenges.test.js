import { randomUUID } from 'node:crypto';
import prisma from '../server/db.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createRoomActions, gameRooms, stopRoomRuntime, expireChallenge, expireRoomInvites, sanitizeRoom } from '../server/domain/rooms.js';
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
  await prisma.friendship.deleteMany({ where: { requesterId: { in: users.map(user => user.id) } } });
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

async function openFriendRoom() {
  const data = { isPrivate: true, turnTimer: 30, buyIn: 0, allowSpectators: true };
  await createRoomActions(actor(users[0]))['room:create'](data, command('room:create', data));
  await prisma.friendship.create({ data: { requesterId: users[0].id, receiverId: users[1].id, status: 'ACCEPTED' } });
  return [...gameRooms.values()].find(room => room.hostId === users[0].id);
}
async function inviteFriend(room, user = users[1], request) {
  const data = { roomId: room.id, userId: user.id };
  await createRoomActions(actor(users[0]))['room:invite'](data, request ?? command('room:invite', data));
}
it('invites into the existing room without changing its settings, reserving a seat or extending a repeated invitation', async () => {
  const room = await openFriendRoom(), settings = structuredClone(room.settings);
  const data = { roomId: room.id, userId: users[1].id }, request = command('room:invite', data);
  await inviteFriend(room, users[1], request);
  const deadline = invitations(users[1].id)[0].expiresAt;
  await inviteFriend(room, users[1], request);
  await inviteFriend(room);
  expect(gameRooms.size).toBe(1);
  expect(room.settings).toEqual(settings);
  expect(invitations(users[1].id)).toMatchObject([{ roomId: room.id, kind: 'room', expiresAt: deadline, turnTimer: 30 }]);
  expect(invitations(users[2].id)).toEqual([]);
  expect(await prisma.activeRoomMember.findUnique({ where: { userId: users[1].id } })).toBeNull();
  await createRoomActions(actor(users[1]))['room:join']({ code: room.joinCode });
  expect(getSession(users[1].id).roomId).toBe(room.id);
  expect(room.invites).toEqual([]);
  expect(room.players.every(p => !p.ready)).toBe(true);
});
it('declines only the recipient invitation and keeps the host room available', async () => {
  const room = await openFriendRoom(); await inviteFriend(room);
  const data = { roomId: room.id };
  await expect(createRoomActions(actor(users[2]))['room:invite-decline'](data, command('room:invite-decline', data))).rejects.toThrow('Invitation');
  const request = command('room:invite-decline', data);
  await createRoomActions(actor(users[1]))['room:invite-decline'](data, request);
  await createRoomActions(actor(users[1]))['room:invite-decline'](data, request);
  expect(room.status).toBe('waiting');
  expect(getSession(users[0].id).roomId).toBe(room.id);
  expect(invitations(users[1].id)).toEqual([]);
});
it('restores existing-room invitations after restart and expires them without closing the room', async () => {
  let room = await openFriendRoom(); await inviteFriend(room);
  const id = room.id, deadline = invitations(users[1].id)[0].expiresAt;
  await stopRoomRuntime(); gameRooms.clear(); users.forEach(user => removeSession(user.id));
  await startGameplayOwnership(); await restoreRooms(); room = gameRooms.get(id);
  expect(invitations(users[1].id)).toMatchObject([{ roomId: id, expiresAt: deadline }]);
  vi.spyOn(Date, 'now').mockReturnValue(deadline);
  await expireRoomInvites(room);
  expect(invitations(users[1].id)).toEqual([]);
  expect(room.status).toBe('waiting');
});
it('rejects private non-friends; closing the room clears its inbox entry', async () => {
  const room = await openFriendRoom();
  await prisma.user.update({ where: { id: users[2].id }, data: { profilePublic: false } });
  await expect(inviteFriend(room, users[2])).rejects.toThrow('cannot receive');
  expect(room.invites ?? []).toEqual([]);
  await inviteFriend(room);
  await createRoomActions(actor(users[0]))['room:leave']({ roomId: room.id });
  expect(invitations(users[1].id)).toEqual([]);
});

it('caps the shared inbox across room invitations and profile challenges', async () => {
  const room = await openFriendRoom(); await inviteFriend(room);
  for (const host of users.slice(2, 6)) await send(host, users[1]);
  await expect(send(users[6], users[1])).rejects.toThrow('too many pending');
  expect(invitations(users[1].id)).toHaveLength(5);
});
it('cannot invite after another player takes the seat', async () => {
  const room = await openFriendRoom();
  await createRoomActions(actor(users[2]))['room:join']({ code: room.joinCode });
  await expect(inviteFriend(room)).rejects.toThrow('open room');
  expect(invitations(users[1].id)).toEqual([]);
});

it('accepts an eligible public profile invitation into the same room without requiring friendship', async () => {
  const room = await openFriendRoom();
  await inviteFriend(room, users[2]);
  expect(invitations(users[2].id)).toMatchObject([{ roomId: room.id, kind: 'room' }]);
  await createRoomActions(actor(users[2]))['room:join']({ code: room.joinCode });
  expect(getSession(users[2].id).roomId).toBe(room.id);
  expect(room.players).toHaveLength(2);
});
it('does not allow guest or bot strangers to receive profile invitations', async () => {
  const room = await openFriendRoom();
  await prisma.user.update({ where: { id: users[2].id }, data: { isGuest: true } });
  await expect(inviteFriend(room, users[2])).rejects.toThrow('cannot receive');
  await prisma.user.update({ where: { id: users[2].id }, data: { isGuest: false, isBot: true } });
  await expect(inviteFriend(room, users[2])).rejects.toThrow('Choose a friend');
});
