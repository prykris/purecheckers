import { leaveResult } from './resultRuntime.js';
import { randomInt, randomUUID } from 'node:crypto';
import { abortGameStart } from '../services/gameRuns.js';
import { inGameplayTransaction } from '../services/gameplayOwnership.js';
import { gameplayActions, runGameplayWork, stopGameplayWork, retryGameplayRecovery } from '../services/gameplayWork.js';
import { canInviteToRoom } from '../../shared/roomInvitations.js';
import { JOIN_CODE_PATTERN, validRoomSettings, sameRoomSettings } from '../../shared/rooms.js';
import prisma from '../db.js';
import { roomQrCode } from '../services/roomQr.js';
import { reject } from './sessionCommands.js';
import { resetReadiness, removeMember, canStartRoom, isRoomPlayerReady, canAddRoomBot, canEditRoomSettings } from './roomRules.js';
import { publishUser, broadcast } from './events.js';
import { createGameDirect, activeGames } from './games.js';
import { queueRoomWork, writeRoomRecord, persistNewRoom, readRoomRecord, acceptRoomRecord, projectRoomRecord, applyRoomSessions } from './roomRuntime.js';
import { quickPlayPool } from '../services/quickPlay.js';
import { getBotUser } from '../services/botPlayer.js';
import { TURN_TIME } from '../../shared/constants.js';
import { SITE_URL } from '../config.js';
import { getSession, setPhase, forceIdle } from './sessions.js';
import { enqueueSessionWork } from './sessionWork.js';
import { CHALLENGE_TTL_MS, MAX_INCOMING_CHALLENGES, pendingChallenge, pendingRoomInvites } from '../../shared/challenges.js';
import { suggestRoomFriendship } from '../../shared/roomFriendship.js';

// Join codes: six upper-case letters or digits 2-9 (the generator also avoids I and O). Shared with the invite API.
export { JOIN_CODE_PATTERN };

export const gameRooms = new Map();
let listRevision = 0;
function publishListChange(room) { broadcast('room:list-update', { room, revision: ++listRevision }); }
export function removeRoomListing(room) {
  gameRooms.delete(room.id);
  if (room.challenge) publishUser(room.challenge.userId);
  for (const invite of room.invites ?? []) publishUser(invite.userId);
  if (!room.challenge) publishListChange({ id: room.id, closed: true });
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join(''); }
  while (findRoomByCode(code));
  return code;
}
export function findRoomByCode(code) { return [...gameRooms.values()].find(room => room.joinCode === code) || null; }

function playerRecord(user, ready = false) {
  return { userId: user.id, username: user.username, elo: user.elo, isGuest: !!user.isGuest, isBot: !!user.isBot, ready: !!user.isBot || ready, online: true };
}
// origin names the door that opened the room ('bot' | 'quickplay' | 'room'); the game inherits it.
async function newRoom(players, settings, origin, work, key = randomUUID(), guard = () => {}, challenge) {
  const joinCode = genCode();
  let qrDataUrl = null;
  try { qrDataUrl = await roomQrCode(joinCode); } catch {}
  work.assertCurrent(); guard();
  const room = await persistNewRoom({ creatorId: players[0].userId, key, joinCode,
    settings: { autoReady: false, ...settings }, origin, ...(challenge ? { challenge } : {}),
    players: players.map(p => ({ userId: p.userId, ready: p.ready, online: true })) }, work, { joinCode, qrDataUrl }, guard);
  const installed = gameRooms.get(room.id);
  return installed || room;
}
function currentActor(actor, phase, work) {
  work?.assertCurrent();
  const session = getSession(actor.userId);
  if (session?.connectionId !== actor.connectionId || session.phase !== phase) reject('Your session changed. Please try again.');
  return session;
}
function memberRoom(actor, roomId, work) {
  const session = currentActor(actor, 'in-room', work);
  const room = gameRooms.get(roomId);
  if (!room || session.roomId !== roomId) reject('Not in this room');
  return room;
}
export function removeFinishedRoomProjection(record) {
  const room = record ? gameRooms.get(Number(record.id)) : null;
  if (!room) return;
  room.status = 'closed'; room.record = record; room.revision = record.revision;
  clearTimeout(room.expiryTimer); clearTimeout(room.presenceRetryTimer); clearTimeout(room.startRetryTimer);
  removeRoomListing(room);
}
function waitingRoom(actor, roomId, work) {
  const room = memberRoom(actor, roomId, work);
  if (room.status !== 'waiting') reject('Game is starting or already active');
  return room;
}
export function installRoom(room, work) {
  work.assertCurrent();
  if (room.status === 'closed') return;
  gameRooms.set(room.id, room);
  applyRoomSessions(room);
  broadcastRoomUpdate(room);
}

