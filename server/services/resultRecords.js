import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { gameplayOwner, inGameplayTransaction } from './gameplayOwnership.js';
import { lockEconomyUsers } from './economy.js';
import { assertActiveAccount } from './accounts.js';
import { appendSessionNotice } from './sessionNotices.js';
import { createGameRun, abortGameStart } from './gameRuns.js';
import { lockRoomRecord } from './roomRecords.js';
import { RESULT_STATE_VERSION, initialResultState, normalizeResultState, resultViewers, splitResultState,
  transitionResult, resultAfterCancelledRematch } from '../domain/resultState.js';

export class ResultRevisionConflict extends Error {}
export class ResultMembershipConflict extends Error {}
const idsIn = state => [...state.players, ...state.spectators].map(p => p.userId);
const flat = record => ({ status: record.status, ...structuredClone(record.state) });
const stored = ({ run, ...record }) => record;
const validId = value => Number.isSafeInteger(value) && value > 0;

async function lockGame(tx, gameRunId) {
  if (!validId(gameRunId)) throw Error('Invalid result game identity');
  const run = await tx.gameRun.findUniqueOrThrow({ where: { id: gameRunId } });
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'game-settlement:' + run.key}, 0))`;
  return tx.gameRun.findUniqueOrThrow({ where: { id: gameRunId } });
}
export async function lockResultRecord(tx, gameRunId) {
  const run = await lockGame(tx, gameRunId);
  const record = await tx.gameResultRecord.findUnique({ where: { gameRunId } });
  if (!record || record.stateVersion !== RESULT_STATE_VERSION) throw Error('Missing or unsupported result record');
  return { ...record, run };
}
async function readUsers(tx, ids) {
  await lockEconomyUsers(tx, ids);
  return new Map((await tx.user.findMany({ where: { id: { in: [...new Set(ids)] } } })).map(user => [user.id, user]));
}
function validate(record, users) {
  const state = flat(record);
  if (!isDeepStrictEqual(normalizeResultState(state, record.run, users), state)) throw Error('Noncanonical result state requires review');
  return state;
}
async function saveViewers(tx, record, state, users) {
  const claims = resultViewers(state), ids = claims.map(p => p.userId);
  for (const claim of claims) assertActiveAccount(users.get(claim.userId));
  if (await tx.activeResultViewer.findFirst({ where: { userId: { in: ids }, gameRunId: { not: record.gameRunId } } }))
    throw new ResultMembershipConflict('User already views another result');
  if (await tx.activeGamePlayer.findFirst({ where: { userId: { in: ids }, gameRunId: { not: record.gameRunId } } }))
    throw new ResultMembershipConflict('Result viewer belongs to another game');
  const rooms = await tx.activeRoomMember.findMany({ where: { userId: { in: ids } } });
  for (const seat of rooms) {
    if (seat.roomId !== record.run.roomId || seat.role !== 'SPECTATOR' || !state.spectators.some(p => p.userId === seat.userId))
      throw new ResultMembershipConflict('Result viewer belongs to another room');
  }
  await tx.activeResultViewer.deleteMany({ where: { gameRunId: record.gameRunId } });
  if (claims.length) await tx.activeResultViewer.createMany({ data: claims.map(p => ({ ...p, gameRunId: record.gameRunId })) });
}
async function save(tx, record, state, users, notices = []) {
  await saveViewers(tx, record, state, users);
  const saved = await tx.gameResultRecord.update({ where: { gameRunId: record.gameRunId }, data: {
    ...splitResultState(state), revision: { increment: 1 }
  } });
  for (const notice of notices) await appendSessionNotice(tx, { ...notice, effectKey: `game:${record.gameRunId}:expired` });
  return saved;
}

// Call in the terminal checkpoint transaction. The deadline comes from its
// accepted end time, never from a later publish, settlement retry or restart.
export function createResultRecord(gameRunId, transaction = null, owner = gameplayOwner()) {
  if (!validId(gameRunId)) throw Error('Invalid result game identity');
  return inGameplayTransaction(owner, transaction, async tx => {
    const source = await tx.gameRun.findUniqueOrThrow({ where: { id: gameRunId }, select: { roomId: true } });
    const room = source.roomId ? await lockRoomRecord(tx, source.roomId) : null;
    const run = await lockGame(tx, gameRunId);
    const existing = await tx.gameResultRecord.findUnique({ where: { gameRunId } });
    if (existing) {
      if (existing.stateVersion !== RESULT_STATE_VERSION) throw Error('Unsupported result record');
      validate({ ...existing, run }, await readUsers(tx, idsIn(existing.state)));
      return existing;
    }
    if (!run.checkpoint?.engine?.gameOver || !await tx.gameSettlementJob.findUnique({ where: { key: run.key } }))
      throw Error('Result requires a committed terminal checkpoint and settlement intent');
    if (room && (room.state.gameId !== run.id || room.status !== 'PLAYING')) throw Error('Result room membership cannot be inferred; review required');
    const spectatorIds = room?.status === 'PLAYING' && room.state.gameId === run.id ? room.state.spectators.map(p => p.userId) : [];
    const users = await readUsers(tx, [run.redPlayerId, run.blackPlayerId, ...spectatorIds]);
    const state = initialResultState(run, users, room);
    const record = await tx.gameResultRecord.create({ data: { gameRunId, ...splitResultState(state) } });
    await saveViewers(tx, { ...record, run }, state, users);
    if (room?.status === 'PLAYING') {
      // The result becomes the sole owner of spectator membership in this same
      // commit. Closing a finished room never emits a missing-human notice.
      await tx.roomRecord.update({ where: { id: room.id }, data: { status: 'CLOSED', revision: { increment: 1 } } });
      await tx.activeRoomMember.deleteMany({ where: { roomId: room.id } });
    }
    return record;
  });
}

export function commitResultCommand({ gameRunId, expectedRevision, action, command = null, now = null, guard = () => true }, transaction = null, owner = gameplayOwner()) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !action ||
      (command && (!validId(command.userId) || command.userId !== action.userId || typeof command.key !== 'string' || !command.key || command.key.length > 80))) throw Error('Invalid result command');
  const rematchKey = randomUUID();
  return inGameplayTransaction(owner, transaction, async tx => {
    const record = await lockResultRecord(tx, gameRunId);
    if (command) {
      const prior = await tx.gameResultCommandReceipt.findUnique({ where: { gameRunId_userId_key: { gameRunId, userId: command.userId, key: command.key } } });
      if (prior) {
        if (!isDeepStrictEqual(prior.payload, action)) throw Error('Result command identity conflict');
        return { result: stored(record), duplicate: true, commandRevision: prior.revision };
      }
    }
    if (record.revision !== expectedRevision) throw new ResultRevisionConflict('Result changed; reload its accepted state');
    const users = await readUsers(tx, idsIn(record.state));
    if (!guard()) throw Error('Result context changed');
    const before = validate(record, users);
    const changed = transitionResult(before, action, { run: record.run, users, now: now ?? Date.now(), rematchKey });
    const saved = isDeepStrictEqual(before, changed.state) ? stored(record) : await save(tx, record, changed.state, users, changed.notices);
    if (command) await tx.gameResultCommandReceipt.create({ data: { gameRunId, userId: command.userId, key: command.key, payload: action, revision: saved.revision } });
    return { result: saved, duplicate: false, commandRevision: saved.revision };
  });
}

export function readResultRecord(gameRunId, owner = gameplayOwner(), extraUserIds = []) {
  return inGameplayTransaction(owner, null, async tx => {
    const record = await lockResultRecord(tx, gameRunId);
    const users = await tx.user.findMany({ where: { id: { in: [...new Set([...idsIn(record.state), ...extraUserIds])] } },
      include: { sessionNotices: { orderBy: { sequence: 'desc' }, take: 1 } } });
    validate(record, new Map(users.map(user => [user.id, user])));
    const child = record.state.rematch?.gameId ? await tx.gameRun.findUnique({ where: { id: record.state.rematch.gameId } }) : null;
    if (record.status === 'REMATCHED' && (!child || child.resultSourceId !== gameRunId || child.key !== record.state.rematch.key || child.status === 'ABORTED')) throw Error('Rematch association requires review');
    return { record: stored(record), run: record.run, users, child };
  });
}

export function listResultRecords(owner = gameplayOwner()) {
  return inGameplayTransaction(owner, null, tx => tx.gameResultRecord.findMany({
    where: { status: { not: 'CLOSED' } }, orderBy: { gameRunId: 'asc' }, select: { gameRunId: true }
  }));
}

export function assertResultRematch(record, input, players) {
  const users = new Map(players.map(p => [p.id, p]));
  const state = record.state;
  if (record.status !== 'STARTING' || state.rematch?.key !== input.key || Date.now() >= state.deadline ||
      input.redPlayerId !== record.run.blackPlayerId || input.blackPlayerId !== record.run.redPlayerId || input.buyIn !== 0 ||
      input.mode !== record.run.mode || input.turnTime !== record.run.turnTime || input.origin !== record.run.origin ||
      !state.players.every(p => users.get(p.userId)?.isBot || (p.viewing && p.requested))) throw Error('Game does not match accepted rematch consent');
}

// Called by creation with parent result -> child game -> accounts locked.
export async function installResultRematch(tx, record, child) {
  const users = await readUsers(tx, idsIn(record.state));
  const state = validate(record, users);
  const expected = state.players.filter(p => p.viewing).map(p => p.userId).sort((a,b) => a-b);
  const claims = await tx.activeResultViewer.findMany({ where: { gameRunId: record.gameRunId, role: 'PLAYER' } });
  if (!isDeepStrictEqual(expected, claims.map(p => p.userId).sort((a,b) => a-b))) throw Error('Result player claims do not match rematch');
  state.status = 'REMATCHED'; state.rematch.gameId = child.id;
  for (const p of state.players) { p.viewing = false; p.requested = !!users.get(p.userId).isBot; }
  await save(tx, record, normalizeResultState(state, record.run, users), users);
}

export function reserveResultRematch(gameRunId, transaction = null, owner = gameplayOwner()) {
  return inGameplayTransaction(owner, transaction, async tx => {
    const record = await lockResultRecord(tx, gameRunId);
    if (record.status === 'REMATCHED') {
      const child = await tx.gameRun.findUniqueOrThrow({ where: { key: record.state.rematch.key } });
      if (child.id !== record.state.rematch.gameId || child.resultSourceId !== gameRunId) throw Error('Rematch association requires review');
      return child;
    }
    if (record.status !== 'STARTING') throw Error('Rematch is not ready');
    return createGameRun({ key: record.state.rematch.key, resultSourceId: gameRunId,
      redPlayerId: record.run.blackPlayerId, blackPlayerId: record.run.redPlayerId,
      mode: record.run.mode, buyIn: 0, turnTime: record.run.turnTime, origin: record.run.origin }, tx, owner);
  });
}

export async function restoreAbortedResult(tx, record, child, now = Date.now()) {
  if (record.status !== 'REMATCHED' || record.state.rematch?.gameId !== child.id || record.state.rematch.key !== child.key)
    throw Error('Aborted game does not match its result');
  const users = await readUsers(tx, idsIn(record.state));
  const reopened = resultAfterCancelledRematch(validate(record, users), record.run, users);
  const expired = transitionResult(reopened, { type: 'expire' }, { run: record.run, users, now });
  await save(tx, record, expired.state, users, expired.notices);
}

export function cancelResultRematch(gameRunId, transaction = null, owner = gameplayOwner(), { now = Date.now(), guard = () => true } = {}) {
  return inGameplayTransaction(owner, transaction, async tx => {
    const record = await lockResultRecord(tx, gameRunId);
    if (!['STARTING', 'REMATCHED'].includes(record.status) || !guard()) return stored(record);
    const child = await tx.gameRun.findUnique({ where: { key: record.state.rematch.key } });
    if (child) {
      if (child.resultSourceId !== gameRunId || record.state.rematch.gameId !== child.id) throw Error('Rematch association requires review');
      const aborted = await abortGameStart(child.key, tx, owner, { guard, now });
      if (!aborted) return stored(record);
      return tx.gameResultRecord.findUnique({ where: { gameRunId } });
    }
    const users = await readUsers(tx, idsIn(record.state));
    if (!guard()) return stored(record);
    const reopened = resultAfterCancelledRematch(validate(record, users), record.run, users);
    const expired = transitionResult(reopened, { type: 'expire' }, { run: record.run, users, now });
    return save(tx, record, expired.state, users, expired.notices);
  });
}
