import { randomUUID } from 'node:crypto';
import prisma from '../server/db.js';
import { startGameplayOwnership, claimGameplayOwnership, gameplayOwner, inGameplayTransaction } from '../server/services/gameplayOwnership.js';
import { createRoomRecord, commitRoomRecord, RoomMembershipConflict, RoomRevisionConflict } from '../server/services/roomRecords.js';
import { createGameRun, abortGameStart } from '../server/services/gameRuns.js';
import { retireExpiredGuest } from '../server/services/guestCleanup.js';

const settings = { buyIn: 0, turnTimer: 60, isPrivate: false, allowSpectators: true, autoReady: false };
let users, roomIds, keys, sequence = 0;
const code = () => {
  let n = ++sequence;
  return 'R' + Array.from({ length: 5 }, () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]; n = Math.floor(n / 32); return c; }).join('');
};
beforeEach(async () => {
  await startGameplayOwnership(); roomIds = []; keys = [];
  users = await Promise.all([0,1,2,3].map(i => prisma.user.create({ data: {
    username: 'room-record-' + randomUUID(), friendCode: randomUUID(), coins: 100
  } })));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { OR: [{ key: { in: keys } }, { roomId: { in: roomIds } }] } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.roomRecord.deleteMany({ where: { creatorId: { in: users.map(u => u.id) } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: users.map(u => u.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
});
async function create(creator = users[0], changes = {}) {
  const room = await createRoomRecord({ creatorId: creator.id, key: randomUUID(), joinCode: code(), settings, ...changes });
  roomIds.push(room.id); return room;
}
async function change(room, reduce, command = null) {
  return (await commitRoomRecord({ roomId: room.id, expectedRevision: room.revision, command }, reduce)).room;
}

it.each([['user', 'findMany'], ['activeRoomMember', 'createMany']])(
  'rolls back room creation when its actor becomes obsolete during %s.%s', async (model, method) => {
    let current = true;
    const input = { creatorId: users[0].id, key: randomUUID(), joinCode: code(), settings };
    const owner = gameplayOwner();
    await expect(inGameplayTransaction(owner, null, tx => {
      const guarded = new Proxy(tx, { get(target, key) {
        if (key !== model) return Reflect.get(target, key);
        return new Proxy(target[key], { get(delegate, name) {
          if (name !== method) return Reflect.get(delegate, name);
          return async (...args) => { const result = await delegate[name](...args); current = false; return result; };
        } });
      } });
      return createRoomRecord(input, guarded, owner, () => { if (!current) throw Error('Session replaced'); });
    })).rejects.toThrow('Session replaced');
    expect(await prisma.roomRecord.count({ where: { creatorId: users[0].id } })).toBe(0);
    expect(await prisma.activeRoomMember.findUnique({ where: { userId: users[0].id } })).toBeNull();
  }
);

it('confirms committed room creation after the original actor is replaced', async () => {
  const input = { creatorId: users[0].id, key: randomUUID(), joinCode: code(), settings };
  const saved = await createRoomRecord(input);
  const confirmed = await createRoomRecord(input, null, gameplayOwner(), () => { throw Error('Session replaced'); });
  expect(confirmed.id).toBe(saved.id);
  expect(await prisma.roomRecord.count({ where: { creatorId: users[0].id } })).toBe(1);
});
async function readyRoom({ buyIn = 0, bot = null, invited = false } = {}) {
  let room = await create(users[0], { settings: { ...settings, buyIn } });
  room = await change(room, draft => { draft.players[0].ready = true; draft.players.push({ userId: (bot || users[1]).id, ready: true, online: true, joinedViaInvite: invited }); });
  const key = randomUUID(); keys.push(key);
  room = await change(room, draft => { draft.status = 'STARTING'; draft.startAttempt = { key, players: [users[0].id, (bot || users[1]).id] }; });
  return { room, input: { key, roomId: room.id, redPlayerId: users[0].id, blackPlayerId: (bot || users[1]).id,
    mode: bot ? 'FRIENDLY' : 'RANKED', buyIn, turnTime: 60, origin: bot ? 'bot' : 'room' } };
}

it.each([true, false])('reserves participant invitation evidence atomically and keeps it on retry: %s', async invited => {
  const { room, input } = await readyRoom({ invited });
  const runs = await Promise.all([createGameRun(input), createGameRun(input)]);
  expect(runs[0].id).toBe(runs[1].id);
  expect(runs.map(run => run.invitedPlayerIds)).toEqual([invited ? [users[1].id] : [], invited ? [users[1].id] : []]);
  const saved = await prisma.gameRun.findUnique({ where: { id: runs[0].id } });
  expect(saved.invitedPlayerIds).toEqual(invited ? [users[1].id] : []);
  expect((await prisma.roomRecord.findUnique({ where: { id: room.id } })).status).toBe('PLAYING');
});

it('rejects changes to existing invitation evidence and rolls back without changing the room', async () => {
  let room = await create();
  room = await change(room, draft => draft.players.push({ userId: users[1].id, online: true, ready: false, joinedViaInvite: true }));
  await expect(change(room, draft => { draft.players[1].joinedViaInvite = false; })).rejects.toThrow('entry source is immutable');
  expect((await prisma.roomRecord.findUnique({ where: { id: room.id } })).state.players[1].joinedViaInvite).toBe(true);
  // An old host member without this optional field remains canonical and editable.
  room = await change(room, draft => { draft.players[0].ready = true; });
  expect(room.state.players[0].ready).toBe(true);
});

it('returns one stable room and invite for simultaneous creation retries and refuses changed intent', async () => {
  const input = { creatorId: users[0].id, key: randomUUID(), settings, joinCode: code() };
  const rooms = await Promise.all(Array.from({ length: 8 }, () => createRoomRecord({ ...input, joinCode: code() })));
  roomIds.push(rooms[0].id);
  expect(new Set(rooms.map(r => r.id)).size).toBe(1);
  expect(new Set(rooms.map(r => r.joinCode)).size).toBe(1);
  expect(await prisma.activeRoomMember.count({ where: { roomId: rooms[0].id } })).toBe(1);
  await expect(createRoomRecord({ ...input, settings: { ...settings, turnTimer: 30 } })).rejects.toThrow('identity conflict');
});

it('rolls back room state, member claims and command receipts together', async () => {
  const room = await create();
  const command = { userId: users[1].id, key: randomUUID(), payload: { type: 'join' } };
  await expect(inGameplayTransaction(gameplayOwner(), null, async tx => {
    await commitRoomRecord({ roomId: room.id, expectedRevision: 0, command }, draft => {
      draft.players.push({ userId: users[1].id, online: true, ready: false });
    }, tx);
    throw Error('rollback after room write');
  })).rejects.toThrow('rollback after room write');
  expect((await prisma.roomRecord.findUnique({ where: { id: room.id } })).revision).toBe(0);
  expect(await prisma.activeRoomMember.findUnique({ where: { userId: users[1].id } })).toBeNull();
  expect(await prisma.roomCommandReceipt.count({ where: { roomId: room.id } })).toBe(0);
});

it('reconciles a repeated command to the current record without rerunning its transition', async () => {
  let room = await create();
  const command = { userId: users[0].id, key: randomUUID(), payload: { type: 'ready', ready: true } };
  room = await change(room, draft => { draft.players[0].ready = true; }, command);
  room = await change(room, draft => { draft.players[0].ready = false; });
  const reduce = vi.fn(() => { throw Error('must not rerun'); });
  const retried = await commitRoomRecord({ roomId: room.id, expectedRevision: 0, command }, reduce);
  expect(retried).toMatchObject({ duplicate: true, commandRevision: 1, room: { revision: 2 } });
  expect(retried.room.state.players[0].ready).toBe(false);
  expect(reduce).not.toHaveBeenCalled();
  await expect(commitRoomRecord({ roomId: room.id, expectedRevision: 0, command: { ...command, payload: { ready: false } } }, reduce)).rejects.toThrow('identity conflict');
});

it('lets only one concurrent claimant enter a last room seat', async () => {
  const room = await create();
  const results = await Promise.allSettled([users[1], users[2]].map(user => change(room, draft => {
    draft.players.push({ userId: user.id, online: true, ready: false });
  })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason).toBeInstanceOf(RoomRevisionConflict);
  expect(await prisma.activeRoomMember.count({ where: { roomId: room.id } })).toBe(2);
});

it('enforces one human room role across rooms, including a spectator claim', async () => {
  const a = await create(), b = await create(users[1]);
  const results = await Promise.allSettled([a,b].map(room => change(room, draft => { draft.spectators.push({ userId: users[2].id }); })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason).toBeInstanceOf(RoomMembershipConflict);
  const owned = await prisma.activeRoomMember.findUnique({ where: { userId: users[2].id } });
  expect(owned.role).toBe('SPECTATOR');
});

it('serializes room admission against direct game creation using the same account locks', async () => {
  const room = await create(); const key = randomUUID(); keys.push(key);
  const results = await Promise.allSettled([
    change(room, draft => { draft.players.push({ userId: users[1].id }); }),
    createGameRun({ key, redPlayerId: users[1].id, blackPlayerId: users[2].id, mode: 'FRIENDLY' })
  ]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  const [roomSeat, gameSeat] = await Promise.all([
    prisma.activeRoomMember.findUnique({ where: { userId: users[1].id } }),
    prisma.activeGamePlayer.findUnique({ where: { userId: users[1].id } })
  ]);
  expect(Number(!!roomSeat) + Number(!!gameSeat)).toBe(1);
});

it('transfers room player claims, stakes and the game association atomically and restores them on cancellation', async () => {
  const { room, input } = await readyRoom({ buyIn: 20 });
  const run = await createGameRun(input);
  expect((await prisma.roomRecord.findUnique({ where: { id: room.id } }))).toMatchObject({ status: 'PLAYING', revision: room.revision + 1, state: { gameId: run.id } });
  expect(await prisma.activeRoomMember.count({ where: { roomId: room.id } })).toBe(0);
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: run.id } })).toBe(2);
  const repeated = await createGameRun(input); expect(repeated.id).toBe(run.id);
  await Promise.all([abortGameStart(input.key), abortGameStart(input.key)]);
  const waiting = await prisma.roomRecord.findUnique({ where: { id: room.id } });
  expect(waiting).toMatchObject({ status: 'WAITING', state: { gameId: null, startAttempt: null } });
  expect(waiting.state.players.every(p => !p.ready)).toBe(true);
  expect(await prisma.activeRoomMember.count({ where: { roomId: room.id } })).toBe(2);
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: run.id } })).toBe(0);
  for (const user of users.slice(0,2)) expect((await prisma.user.findUnique({ where: { id: user.id } })).coins).toBe(100);
  expect(await prisma.coinTransaction.count({ where: { receiverId: { in: users.slice(0,2).map(u => u.id) }, reason: 'WAGER_REFUND' } })).toBe(2);
});