export function sanitizeRoom(room) {
  const result = {
    id: room.id,
    revision: room.revision,
    ...(room.challenge ? { challenge: room.challenge } : {}),
    invites: pendingRoomInvites(room),
    hostId: room.hostId,
    hostName: room.hostName,
    joinCode: room.joinCode,
    settings: {
      buyIn: room.settings.buyIn,
      turnTimer: room.settings.turnTimer,
      isPrivate: room.settings.isPrivate,
      allowSpectators: room.settings.allowSpectators,
      autoReady: !!room.settings.autoReady,
    },
    autoReady: !!room.settings.autoReady,
    players: room.players.map(p => ({ userId: p.userId, username: p.username, elo: p.elo, ready: isRoomPlayerReady(room, p), online: p.online !== false, isGuest: p.isGuest || false, isBot: p.isBot || false })),
    spectators: room.spectators.filter(s => s.online !== false).map(s => ({ userId: s.userId, username: s.username })),
    status: room.pending ? room.status === 'starting' ? 'starting' : 'updating' : room.status,
    gameId: room.gameId || null,
    createdAt: room.createdAt,
    qrDataUrl: room.qrDataUrl || null,
    effectiveMode: room.players.some(p => p.isGuest || p.isBot) ? 'FRIENDLY' : 'RANKED',
    readyToStart: !room.pending && canStartRoom(room),
    canAddBot: !room.pending && canAddRoomBot(room),
    canEditSettings: !room.pending && canEditRoomSettings(room),
    suggestFriendship: suggestRoomFriendship(room),
  };
  result.joinUrl = `${SITE_URL}/join/${room.joinCode}`; // SSR preview page; the app route is /invite/CODE
  return result;
}

// The directory describes rooms; invitation credentials belong only to members.
export function roomListing(room) {
  const { id, hostId, hostName, settings, players, spectators, status, gameId, createdAt } = sanitizeRoom(room);
  return { id, hostId, hostName, settings, players, spectators, status, gameId, createdAt };
}

export function broadcastRoomUpdate(room) {
  if (room.runtimeStopped) return;
  if (room.status === 'closed') { if (gameRooms.get(room.id) === room) removeRoomListing(room); return; }
  armRoomExpiry(room);
  // Targeted profile invitations remain unlisted; ordinary private rooms are locked listings.
  if (!room.challenge) publishListChange(roomListing(room));
  for (const member of [...room.players, ...room.spectators]) publishUser(member.userId);
  if (room.challenge) publishUser(room.challenge.userId);
  for (const invite of room.invites ?? []) publishUser(invite.userId);
}

