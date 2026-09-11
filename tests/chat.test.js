import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createChatService, chatAccess } from '../server/services/chat.js';
import { parseChatChannel } from '../shared/chat.js';

const db = new PrismaClient(), actor = { userId: 987654, connectionId: 'current' };
let session, chat;
beforeEach(async () => {
  await db.chatMessage.deleteMany();
  session = { connectionId: 'current', username: 'Alice', phase: 'in-game', gameId: 3 };
  chat = createChatService({ db, getSession: () => session,
    getGame: () => ({ redUserId: actor.userId, blackUserId: 2, getOpponentId: () => 2 }),
    getConnections: () => new Map([[2, { username: 'Bob' }], [3, { username: 'Carol' }]]) });
});
afterAll(async () => { await db.chatMessage.deleteMany(); await db.$disconnect(); });
const payload = (extra = {}) => ({ channelId: 'game:3', content: 'Hello @Carol <tag>', clientMessageId: randomUUID(), ...extra });

it('commits concurrent retries once and persists the same metadata returned in history', async () => {
  const input = payload(); const replies = await Promise.all(Array.from({ length: 10 }, () => chat.send(actor, input)));
  expect(replies.every(r => r.ok)).toBe(true); expect(replies.filter(r => r.created)).toHaveLength(1);
  expect(new Set(replies.map(r => r.message.id)).size).toBe(1); expect(await db.chatMessage.count()).toBe(1);
  expect(replies[0].message).toMatchObject({ content: input.content, mentions: [3, 2], spectator: false });
  const recovered = await chat.history(actor, { channelId: 'game:3' }); expect(recovered.messages).toEqual([replies[0].message]);
  expect((await chat.send(actor, { ...input, content: 'Different' })).code).toBe('conflict');
  expect((await chat.send(actor, payload())).code).toBe('rate_limited');
});
it('authorizes from the current session and rejects malformed ids or replaced connections', async () => {
  for (const channelId of ['game:3junk', 'room:01', 'game:0', 'game:9007199254740993']) expect(parseChatChannel(channelId)).toBeNull();
  expect(chatAccess(session, actor, 'game:4')).toBe(false);
  expect((await chat.send(actor, payload({ content: {} }))).code).toBe('invalid');
  session.connectionId = 'replacement'; expect((await chat.send(actor, payload())).code).toBe('forbidden');
  expect((await chat.history(actor, { channelId: 'global' })).code).toBe('forbidden');
  session.connectionId = 'current'; session.phase = 'idle'; expect((await chat.send(actor, payload())).code).toBe('forbidden');
  expect(await db.chatMessage.count()).toBe(0);
});
it('persists spectator metadata and prevents spectators from notifying players', async () => {
  session.phase = 'spectating'; session.spectatingGameId = 3; session.spectatingRoomId = 4;
  const sent = await chat.send(actor, payload({ content: '@Bob @Carol Good game' }));
  expect(sent.message).toMatchObject({ spectator: true, mentions: [3] });
  expect(chatAccess(session, actor, 'room:4')).toBe(true);
});
it('paginates deterministically when timestamps tie and explicitly reports empty history', async () => {
  await db.chatMessage.createMany({ data: Array.from({ length: 51 }, (_, i) => ({ channelId: 'game:3', senderId: 2,
    username: 'Bob', content: String(i), createdAt: new Date('2026-01-01') })) });
  const latest = await chat.history(actor, { channelId: 'game:3' }); expect(latest.messages).toHaveLength(50); expect(latest.hasMore).toBe(true);
  const older = await chat.history(actor, { channelId: 'game:3', beforeId: latest.messages[0].id });
  expect(older.messages.map(m => m.content)).toEqual(['0']); expect(older.hasMore).toBe(false);
  expect(await chat.history(actor, { channelId: 'global' })).toEqual({ ok: true, messages: [], hasMore: false });
  expect((await chat.history(actor, { channelId: 'game:3', beforeId: 'oops' })).code).toBe('invalid');
});
it('rechecks membership after an asynchronous history read', async () => {
  const original = db.chatMessage.findMany.bind(db.chatMessage);
  const spy = vi.spyOn(db.chatMessage, 'findMany').mockImplementationOnce(async args => { const rows = await original(args); session.phase = 'idle'; return rows; });
  expect((await chat.history(actor, { channelId: 'game:3' })).code).toBe('forbidden'); spy.mockRestore();
});