it('rolls back the entire room-to-game handoff when its owning transaction fails', async () => {
  const { room, input } = await readyRoom({ buyIn: 20 });
  await expect(inGameplayTransaction(gameplayOwner(), null, async tx => {
    await createGameRun(input, tx); throw Error('handoff rollback');
  })).rejects.toThrow('handoff rollback');
  expect((await prisma.roomRecord.findUnique({ where: { id: room.id } })).status).toBe('STARTING');
  expect(await prisma.activeRoomMember.count({ where: { roomId: room.id } })).toBe(2);
  expect(await prisma.gameRun.findUnique({ where: { key: input.key } })).toBeNull();
  expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(100);
});

it('rejects a stale or mismatched game start before it can spend money', async () => {
  const { room, input } = await readyRoom({ buyIn: 20 });
  await expect(createGameRun({ ...input, redPlayerId: input.blackPlayerId, blackPlayerId: input.redPlayerId })).rejects.toThrow('accepted room start');
  await change(room, draft => { draft.status = 'CLOSED'; });
  await expect(createGameRun(input)).rejects.toThrow('accepted room start');
  expect(await prisma.gameRun.findUnique({ where: { key: input.key } })).toBeNull();
});

it('keeps bots ready without taking exclusive room claims and protects durable guest membership', async () => {
  const bot = await prisma.user.update({ where: { id: users[3].id }, data: { isBot: true } });
  const a = await create(), b = await create(users[1]);
  for (const room of [a,b]) {
    const saved = await change(room, draft => { draft.players.push({ userId: bot.id, ready: false }); });
    expect(saved.state.players[1].ready).toBe(true);
  }
  expect(await prisma.activeRoomMember.findUnique({ where: { userId: bot.id } })).toBeNull();
  const guest = await prisma.user.update({ where: { id: users[2].id }, data: { isGuest: true, coins: 0, guestExpiresAt: new Date(0) } });
  await create(guest);
  expect(await retireExpiredGuest(guest.id, { isActive: () => false })).toBe('protected');
});