export function createRoomActions(actor) {
  const receipt = request => request ? { userId: actor.userId, key: request.id, payload: { type: request.type, data: request.data || {} } } : null;
  const mutate = (room, request, reduce, guard = () => true, options = {}) => queueRoomWork(room, broadcastRoomUpdate,
    work => writeRoomRecord(room, work, reduce, { command: receipt(request), guard, ...options }));
  return gameplayActions({
    async 'challenge:send'({ userId }, request, work) {
      if (!Number.isSafeInteger(userId) || userId <= 0 || userId === actor.userId) reject('Choose another player to challenge');
      const target = await prisma.user.findUnique({ where: { id: userId } });
      currentActor(actor, 'idle', work);
      if (!target || target.isBot || target.isGuest || !target.profilePublic) reject('This player cannot receive challenges');
      const host = await prisma.user.findUnique({ where: { id: actor.userId } });
      currentActor(actor, 'idle', work);
      const room = await newRoom([playerRecord(host)], { buyIn: 0, turnTimer: TURN_TIME,
        isPrivate: true, allowSpectators: false, autoReady: false }, 'room', work, request?.id,
      () => currentActor(actor, 'idle', work), { userId, expiresAt: (request?.createdAt ?? Date.now()) + CHALLENGE_TTL_MS });
      installRoom(room, work);
      await reconcileRoomPresence(room);
    },
    async 'room:invite'({ roomId, userId }, request) {
      if (!Number.isSafeInteger(userId) || userId <= 0 || userId === actor.userId) reject('Choose a friend to invite');
      const room = waitingRoom(actor, roomId);
      await mutate(room, request, draft => {
        if (!canInviteToRoom(draft, actor.userId)) reject('Only the host of an open room can invite players');
        const now = Date.now();
        draft.invites = (draft.invites ?? []).filter(i => i.expiresAt > now);
        if (draft.invites.some(i => i.userId === userId)) return;
        if (draft.invites.length >= MAX_INCOMING_CHALLENGES) reject('Wait for an invitation to expire before inviting more friends');
        draft.invites.push({ userId, expiresAt: now + CHALLENGE_TTL_MS });
      }, () => getSession(actor.userId)?.connectionId === actor.connectionId && getSession(actor.userId)?.roomId === room.id);
    },
    async 'room:invite-decline'({ roomId }, request) {
      const room = gameRooms.get(roomId);
      if (!room) reject('Invitation is no longer available');
      await mutate(room, request, draft => {
        if (!draft.invites?.some(i => i.userId === actor.userId)) reject('Invitation is no longer available');
        draft.invites = draft.invites.filter(i => i.userId !== actor.userId);
      }, () => getSession(actor.userId)?.connectionId === actor.connectionId);
    },
    async 'challenge:decline'({ roomId }, request) {
      const room = gameRooms.get(roomId);
      if (!room || room.challenge?.userId !== actor.userId) reject('Invitation is no longer available');
      await mutate(room, request, draft => {
        if (draft.status !== 'WAITING' || draft.players.length !== 1) reject('Invitation is no longer available');
        draft.status = 'CLOSED';
      }, () => getSession(actor.userId)?.connectionId === actor.connectionId, { removedUserId: room.hostId, removedReason: 'challenge-declined' });
    },
    // autoReady (scan-to-play): the game starts inside the friend's join, no ready dance.
    // A wager needs explicit consent from both sides, so it cannot be combined with autoReady.
    async 'room:create'({ buyIn = 0, turnTimer = TURN_TIME, isPrivate = false, allowSpectators = true, autoReady = false }, request, work) {
      if (autoReady && buyIn > 0) reject('An auto-start room cannot have a buy-in');
      if (!validRoomSettings({ buyIn, turnTimer, isPrivate, allowSpectators, autoReady })) reject('Invalid room settings');
      const host = await prisma.user.findUnique({ where: { id: actor.userId } });
      currentActor(actor, 'idle', work);
      if (!host || host.coins < buyIn) reject('Cannot afford buy-in');
      if (host.isGuest && buyIn > 0) reject('Wagers require registered players');
      const room = await newRoom([playerRecord(host)], { buyIn, turnTimer, isPrivate, allowSpectators, autoReady }, 'room', work, request?.id,
        () => currentActor(actor, 'idle', work));
      installRoom(room, work);
      await reconcileRoomPresence(room);
    },
    'room:list'() { return { rooms: [...gameRooms.values()].filter(room => !room.challenge).map(roomListing), revision: listRevision }; },
    async 'room:settings'({ roomId, settings, expectedRevision }, request) {
      const room = waitingRoom(actor, roomId);
      if (room.hostId !== actor.userId || !canEditRoomSettings(room)) reject('Only the host can change settings while no players are ready');
      if (!validRoomSettings(settings || {}) || settings.autoReady) reject('Invalid room settings');
      await mutate(room, request, draft => {
        if (room.revision !== expectedRevision) reject('Room changed. Reopen settings and try again.');
        if (!canEditRoomSettings(draft) || draft.hostId !== actor.userId) reject('Players must unready before changing settings');
        draft.settings = { ...settings };
      }, () => getSession(actor.userId)?.connectionId === actor.connectionId && getSession(actor.userId)?.roomId === room.id);
    },
    async 'room:join'({ roomId, code }, request, work) {
      const room = roomId ? gameRooms.get(roomId) : findRoomByCode(code);
      if (!room || (room.settings.isPrivate && code !== room.joinCode)) reject('Room not found');
      const user = await prisma.user.findUnique({ where: { id: actor.userId } });
      currentActor(actor, 'idle', work);
      if (gameRooms.get(room.id) !== room || room.status !== 'waiting' || room.players.length >= 2) reject('Room is no longer available');
      if (!user || user.coins < room.settings.buyIn) reject('Cannot afford buy-in');
      if (user.isGuest && room.settings.buyIn > 0) reject('Wagers require registered players');
      await mutate(room, request, draft => {
        if (draft.status !== 'WAITING' || draft.players.length >= 2) reject('Room is no longer available');
        if (draft.settings.isPrivate && code !== room.joinCode) reject('An invite link or code is required');
        if (draft.challenge && (draft.challenge.userId !== user.id || !pendingChallenge(draft))) reject('Invitation is no longer available');
        if (draft.invites) draft.invites = [];
        draft.players.push({ userId: user.id, ready: false, online: true,
          joinedViaInvite: code === room.joinCode }); resetReadiness(draft);
      }, () => !!currentActor(actor, 'idle', work));
      await reconcileRoomPresence(room);
      // Scan-to-play: the ack of the join is already an in-game snapshot. A failed start
      // leaves the room waiting (with the error) and `room:ready` retries it.
      if (room.settings.autoReady) return startRoomGame(room);
    },
    async 'room:ready'({ roomId, ready, expectedSettings }, request) {
      const room = waitingRoom(actor, roomId);
      if (room.pending) reject('Room is updating. Please try again.');
      const player = room.players.find(player => player.userId === actor.userId && !player.isBot);
      if (!player || typeof ready !== 'boolean') reject('Invalid readiness request');
      await mutate(room, request, draft => {
        if (draft.status !== 'WAITING') reject('Game is starting or already active');
        if (ready && !sameRoomSettings(draft.settings, expectedSettings)) reject('Room settings changed. Review them before readying up.');
        draft.players.find(p => p.userId === actor.userId).ready = ready;
      }, () => getSession(actor.userId)?.connectionId === actor.connectionId && getSession(actor.userId)?.roomId === room.id);
      return startRoomGame(room);
    },
    'room:leave'({ roomId }, request) {
      const session = getSession(actor.userId);
      const owned = session.phase === 'in-room' ? session.roomId : session.spectatingRoomId;
      if (owned !== roomId) reject('Not in this room');
      const result = activeGames.get(session.spectatingGameId);
      if (result?.game.gameOver) return leaveResult(result, actor.userId, request, () =>
        getSession(actor.userId) === session && session.connectionId === actor.connectionId && session.spectatingGameId === result.id);
      const room = gameRooms.get(owned);
      return leaveRoom(room, actor.userId, null, () => session.connectionId === actor.connectionId &&
        (session.roomId === owned || session.spectatingRoomId === owned), receipt(request));
    },
    'room:kick'({ roomId, userId }, request) {
      const room = memberRoom(actor, roomId);
      if (room.hostId !== actor.userId || userId === actor.userId) reject('Only the host can remove other members');
      if (![...room.players, ...room.spectators].some(player => player.userId === userId)) reject('Member not found');
      return leaveRoom(room, userId, 'room-kicked', () => getSession(actor.userId)?.connectionId === actor.connectionId && room.hostId === actor.userId, receipt(request));
    },
    async 'room:spectate'({ roomId, code }, request) {
      currentActor(actor, 'idle');
      const room = roomId ? gameRooms.get(roomId) : findRoomByCode(code);
      if (!room || (room.settings.isPrivate && code !== room.joinCode)) reject('Room not found');
      if (!room.settings.allowSpectators) reject('Spectators not allowed');
      await mutate(room, request, draft => {
        if (draft.settings.isPrivate && code !== room.joinCode) reject('An invite link or code is required');
        if (!draft.settings.allowSpectators) reject('Spectators not allowed');
        draft.spectators.push({ userId: actor.userId, online: true });
      },
        () => !!currentActor(actor, 'idle'));
      await reconcileRoomPresence(room);
    },
    // Permitted while idle and while searching ("play a bot instead"). From a search the
    // pool entry is removed only after the database work, once the phase is known to be
    // unchanged; a failed start force-idles so no session is left in a dead room.
    async 'bot:play'({ difficulty = 'medium' }, request, work) {
      const [host, bot] = await Promise.all([prisma.user.findUnique({ where: { id: actor.userId } }), getBotUser(difficulty)]);
      work.assertCurrent();
      const session = getSession(actor.userId);
      if (session?.connectionId !== actor.connectionId || !['idle', 'matchmaking'].includes(session.phase)) reject('Your session changed. Please try again.');
      if (!host || !bot) reject('Bot is unavailable');
      if (session.phase === 'matchmaking') {
        if ([...gameRooms.values()].some(room => room.status === 'starting' && room.players.some(p => p.userId === actor.userId))) reject('A match is starting');
        quickPlayPool.remove(actor.userId);
        forceIdle(actor.userId); // clears the search deadline and its timer
      }
      const room = await newRoom([playerRecord(host, true), playerRecord(bot)], { buyIn: 0, turnTimer: TURN_TIME, isPrivate: false, allowSpectators: true }, 'bot', work, request?.id,
        () => currentActor(actor, 'idle', work));
      installRoom(room, work);
      await reconcileRoomPresence(room);
      try { await startRoomGame(room); }
      catch (error) { if (work.isCurrent()) await leaveRoom(gameRooms.get(room.id), actor.userId); throw error; }
    },
    async 'bot:join'({ roomId, difficulty = 'medium' }, request, work) {
      let room = waitingRoom(actor, roomId);
      if (room.hostId !== actor.userId || !canAddRoomBot(room)) reject('A bot requires a free room with one host');
      const bot = await getBotUser(difficulty);
      room = waitingRoom(actor, roomId, work);
      if (!bot) reject('Bot is unavailable');
      if (room.hostId !== actor.userId || !canAddRoomBot(room)) reject('Room membership changed');
      await mutate(room, request, draft => {
        if (draft.status !== 'WAITING' || draft.players.length !== 1 || draft.hostId !== actor.userId) reject('Room membership changed');
        if (draft.invites) draft.invites = [];
        draft.players.push({ userId: bot.id, ready: true, online: true });
      }, () => !!waitingRoom(actor, room.id, work));
      return startRoomGame(room);
    },
    disconnect() {
      for (const room of gameRooms.values()) {
        if (room.runtimeStopped) continue;
        if ([...room.players, ...room.spectators].some(p => p.userId === actor.userId))
          void reconcileRoomPresence(room).catch(error => console.error('Room presence update failed:', error.message));
      }
    }
  }, ['room:list', 'disconnect']);
}

