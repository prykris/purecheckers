import { isDeepStrictEqual } from 'node:util';
import { JOIN_CODE_PATTERN } from '../../shared/rooms.js';
import { ROOM_STATE_VERSION, normalizeRoomState, assertRoomTransition, roomClaims, splitRoomState, roomAfterAbortedStart } from '../domain/roomState.js';
import { gameplayOwner, inGameplayTransaction } from './gameplayOwnership.js';
import { lockEconomyUsers } from './economy.js';
import { assertActiveAccount } from './accounts.js';
import { appendSessionNotice } from './sessionNotices.js';
import { roomDepartureNotices } from '../domain/roomRules.js';
import { MAX_INCOMING_CHALLENGES } from '../../shared/challenges.js';

export class RoomRevisionConflict extends Error {}
export class RoomMembershipConflict extends Error {}
const validKey = key => typeof key === 'string' && key.length > 0 && key.length <= 100;
const idsIn = state => [...state.players, ...state.spectators].map(p => p.userId);
function creationIntent({ creatorId, settings, origin = 'room', players = [{ userId: creatorId, ready: false, online: true }], challenge }) {
  return { settings, origin, players, ...(challenge ? { challenge } : {}) };
}
export function assertRoomCreationIdentity(record, input) {
  if (!isDeepStrictEqual(record.creation, creationIntent(input))) throw Error('Room creation identity conflict');
}
export function roomRecordId(value) {
  if (typeof value === 'bigint' && value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) return value;
  if (Number.isSafeInteger(value) && value > 0) return BigInt(value);
  throw Error('Invalid room identity');
}
export async function lockRoomRecord(tx, id) {
  id = roomRecordId(id);
  await tx.$queryRaw`SELECT id FROM "RoomRecord" WHERE id = ${id} FOR UPDATE`;
  const room = await tx.roomRecord.findUnique({ where: { id } });
  if (!room || room.stateVersion !== ROOM_STATE_VERSION) throw Error('Missing or unsupported room record');
  return room;
}
async function readUsers(tx, ids) {
  await lockEconomyUsers(tx, ids);
  return new Map((await tx.user.findMany({ where: { id: { in: [...new Set(ids)] } } })).map(user => [user.id, user]));
}
async function saveClaims(tx, room, state, users, before = null) {
  const claims = roomClaims(state, users);
  for (const claim of claims) {
    const user = users.get(claim.userId); assertActiveAccount(user);
    const joining = !before?.players.some(p => p.userId === claim.userId);
    if (claim.role === 'PLAYER' && joining && state.settings.buyIn > 0 && (user.isGuest || user.coins < state.settings.buyIn)) throw Error('Player cannot join this wager room');
  }
  const humans = claims.map(c => c.userId);
  const occupied = await tx.activeRoomMember.findFirst({ where: { userId: { in: humans }, roomId: { not: room.id } } });
  if (occupied) throw new RoomMembershipConflict('User already belongs to another room');
  if (await tx.activeGamePlayer.findFirst({ where: { userId: { in: humans } } })) throw new RoomMembershipConflict('User already belongs to an unfinished game');
  const results = await tx.activeResultViewer.findMany({ where: { userId: { in: humans } } });
  if (results.some(view => state.status !== 'PLAYING' || view.gameRunId !== state.gameId || view.role !== 'SPECTATOR' ||
      !state.spectators.some(p => p.userId === view.userId))) throw new RoomMembershipConflict('User must leave the finished result before joining a room');
  await tx.activeRoomMember.deleteMany({ where: { roomId: room.id } });
  if (claims.length) await tx.activeRoomMember.createMany({ data: claims.map(c => ({ ...c, roomId: room.id })) });
}