it('does not revive a closed room, recycle its invite code or reacquire members on creation retry', async () => {
  const input = { creatorId: users[0].id, key: randomUUID(), joinCode: code(), settings };
  let room = await createRoomRecord(input); roomIds.push(room.id);
  room = await change(room, draft => { draft.status = 'CLOSED'; });
  expect((await createRoomRecord({ ...input, joinCode: code() })).status).toBe('CLOSED');
  expect(await prisma.activeRoomMember.count({ where: { roomId: room.id } })).toBe(0);
  await expect(change(room, draft => { draft.status = 'WAITING'; })).rejects.toThrow('Invalid room transition');
  await expect(createRoomRecord({ ...input, creatorId: users[1].id, key: randomUUID() })).rejects.toMatchObject({ code: 'P2002' });
});

it('refuses unready starts, duplicate members and offline members without a recoverable deadline', async () => {
  const room = await create();
  await expect(change(room, draft => { draft.players.push({ userId: users[0].id }); })).rejects.toThrow('Invalid room member');
  await expect(change(room, draft => { draft.players[0].online = false; })).rejects.toThrow('disconnect deadline');
  const joined = await change(room, draft => { draft.players.push({ userId: users[1].id }); });
  await expect(change(joined, draft => { draft.status = 'STARTING'; draft.startAttempt = { key: randomUUID(), players: [users[0].id, users[1].id] }; })).rejects.toThrow('not ready');
});