// Start the room's game if its rules allow it now (used after the host reconnects to an
// autoReady room whose friend is already seated). Failure resets the room like any start.
export async function tryStartRoom(room) {
  if (!room || room.runtimeStopped || gameRooms.get(room.id) !== room) return;
  if (room.status === 'waiting' && !canStartRoom(room)) return;
  if (room.status === 'playing' && activeGames.has(room.gameId)) return;
  if (!['waiting', 'starting', 'playing'].includes(room.status)) return;
  return startRoomGame(room);
}

function startRoomGame(room) {
  if (room.startingTask) return room.startingTask;
  const task = queueRoomWork(room, broadcastRoomUpdate, work => startRoomGameInRuntime(room, work));
  room.startingTask = task;
  task.then(() => { room.startingTask = null; }, () => { room.startingTask = null; });
  return task;
}

async function startRoomGameInRuntime(room, work) {
  if (gameRooms.get(room.id) !== room) reject('Room is no longer available');
  try {
    if (room.status === 'waiting') {
      if (!canStartRoom(room)) return;
      const order = Math.random() < 0.5 ? room.players : [...room.players].reverse();
      const attempt = { key: randomUUID(), players: order.map(p => p.userId) };
      await writeRoomRecord(room, work, draft => { draft.status = 'STARTING'; draft.startAttempt = attempt; });
    }
    if (room.status === 'closed') return;
    const attempt = room.startAttempt;
    if (!attempt) reject('Room has no accepted game start');
    let error;
    for (let tries = 0; tries < 2; tries++) {
      try {
        const mode = room.players.some(p => p.isGuest || p.isBot) ? 'FRIENDLY' : 'RANKED';
        await createGameDirect(...attempt.players, mode, room.settings.buyIn, room.settings.turnTimer, null, room.origin, attempt.key, { roomId: room.id });
        work.assertCurrent();
        await acceptRoomRecord(room, await readRoomRecord(room.id, work.owner), work);
        return;
      } catch (failure) {
        error = failure; work.assertCurrent();
        await acceptRoomRecord(room, await readRoomRecord(room.id, work.owner), work);
        if (room.gameId && activeGames.has(room.gameId)) return;
        if (room.status === 'waiting' || room.status === 'closed') throw error;
      }
    }
    // A confirmed failed installation returns to an actionable waiting room.
    await cancelRoomStart(room, work);
    throw error;
  } catch (error) {
    if (!work.isCurrent() || room.runtimeStopped) throw error;
    if (['starting', 'playing'].includes(room.status) && !activeGames.has(room.gameId)) {
      clearTimeout(room.startRetryTimer);
      room.startRetryTimer = setTimeout(() => {
        void tryStartRoom(room).catch(error => console.error('Room start recovery failed:', error.message));
      }, 1000);
      room.startRetryTimer.unref?.();
    }
    console.error('Room start failed:', error);
    reject('Game could not start. Ready again to retry.');
  }
}