// Creation identity excludes the allocated invitation code. Retrying after a
// lost response returns the original room/code, even if the caller generated a new one.
export function readRoomCreation(creatorId, key, owner = gameplayOwner()) {
  if (!Number.isSafeInteger(creatorId) || creatorId <= 0 || !validKey(key)) throw Error('Invalid room creation identity');
  return inGameplayTransaction(owner, null, async tx => {
    // A disconnected driver's transaction may still be completing. A plain
    // unlocked read could incorrectly report that its room was never created.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'room-create:' + creatorId + ':' + key}, 0))`;
    return tx.roomRecord.findUnique({ where: { creatorId_creationKey: { creatorId, creationKey: key } } });
  });
}

export function createRoomRecord({ creatorId, key, joinCode, settings, origin = 'room', players = [{ userId: creatorId, ready: false, online: true }], challenge }, transaction = null, owner = gameplayOwner(), guard = () => {}) {
  if (!Number.isSafeInteger(creatorId) || creatorId <= 0 || !validKey(key) || !JOIN_CODE_PATTERN.test(joinCode)) throw Error('Invalid room creation');
  const creation = creationIntent({ creatorId, settings, origin, players, challenge });
  return inGameplayTransaction(owner, transaction, async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'room-create:' + creatorId + ':' + key}, 0))`;
    const previous = await tx.roomRecord.findUnique({ where: { creatorId_creationKey: { creatorId, creationKey: key } } });
    if (previous) {
      assertRoomCreationIdentity(previous, { creatorId, settings, origin, players, challenge });
      return previous;
    }
    // Confirm an existing receipt even after disconnect, but never create a new
    // room for an obsolete command that waited on database/account locks.
    guard();
    const users = await readUsers(tx, [...players.map(p => p.userId), ...(challenge ? [challenge.userId] : [])]);
    guard();
    assertActiveAccount(users.get(creatorId));
    if (challenge) {
      const target = users.get(challenge.userId);
      assertActiveAccount(target);
      if (target.isBot || target.isGuest || !target.profilePublic || target.id === creatorId) throw Error('Player cannot receive a challenge');
      // Ordered account locks serialize senders to this recipient. The target is
      // not given a membership claim until their normal room:join commits.
      const incoming = await tx.roomRecord.findMany({ where: { status: 'WAITING', state: { path: ['challenge', 'userId'], equals: target.id } }, select: { state: true } });
      if (incoming.filter(row => row.state.players.length === 1 && row.state.challenge.expiresAt > Date.now()).length >= MAX_INCOMING_CHALLENGES) throw Error('Player has too many pending challenges');
    }
    const state = normalizeRoomState({ status: 'WAITING', hostId: creatorId, settings, origin, players, spectators: [], ...(challenge ? { challenge } : {}) }, users);
    const room = await tx.roomRecord.create({ data: { creatorId, creationKey: key, creation, joinCode, ...splitRoomState(state) } });
    roomRecordId(room.id); // do not expose an unsafe numeric ID to existing routes
    await saveClaims(tx, room, state, users);
    guard();
    return room;
  });
}

export function commitRoomRecord({ roomId, expectedRevision, command = null, departure = null }, reduce, transaction = null, owner = gameplayOwner()) {
  roomId = roomRecordId(roomId);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
      (command && (!Number.isSafeInteger(command.userId) || command.userId <= 0 || !validKey(command.key) || !command.payload))) throw Error('Invalid room command');
  return inGameplayTransaction(owner, transaction, async tx => {
    const room = await lockRoomRecord(tx, roomId);
    if (command) {
      const receipt = await tx.roomCommandReceipt.findUnique({ where: { roomId_userId_key: { roomId, userId: command.userId, key: command.key } } });
      if (receipt) {
        if (!isDeepStrictEqual(receipt.payload, command.payload)) throw Error('Room command identity conflict');
        return { room, duplicate: true, commandRevision: receipt.revision };
      }
    }
    if (room.revision !== expectedRevision) throw new RoomRevisionConflict('Room changed; reload its accepted state');
    const before = { status: room.status, ...structuredClone(room.state) };
    const draft = structuredClone(before);
    const result = reduce(draft);
    if (result && typeof result.then === 'function') throw Error('Room transitions must be synchronous');
    // Room -> game identity -> ordered accounts is shared with game creation.
    const keys = [...new Set([before.startAttempt?.key, draft.startAttempt?.key].filter(Boolean))].sort();
    for (const key of keys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'game-settlement:' + key}, 0))`;
    const users = await readUsers(tx, [...idsIn(before), ...idsIn(draft)]);
    if (!isDeepStrictEqual(normalizeRoomState(before, users), before)) throw Error('Noncanonical room state requires review');
    const next = normalizeRoomState(draft, users);
    const key = before.startAttempt?.key ?? next.startAttempt?.key;
    const run = key ? await tx.gameRun.findUnique({ where: { key } }) : null;
    assertRoomTransition(before, next, { users, run, roomId, command });
    if (command && ![...idsIn(before), ...idsIn(next)].includes(command.userId) &&
        !(command.payload.type === 'challenge:decline' && command.userId === before.challenge?.userId && before.status === 'WAITING' && before.players.length === 1 && next.status === 'CLOSED')) throw Error('Room command actor is not a member');
    await saveClaims(tx, room, next, users, before);
    const saved = await tx.roomRecord.update({ where: { id: roomId }, data: { ...splitRoomState(next), revision: { increment: 1 } } });
    for (const notice of roomDepartureNotices(before, next, users, departure)) {
      await appendSessionNotice(tx, { ...notice, effectKey: `room:${roomId}:${saved.revision}`, context: { roomId: Number(roomId) } });
    }
    if (command) await tx.roomCommandReceipt.create({ data: { roomId, userId: command.userId, key: command.key, payload: command.payload, revision: saved.revision } });
    return { room: saved, duplicate: false, commandRevision: saved.revision };
  });
}

