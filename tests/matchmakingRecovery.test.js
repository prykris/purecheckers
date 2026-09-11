import { randomUUID } from 'node:crypto';
import prisma from '../server/db.js';
import * as roomRecords from '../server/services/roomRecords.js';
import { startGameplayOwnership } from '../server/services/gameplayOwnership.js';
import { createQuickPlayRoom, gameRooms, stopRoomRuntime } from '../server/domain/rooms.js';
import { activeGames, stopGameRuntime } from '../server/domain/games.js';
import { persistNewRoom } from '../server/domain/roomRuntime.js';
import { runGameplayWork } from '../server/services/gameplayWork.js';
import { enqueueSessionWork } from '../server/domain/sessionWork.js';
import { getOrCreateSession, getSession, setPhase, forceIdle, removeSession, setMatchmakingDeadline } from '../server/domain/sessions.js';
import { quickPlayPool } from '../server/services/quickPlay.js';

let users, pending, releases;
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function observe(task) {
  const result = task.then(value => ({ value }), error => ({ error }));
  pending.push(result); return result;
}
function pair() {
  const joinedAt = Date.now() - 15000;
  for (const user of users) {
    setPhase(user.id, 'matchmaking');
    setMatchmakingDeadline(user.id, joinedAt, joinedAt + 20000, () => {});
    quickPlayPool.add(user.id, 1000, false);
    quickPlayPool.players.find(p => p.userId === user.id).joinedAt = joinedAt;
  }
  return quickPlayPool.tryMatch()[0];
}
beforeEach(async () => {
  await startGameplayOwnership(); pending = []; releases = [];
  users = await Promise.all([0, 1].map(i => prisma.user.create({ data: {
    username: `pair-recovery-${i}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
  for (const user of users) getOrCreateSession(user.id, user.username, false).connectionId = `connection-${user.id}`;
});
afterEach(async () => {
  releases.forEach(release => release());
  // Stop retry waits before draining tasks; an intentionally unavailable read
  // must not make fixture cleanup wait for a database recovery that never comes.
  await Promise.all([stopRoomRuntime(), stopGameRuntime()]);
  await Promise.all(pending); vi.restoreAllMocks();
  activeGames.clear(); gameRooms.clear();
  for (const user of users) { quickPlayPool.remove(user.id); removeSession(user.id); }
  const ids = users.map(user => user.id);
  const runs = await prisma.gameRun.findMany({ where: { redPlayerId: { in: ids } }, select: { key: true } });
  const keys = runs.map(run => run.key);
  await prisma.gameSettlementJob.deleteMany({ where: { key: { in: keys } } });
  await prisma.gameRun.deleteMany({ where: { key: { in: keys } } });
  await prisma.roomRecord.deleteMany({ where: { creatorId: { in: ids } } });
  await prisma.game.deleteMany({ where: { settlementKey: { in: keys } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

it('requeues a confirmed failed creation with the original wait, then successfully matches again', async () => {
  const { a, b } = pair();
  const fallbackAt = getSession(a.userId).matchmakingFallbackAt;
  const failure = vi.spyOn(roomRecords, 'createRoomRecord').mockRejectedValue(Error('write unavailable'));
  expect((await observe(createQuickPlayRoom(a, b))).error.message).toBe('write unavailable');
  expect(quickPlayPool.players).toEqual([a, b]);
  expect(getSession(a.userId)).toMatchObject({ phase: 'matchmaking', matchmakingFallbackAt: fallbackAt });
  expect(await prisma.roomRecord.count({ where: { creatorId: a.userId } })).toBe(0);
  failure.mockRestore();
  const [retried] = quickPlayPool.tryMatch();
  await createQuickPlayRoom(retried.a, retried.b);
  expect(getSession(a.userId).phase).toBe('in-game');
  expect(getSession(b.userId).gameId).toBe(getSession(a.userId).gameId);
  expect(quickPlayPool.size()).toBe(0);
  expect(quickPlayPool.ownsClaim(a)).toBe(false);
});

it('confirms two lost creation responses without making a second room or requeuing its players', async () => {
  const { a, b } = pair();
  const original = roomRecords.createRoomRecord;
  const lost = vi.spyOn(roomRecords, 'createRoomRecord').mockImplementation(async (...args) => {
    await original(...args); throw Error('response lost');
  });
  await createQuickPlayRoom(a, b);
  expect(lost).toHaveBeenCalledTimes(2);
  expect(await prisma.roomRecord.count({ where: { creatorId: a.userId } })).toBe(1);
  expect(activeGames.size).toBe(1);
  expect(quickPlayPool.size()).toBe(0);
  expect(getSession(a.userId).phase).toBe('in-game');
  expect(getSession(b.userId).gameId).toBe(getSession(a.userId).gameId);
});

it('holds later commands during unavailable confirmation and requeues only after a successful read', async () => {
  const { a, b } = pair(), entered = deferred(), release = deferred();
  releases.push(release.resolve);
  vi.spyOn(roomRecords, 'createRoomRecord').mockRejectedValue(Error('write unavailable'));
  const original = roomRecords.readRoomCreation;
  vi.spyOn(roomRecords, 'readRoomCreation').mockRejectedValueOnce(Error('read unavailable'))
    .mockImplementationOnce(async (...args) => { entered.resolve(); await release.promise; return original(...args); });
  const pairing = observe(createQuickPlayRoom(a, b));
  await entered.promise;
  const cancel = vi.fn(() => { quickPlayPool.remove(a.userId); forceIdle(a.userId); });
  const cancelled = enqueueSessionWork([getSession(a.userId)], cancel);
  expect(quickPlayPool.ownsClaim(a)).toBe(true);
  expect(quickPlayPool.size()).toBe(0);
  expect(cancel).not.toHaveBeenCalled();
  release.resolve();
  expect((await pairing).error.message).toBe('write unavailable');
  await cancelled;
  expect(getSession(a.userId).phase).toBe('idle');
  expect(quickPlayPool.players).toEqual([b]);
});

it('interrupts an unavailable confirmation on shutdown without requeuing unknown membership', async () => {
  const { a, b } = pair(), attempted = deferred();
  vi.spyOn(roomRecords, 'createRoomRecord').mockRejectedValue(Error('write unavailable'));
  const read = vi.spyOn(roomRecords, 'readRoomCreation').mockImplementation(async () => {
    attempted.resolve(); throw Error('read unavailable');
  });
  const pairing = observe(createQuickPlayRoom(a, b));
  await attempted.promise;
  await new Promise(resolve => setImmediate(resolve)); // the failed read has entered its one-second backoff
  let timeout;
  try {
    expect(await Promise.race([
      stopRoomRuntime().then(() => 'stopped'),
      new Promise(resolve => { timeout = setTimeout(() => resolve('still waiting'), 250); })
    ])).toBe('stopped');
  } finally { clearTimeout(timeout); }
  expect((await pairing).error.message).toMatch(/runtime stopped/);
  expect(read).toHaveBeenCalledTimes(1);
  expect(quickPlayPool.size()).toBe(0);
  expect(activeGames.size).toBe(0);
});

it('retries projection after commit instead of returning a false creation failure', async () => {
  const { a, b } = pair();
  const original = prisma.$transaction.bind(prisma);
  let failures = 0;
  vi.spyOn(prisma, '$transaction').mockImplementation((work, options) => original(tx => work(new Proxy(tx, {
    get(target, key) {
      if (key !== 'user') return Reflect.get(target, key);
      return new Proxy(target.user, { get(delegate, method) {
        if (method !== 'findMany') return Reflect.get(delegate, method);
        return args => {
          if (args.include?.sessionNotices && failures++ === 0) throw Error('projection unavailable');
          return delegate.findMany(args);
        };
      } });
    }
  })), options));
  await createQuickPlayRoom(a, b);
  expect(failures).toBeGreaterThan(1);
  expect(await prisma.roomRecord.count({ where: { creatorId: a.userId } })).toBe(1);
  expect(getSession(a.userId).phase).toBe('in-game');
  expect(quickPlayPool.size()).toBe(0);
});

it('restores an existing durable membership before requeuing the unaffected partner', async () => {
  const { a, b } = pair();
  const existing = await roomRecords.createRoomRecord({ creatorId: a.userId, key: randomUUID(), joinCode: 'ABC234',
    settings: { buyIn: 0, turnTimer: 60, isPrivate: false, allowSpectators: true, autoReady: false } });
  const outcome = await observe(createQuickPlayRoom(a, b));
  expect(outcome.error).toBeInstanceOf(roomRecords.RoomMembershipConflict);
  expect(getSession(a.userId)).toMatchObject({ phase: 'in-room', roomId: Number(existing.id) });
  expect(getSession(b.userId).phase).toBe('matchmaking');
  expect(quickPlayPool.players).toEqual([b]);
  expect(quickPlayPool.ownsClaim(a)).toBe(false);
  expect(await prisma.roomRecord.count({ where: { creatorId: a.userId } })).toBe(1);
});

it('does not accept a different creation intent through the confirmation fallback', async () => {
  const input = { creatorId: users[0].id, key: randomUUID(), joinCode: 'ABC235',
    settings: { buyIn: 0, turnTimer: 60, isPrivate: false, allowSpectators: true, autoReady: false } };
  const saved = await roomRecords.createRoomRecord(input);
  await expect(runGameplayWork(work => persistNewRoom({ ...input, settings: { ...input.settings, buyIn: 20 } }, work)))
    .rejects.toThrow('Room creation identity conflict');
  const confirmed = await roomRecords.readRoomCreation(input.creatorId, input.key);
  expect(confirmed.id).toBe(saved.id);
  expect(confirmed.state.settings.buyIn).toBe(0);
});