async function cancelRoomStart(room, work, guard = () => true) {
  if (!room.startAttempt) return;
  const key = room.startAttempt.key;
  let cancelled;
  const cancel = () => abortGameStart(key, null, work.owner, { allowMissing: true, guard });
  try { cancelled = await cancel(); } catch (error) { try { cancelled = await cancel(); } catch { throw error; } }
  if (!cancelled) return;
  await acceptRoomRecord(room, await readRoomRecord(room.id, work.owner), work);
  if (room.status === 'starting') {
    await writeRoomRecord(room, work, draft => { draft.status = 'WAITING'; draft.startAttempt = null; draft.gameId = null; resetReadiness(draft); });
  }
}

export function createQuickPlayRoom(playerA, playerB) {
  const players = [playerA, playerB];
  const sessions = players.map(p => getSession(p.userId));
  const connections = sessions.map(session => session?.connectionId);
  return runGameplayWork(async work => {
    work.assertCurrent();
    const searching = (p, i) => getSession(p.userId) === sessions[i] &&
      sessions[i]?.phase === 'matchmaking' && !!sessions[i].connectionId;
    const available = () => players.every((p, i) => quickPlayPool.ownsClaim(p) && searching(p, i) &&
      sessions[i].connectionId === connections[i]);
    const release = () => {
      for (const [i, p] of players.entries()) {
        if (searching(p, i)) quickPlayPool.restoreClaim(p);
        else quickPlayPool.finishClaim(p);
      }
    };
    if (!available()) { release(); return; }
    let room;
    try {
      room = await newRoom(players.map(p => ({ ...p, ready: true, online: true })),
        { buyIn: 0, turnTimer: TURN_TIME, isPrivate: false, allowSpectators: true }, 'quickplay', work, randomUUID(),
        () => { if (!available()) reject('Matchmaking session changed'); });
    } catch (error) {
      // Creation has now confirmed no room for its identity. An admission
      // conflict can still mean another durable membership needs projecting.
      // Keep both session queues held until that truth is known.
      await retryGameplayRecovery(work, async () => {
        for (const p of players) {
          work.assertCurrent();
          await reconcileUserRoom(p.userId);
        }
      });
      release();
      throw error;
    }
    installRoom(room, work);
    players.forEach(p => quickPlayPool.finishClaim(p));
    await reconcileRoomPresence(room);
    return startRoomGame(room);
  }, action => enqueueSessionWork(sessions, action));
}