// Called by game creation while its room row, game identity and accounts are
// locked. The room owns the chosen colours; a stale start cannot choose again.
export function assertRoomGameStart(room, input, players) {
  if (room.status !== 'STARTING' || room.state.startAttempt?.key !== input.key ||
      !isDeepStrictEqual(room.state.startAttempt.players, [input.redPlayerId, input.blackPlayerId]) ||
      room.state.settings.buyIn !== input.buyIn || room.state.settings.turnTimer !== input.turnTime ||
      (players.some(p => p.isBot || p.isGuest) ? 'FRIENDLY' : 'RANKED') !== input.mode ||
      (players.some(p => p.isBot) ? 'bot' : room.state.origin) !== input.origin) throw Error('Game does not match the accepted room start');
}

export async function installRoomGame(tx, room, run, humans) {
  const seats = await tx.activeRoomMember.findMany({ where: { roomId: room.id, role: 'PLAYER' } });
  if (!isDeepStrictEqual(seats.map(s => s.userId).sort((a,b) => a-b), [...humans].sort((a,b) => a-b))) throw Error('Room player claims do not match the game');
  await tx.roomRecord.update({ where: { id: room.id }, data: {
    status: 'PLAYING', state: { ...room.state, gameId: run.id }, revision: { increment: 1 }
  } });
  await tx.activeRoomMember.deleteMany({ where: { roomId: room.id, role: 'PLAYER' } });
}

export async function restoreAbortedRoom(tx, room, run) {
  if (room.status !== 'PLAYING' || room.state.gameId !== run.id || room.state.startAttempt?.key !== run.key) throw Error('Aborted game does not match its room');
  const players = await tx.user.findMany({ where: { id: { in: [run.redPlayerId, run.blackPlayerId] } } });
  await tx.roomRecord.update({ where: { id: room.id }, data: {
    status: 'WAITING', state: roomAfterAbortedStart(room.state, players), revision: { increment: 1 }
  } });
  await tx.activeRoomMember.createMany({ data: players.filter(p => !p.isBot).map(p => ({ roomId: room.id, userId: p.id, role: 'PLAYER' })) });
}
