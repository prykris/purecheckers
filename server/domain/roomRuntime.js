import QRCode from 'qrcode';
import { SITE_URL } from '../config.js';
import { inGameplayTransaction, gameplayOwner } from '../services/gameplayOwnership.js';
import { runGameplayWork, retryGameplayRecovery } from '../services/gameplayWork.js';
import { commitRoomRecord, createRoomRecord, readRoomCreation, assertRoomCreationIdentity } from '../services/roomRecords.js';
import { getSession, getOrCreateSession, setPhase, forceIdle, applySessionNotice } from './sessions.js';
import { latestNoticeQuery } from '../services/sessionNotices.js';
import { publishUser } from './events.js';

// Runtime projections contain current identity/presentation data; only the
// repository changes accepted membership, readiness and start identity.
export async function readRoomRecord(id, owner = gameplayOwner()) {
  return inGameplayTransaction(owner, null, tx => tx.roomRecord.findUnique({ where: { id: BigInt(id) } }));
}

export async function projectRoomRecord(record, prior = null, owner = gameplayOwner()) {
  const ids = [...record.state.players, ...record.state.spectators, ...(prior?.players || []), ...(prior?.spectators || [])].map(p => p.userId);
  const users = await inGameplayTransaction(owner, null, tx => tx.user.findMany({ where: { id: { in: ids } }, include: { sessionNotices: latestNoticeQuery } }));
  const byId = new Map(users.map(user => [user.id, user]));
  let qrDataUrl = prior?.joinCode === record.joinCode ? prior.qrDataUrl : null;
  if (!prior || prior.joinCode !== record.joinCode) {
    try { qrDataUrl = await QRCode.toDataURL(`${SITE_URL}/invite/${record.joinCode}`, { width: 200, margin: 1 }); } catch {}
  }
  const member = p => {
    const user = byId.get(p.userId);
    if (!user) throw Error('Room member account is missing');
    return { ...p, username: user.username, elo: user.elo, isGuest: !!user.isGuest, isBot: !!user.isBot };
  };
  return { ...prior, ...structuredClone(record.state), record, owner, qrDataUrl,
    notices: users.map(user => ({ userId: user.id, record: user.sessionNotices[0] })),
    id: Number(record.id), revision: record.revision, joinCode: record.joinCode,
    createdAt: record.createdAt.getTime(), status: record.status.toLowerCase(),
    players: record.state.players.map(member), spectators: record.state.spectators.map(member),
    hostName: byId.get(record.state.hostId)?.username || 'Host' };
}

export function applyRoomSessions(room, previousMembers = []) {
  for (const notice of room.notices || []) applySessionNotice(notice.userId, notice.record);
  const live = room.status !== 'closed';
  const members = live ? [...room.players, ...room.spectators] : [];
  for (const before of previousMembers) {
    if (members.some(p => p.userId === before.userId)) continue;
    const session = getSession(before.userId);
    if (room.status === 'closed' && session?.spectatingGameId && session.spectatingGameId === room.gameId) continue;
    if (session?.roomId !== room.id && session?.spectatingRoomId !== room.id) continue;
    forceIdle(before.userId); publishUser(before.userId);
  }
  for (const player of members) {
    if (player.isBot) continue;
    const session = getOrCreateSession(player.userId, player.username, player.isGuest);
    const spectator = room.spectators.some(p => p.userId === player.userId);
    if (spectator) {
      if (session.phase === 'idle' || (session.phase === 'spectating' && session.spectatingRoomId === room.id)) {
        setPhase(player.userId, 'spectating', { spectatingRoomId: room.id, spectatingGameId: room.gameId });
      }
    } else if (['waiting', 'starting'].includes(room.status) && ['idle', 'matchmaking'].includes(session.phase)) {
      setPhase(player.userId, 'in-room', { roomId: room.id });
    }
  }
}

export function queueRoomWork(room, publish, action) {
  const previous = room.changes || Promise.resolve();
  const task = runGameplayWork(async work => {
    await previous.catch(() => {}); work.assertCurrent();
    if (room.runtimeStopped) throw Error('Room runtime stopped');
    room.pending = true; publish(room);
    try { return await action(work); }
    finally { room.pending = false; if (!room.runtimeStopped) publish(room); }
  });
  room.changes = task.catch(() => {});
  return task;
}

export async function acceptRoomRecord(room, record, work, options = {}) {
  if (record.revision < room.revision) return room;
  const projected = await projectRoomRecord(record, room, work.owner);
  work.assertCurrent();
  if (room.runtimeStopped) throw Error('Room runtime stopped');
  if (record.revision < room.revision) return room;
  const previous = [...room.players, ...room.spectators];
  Object.assign(room, projected);
  applyRoomSessions(room, previous, options);
  return room;
}

export async function writeRoomRecord(room, work, reduce, { command = null, guard = () => true, removedReason = null, removedUserId = null, ...options } = {}) {
  work.assertCurrent();
  const input = { roomId: room.id, expectedRevision: room.revision, command,
    departure: removedUserId === null ? null : { userId: removedUserId, reason: removedReason } };
  const apply = draft => { work.assertCurrent(); if (!guard()) throw Error('Room context changed'); reduce(draft); };
  let saved;
  try { saved = await commitRoomRecord(input, apply, null, work.owner); }
  catch (error) {
    // Retrying the same receipt identity confirms a lost commit response. System
    // transitions without a receipt refresh state but never rerun their reducer.
    if (command) {
      try { saved = await commitRoomRecord(input, () => { throw error; }, null, work.owner); } catch {}
    }
    if (!saved) {
      const latest = await readRoomRecord(room.id, work.owner);
      if (latest && work.isCurrent()) await acceptRoomRecord(room, latest, work, options);
      throw error;
    }
  }
  return acceptRoomRecord(room, saved.room, work, options);
}

export async function persistNewRoom(input, work, presentation, guard = () => {}) {
  let record;
  try { record = await createRoomRecord(input, null, work.owner, guard); }
  catch (error) {
    try { record = await createRoomRecord(input, null, work.owner, guard); }
    catch {
      record = await retryGameplayRecovery(work, () => readRoomCreation(input.creatorId, input.key, work.owner));
      if (!record) throw error;
      assertRoomCreationIdentity(record, input);
    }
  }
  const room = await retryGameplayRecovery(work, () => projectRoomRecord(record, presentation, work.owner));
  work.assertCurrent();
  return room;
}