export function leaveRoom(room, userId, reason = null, guard = () => true, command = null) {
  if (!guard() || room?.runtimeStopped) return Promise.resolve();
  if (!room) {
    const session = getSession(userId);
    if (['in-room', 'spectating'].includes(session?.phase)) { forceIdle(userId); publishUser(userId); }
    return Promise.resolve();
  }
  const task = queueRoomWork(room, broadcastRoomUpdate, async work => {
    if (!guard()) return;
    await acceptRoomRecord(room, await readRoomRecord(room.id, work.owner), work);
    if (room.status === 'closed') return;
    const player = room.players.some(p => p.userId === userId);
    if (player && room.status === 'playing' && activeGames.has(room.gameId)) reject('Finish the game before leaving');
    if (player && room.startAttempt) await cancelRoomStart(room, work, guard);
    if (!guard()) return;
    const botIds = new Set(room.players.filter(p => p.isBot).map(p => p.userId));
    await writeRoomRecord(room, work, draft => {
      draft.players = draft.players.map(p => ({ ...p, isBot: botIds.has(p.userId) }));
      const { closed } = removeMember(draft, userId);
      if (closed) { draft.status = 'CLOSED'; draft.hostId = null; }
    }, { command, guard, removedUserId: userId, removedReason: reason });
  });
  room.membershipChange = task;
  task.then(() => { room.membershipChange = null; }, () => { room.membershipChange = null; });
  return task;
}