it('fences obsolete writers and rejects unknown state versions instead of guessing a room', async () => {
  const room = await create();
  const old = gameplayOwner(); await claimGameplayOwnership();
  await expect(commitRoomRecord({ roomId: room.id, expectedRevision: 0 }, draft => { draft.players[0].ready = true; }, null, old)).rejects.toThrow('newer server');
  await startGameplayOwnership();
  await prisma.roomRecord.update({ where: { id: room.id }, data: { stateVersion: 999 } });
  await expect(change(room, draft => { draft.players[0].ready = true; })).rejects.toThrow('unsupported room record');
});

it('restores the complete pre-cancellation state if an owning transaction rolls back', async () => {
  const { room, input } = await readyRoom({ buyIn: 20 });
  const run = await createGameRun(input);
  await expect(inGameplayTransaction(gameplayOwner(), null, async tx => {
    await abortGameStart(input.key, tx); throw Error('cancel rollback');
  })).rejects.toThrow('cancel rollback');
  expect((await prisma.roomRecord.findUnique({ where: { id: room.id } })).status).toBe('PLAYING');
  expect((await prisma.gameRun.findUnique({ where: { id: run.id } })).status).toBe('OPEN');
  expect(await prisma.activeRoomMember.count({ where: { roomId: room.id } })).toBe(0);
  expect(await prisma.activeGamePlayer.count({ where: { gameRunId: run.id } })).toBe(2);
  expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(80);
});

it('retries cancellation in the right lock order when room-backed creation commits during its first lookup', async () => {
  const { room, input } = await readyRoom({ buyIn: 20 });
  let creationEntered, releaseCreation, readAbsent;
  const entered = new Promise(resolve => { creationEntered = resolve; });
  const release = new Promise(resolve => { releaseCreation = resolve; });
  const absent = new Promise(resolve => { readAbsent = resolve; });
  const original = prisma.$transaction.bind(prisma);
  vi.spyOn(prisma, '$transaction').mockImplementation((callback, ...options) => original(async tx => {
    const find = tx.gameRun.findUnique.bind(tx.gameRun);
    tx.gameRun.findUnique = async args => {
      const value = await find(args);
      if (args.select?.roomId && args.where.key === input.key && !value) readAbsent();
      return value;
    };
    return callback(tx);
  }, ...options));
  const creation = inGameplayTransaction(gameplayOwner(), null, async tx => {
    const run = await createGameRun(input, tx); creationEntered(); await release; return run;
  });
  let cancellation;
  try {
    await entered;
    cancellation = abortGameStart(input.key);
    await absent;
    releaseCreation();
    await Promise.all([creation, cancellation]);
    expect((await prisma.roomRecord.findUnique({ where: { id: room.id } })).status).toBe('WAITING');
    expect(await prisma.activeRoomMember.count({ where: { roomId: room.id } })).toBe(2);
    expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(100);
  } finally { releaseCreation(); await Promise.allSettled([creation, cancellation]); }
});


it('persists a host settings change once and cannot undo newer settings by retrying its receipt', async () => {
  let room = await create();
  const first = { userId: users[0].id, key: randomUUID(), payload: { type: 'room:settings', data: { turnTimer: 30 } } };
  const original = room;
  const reduce = draft => { draft.settings.turnTimer = 30; };
  room = await change(room, reduce, first);
  room = await change(room, draft => { draft.settings.turnTimer = 90; }, { ...first, key: randomUUID(), payload: { type: 'room:settings', data: { turnTimer: 90 } } });
  const retried = await commitRoomRecord({ roomId: room.id, expectedRevision: original.revision, command: first }, reduce);
  expect(retried.duplicate).toBe(true);
  expect(retried.room.state.settings.turnTimer).toBe(90);
  expect(retried.room.joinCode).toBe(original.joinCode);
  expect(retried.room.creation.settings.turnTimer).toBe(60);
  expect(await prisma.roomCommandReceipt.count({ where: { roomId: room.id } })).toBe(2);
});

it('enforces host and unready settings policy at the durable boundary', async () => {
  let room = await create();
  room = await change(room, draft => { draft.players.push({ userId: users[1].id, online: true, ready: false }); });
  const command = { userId: users[1].id, key: randomUUID(), payload: { type: 'room:settings' } };
  await expect(change(room, draft => { draft.settings.isPrivate = true; }, command)).rejects.toThrow('Only the host');
  room = await change(room, draft => { draft.players[1].ready = true; });
  await expect(change(room, draft => { draft.settings.isPrivate = true; }, { ...command, userId: users[0].id })).rejects.toThrow('Only the host');
  expect((await prisma.roomRecord.findUnique({ where: { id: room.id } })).state.settings.isPrivate).toBe(false);
});