export function reconcileRoomPresence(room) {
  if (!room || room.runtimeStopped || room.status === 'closed') return Promise.resolve();
  const task = queueRoomWork(room, broadcastRoomUpdate, async work => {
    await acceptRoomRecord(room, await readRoomRecord(room.id, work.owner), work);
    if (room.status === 'closed') return;
    const now = Date.now();
    const updates = new Map([...room.players, ...room.spectators].filter(p => !p.isBot &&
      !(room.status === 'playing' && activeGames.has(room.gameId) && room.players.some(player => player.userId === p.userId))).map(p => [p.userId, !!getSession(p.userId)?.connectionId]));
    if (![...room.players, ...room.spectators].some(p => updates.has(p.userId) && p.online !== updates.get(p.userId))) return;
    await writeRoomRecord(room, work, draft => {
      for (const p of [...draft.players, ...draft.spectators]) {
        if (!updates.has(p.userId)) continue;
        const online = !!getSession(p.userId)?.connectionId;
        if (p.online === online) continue;
        p.online = online;
        p.disconnectDeadline = online ? null : now + 120000;
        if ('ready' in p && !online) p.ready = false;
      }
    });
  });
  task.then(() => { clearTimeout(room.presenceRetryTimer); }, () => {
    if (room.runtimeStopped || room.status === 'closed') return;
    clearTimeout(room.presenceRetryTimer);
    room.presenceRetryTimer = setTimeout(() => {
      void reconcileRoomPresence(room).catch(error => console.error('Room presence retry failed:', error.message));
    }, 1000);
    room.presenceRetryTimer.unref?.();
  });
  return task;
}

// A connection can arrive after persistence but before the original command
// published its projection. Admission and reconnect use these same claims.
export function reconcileUserRoom(userId) {
  return runGameplayWork(async work => {
    const record = await inGameplayTransaction(work.owner, null, async tx => {
      const claim = await tx.activeRoomMember.findUnique({ where: { userId }, include: { room: true } });
      if (claim) return claim.room;
      const game = await tx.activeGamePlayer.findUnique({ where: { userId }, include: { run: true } });
      return game?.run.roomId ? tx.roomRecord.findUnique({ where: { id: game.run.roomId } }) : null;
    });
    work.assertCurrent();
    if (!record) return;
    let room = gameRooms.get(Number(record.id));
    if (!room) {
      room = await projectRoomRecord(record, null, work.owner); work.assertCurrent();
      // Creation may have installed its projection while the read was pending.
      room = gameRooms.get(room.id) || room;
      if (!gameRooms.has(room.id)) installRoom(room, work);
    }
    await reconcileRoomPresence(room);
    applyRoomSessions(room);
    const game = activeGames.get(room.gameId);
    if (game?.getPlayerColor(userId) && ['idle', 'in-room', 'matchmaking'].includes(getSession(userId)?.phase))
      setPhase(userId, 'in-game', { gameId: game.id, gameColor: game.getPlayerColor(userId) });
  });
}

export function expireRoomMember(room, userId) {
  const member = [...room.players, ...room.spectators].find(p => p.userId === userId);
  const deadline = member?.disconnectDeadline;
  const current = () => !getSession(userId)?.connectionId && Number.isFinite(deadline) && deadline <= Date.now() &&
    [...room.players, ...room.spectators].some(p => p.userId === userId && p.disconnectDeadline === deadline);
  if (!current()) return Promise.resolve();
  return leaveRoom(room, userId, 'room-expired', current).catch(error => {
    console.error('Room expiry failed:', error.message); armRoomExpiry(room, 1000);
  });
}

function armRoomExpiry(room, retryDelay = 50) {
  clearTimeout(room.expiryTimer);
  if (room.runtimeStopped || room.expiryPending || room.status === 'closed') return;
  const offline = [...(room.status === 'playing' && activeGames.has(room.gameId) ? [] : room.players), ...room.spectators]
    .filter(p => !p.isBot && p.online === false && Number.isFinite(p.disconnectDeadline));
  const challengeDeadline = room.challenge && room.status === 'waiting' && room.players.length === 1 ? room.challenge.expiresAt : null;
  const inviteDeadline = Math.min(...(room.invites ?? []).map(i => i.expiresAt));
  if (!offline.length && challengeDeadline === null && !Number.isFinite(inviteDeadline)) return;
  room.expiryTimer = setTimeout(async () => {
    room.expiryPending = true;
    try {
      if (inviteDeadline <= Date.now()) await expireRoomInvites(room);
      if (challengeDeadline !== null && challengeDeadline <= Date.now()) await expireChallenge(room);
      for (const p of offline.filter(p => p.disconnectDeadline <= Date.now())) {
        await expireRoomMember(room, p.userId);
      }
    } catch (error) { console.error('Room expiry failed:', error.message); }
    finally { room.expiryPending = false; armRoomExpiry(room, 1000); }
  }, Math.max(retryDelay, Math.min(...offline.map(p => p.disconnectDeadline), challengeDeadline ?? Infinity, inviteDeadline) - Date.now()));
  room.expiryTimer.unref?.();
}

export function expireRoomInvites(room) {
  return queueRoomWork(room, broadcastRoomUpdate, async work => {
    if (room.status === 'closed') return;
    await writeRoomRecord(room, work, draft => { draft.invites = (draft.invites ?? []).filter(i => i.expiresAt > Date.now()); });
  });
}

export function expireChallenge(room) {
  return queueRoomWork(room, broadcastRoomUpdate, async work => {
    await acceptRoomRecord(room, await readRoomRecord(room.id, work.owner), work);
    if (!room.challenge || room.status !== 'waiting' || room.players.length !== 1 || room.challenge.expiresAt > Date.now()) return;
    await writeRoomRecord(room, work, draft => { draft.status = 'CLOSED'; }, { removedUserId: room.hostId, removedReason: 'challenge-expired' });
  });
}

export function stopRoomRuntime() {
  const pending = [stopGameplayWork()];
  for (const room of gameRooms.values()) {
    room.runtimeStopped = true;
    clearTimeout(room.expiryTimer); clearTimeout(room.startRetryTimer);
    clearTimeout(room.presenceRetryTimer);
    if (room.changes) pending.push(room.changes);
  }
  return Promise.allSettled(pending);
}
