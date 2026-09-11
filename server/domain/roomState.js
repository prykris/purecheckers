import { isDeepStrictEqual } from 'node:util';
import { validRoomSettings } from '../../shared/rooms.js';
import { canStartRoom, resetReadiness, canEditRoomSettings } from './roomRules.js';

export const ROOM_STATE_VERSION = 1;
const transitions = {
  WAITING: ['WAITING', 'STARTING', 'CLOSED'],
  STARTING: ['STARTING', 'WAITING', 'PLAYING', 'CLOSED'],
  PLAYING: ['PLAYING', 'WAITING', 'CLOSED'],
  CLOSED: []
};
const userId = value => Number.isSafeInteger(value) && value > 0;
const same = (a, b) => isDeepStrictEqual(a, b);

// Only durable fields are accepted. Names/account type are read from User;
// socket objects, timers, generated QR images and presentation data stay out.
export function normalizeRoomState(input, users) {
  if (!input || !Object.hasOwn(transitions, input.status) || !validRoomSettings(input.settings || {}) ||
      !['room', 'quickplay', 'bot'].includes(input.origin) || !Array.isArray(input.players) ||
      input.players.length > 2 || !Array.isArray(input.spectators)) throw Error('Invalid room state');
  const seen = new Set();
  const member = (value, spectator) => {
    const user = users.get(value?.userId);
    if (!userId(value?.userId) || seen.has(value.userId) || !user || (spectator && user.isBot) ||
        (value.online !== undefined && typeof value.online !== 'boolean') ||
        (!spectator && value.ready !== undefined && typeof value.ready !== 'boolean') ||
        (value.joinedViaInvite !== undefined && typeof value.joinedViaInvite !== 'boolean') ||
        ((spectator || user.isBot) && value.joinedViaInvite === true)) throw Error('Invalid room member');
    seen.add(value.userId);
    const online = user.isBot || value.online !== false;
    const disconnectDeadline = value.disconnectDeadline ?? null;
    if ((!online && (!Number.isSafeInteger(disconnectDeadline) || disconnectDeadline <= 0)) ||
        (online && disconnectDeadline !== null)) throw Error('Invalid room disconnect deadline');
    return { userId: value.userId, online, disconnectDeadline, ...(!spectator ? {
      ready: user.isBot || !!value.ready,
      ...(value.joinedViaInvite !== undefined ? { joinedViaInvite: value.joinedViaInvite } : {})
    } : {}) };
  };
  const players = input.players.map(p => member(p, false)), spectators = input.spectators.map(p => member(p, true));
  if (input.hostId != null && !userId(input.hostId)) throw Error('Invalid room host');
  if (input.status !== 'CLOSED' && !players.some(p => p.userId === input.hostId && !users.get(p.userId).isBot)) throw Error('A room requires a human host');
  const attempt = input.startAttempt ?? null, gameId = input.gameId ?? null;
  if (attempt && (typeof attempt.key !== 'string' || !attempt.key || attempt.key.length > 100 ||
      !Array.isArray(attempt.players) || attempt.players.length !== 2 ||
      !same([...attempt.players].sort((a,b) => a-b), players.map(p => p.userId).sort((a,b) => a-b)))) throw Error('Invalid room start identity');
  if ((['STARTING', 'PLAYING'].includes(input.status) && !attempt) ||
      (input.status === 'WAITING' && attempt) ||
      (input.status === 'PLAYING' && !userId(gameId)) ||
      (gameId !== null && !userId(gameId)) ||
      (['WAITING', 'STARTING'].includes(input.status) && gameId !== null)) throw Error('Invalid room game association');
  const { buyIn, turnTimer, isPrivate, allowSpectators, autoReady } = input.settings;
  const challenge = input.challenge;
  if (challenge !== undefined && (!challenge || !userId(challenge.userId) ||
      !Number.isSafeInteger(challenge.expiresAt) || challenge.expiresAt <= 0 ||
      !isPrivate || buyIn !== 0 || autoReady || allowSpectators || input.origin !== 'room' ||
      (input.status !== 'CLOSED' && players.some(p => p.userId !== input.hostId && p.userId !== challenge.userId)) ||
      (input.status !== 'CLOSED' && input.hostId === challenge.userId))) throw Error('Invalid challenge room');
  return { status: input.status, hostId: input.hostId ?? null,
    ...(challenge ? { challenge: { userId: challenge.userId, expiresAt: challenge.expiresAt } } : {}),
    settings: { buyIn, turnTimer, isPrivate, allowSpectators, autoReady }, origin: input.origin,
    players, spectators, startAttempt: attempt ? { key: attempt.key, players: [...attempt.players] } : null, gameId };
}

export function assertRoomTransition(before, after, { users, run = null, roomId, command = null }) {
  if (!transitions[before.status]?.includes(after.status)) throw Error('Invalid room transition');
  if (before.origin !== after.origin) throw Error('Room origin is immutable');
  if (!same(before.settings, after.settings)) {
    if (command?.payload.type !== 'room:settings' || command.userId !== before.hostId || !canEditRoomSettings(before) ||
        after.status !== 'WAITING' || after.hostId !== before.hostId || !same(before.players, after.players) || !same(before.spectators, after.spectators))
      throw Error('Only the host can change settings while no players are ready');
    if (after.settings.autoReady) throw Error('Updated rooms require explicit readiness');
    if (!after.settings.allowSpectators && after.spectators.length) throw Error('Remove spectators before disabling watching');
    if (after.settings.buyIn > 0 && after.players.some(p => {
      const user = users.get(p.userId); return user.isGuest || user.isBot || user.coins < after.settings.buyIn;
    })) throw Error('All players must be registered and able to afford the buy-in');
  }
  if (!same(before.challenge, after.challenge)) throw Error('Challenge identity is immutable');
  for (const player of after.players) {
    const prior = before.players.find(p => p.userId === player.userId);
    if (prior && !!prior.joinedViaInvite !== !!player.joinedViaInvite) throw Error('Room entry source is immutable');
  }
  if (['STARTING', 'PLAYING'].includes(before.status) && after.status !== 'CLOSED' && after.status !== 'WAITING') {
    if (!same(before.players.map(p => p.userId), after.players.map(p => p.userId)) ||
        !same(before.startAttempt, after.startAttempt) || before.hostId !== after.hostId) throw Error('A started room cannot change its players');
  }
  if (before.status === 'WAITING' && after.status === 'STARTING') {
    const ready = { ...before, status: 'waiting', players: before.players.map(p => ({ ...p, isBot: users.get(p.userId).isBot })) };
    if (!canStartRoom(ready) || !same(before.players, after.players) || run) throw Error('Room is not ready for a fresh start');
  }
  if (before.status === 'STARTING' && ['WAITING', 'CLOSED'].includes(after.status) && run && run.status !== 'ABORTED') throw Error('Confirm game cancellation before changing the room');
  if (after.status === 'PLAYING' && (!run || run.roomId !== roomId || run.id !== after.gameId ||
      run.key !== after.startAttempt.key || !same([run.redPlayerId, run.blackPlayerId], after.startAttempt.players))) throw Error('Room game association does not match');
  if (before.status === 'PLAYING' && run?.checkpoint?.engine?.gameOver &&
      after.spectators.some(p => !before.spectators.some(prior => prior.userId === p.userId))) throw Error('Cannot join a finished game as a spectator');
  if (before.status === 'PLAYING' && after.status === 'CLOSED' && (!run || (run.status === 'OPEN' && !run.checkpoint?.engine?.gameOver))) throw Error('Finish the game before closing its room');
  if (before.status === 'PLAYING' && after.status === 'WAITING' && (!run || run.status !== 'ABORTED' || run.checkpoint?.started || run.checkpoint?.engine?.moveHistory?.length)) throw Error('Only an aborted uninstalled start can return to waiting');
}

export function roomAfterAbortedStart(state, players) {
  const users = new Map(players.map(p => [p.id, p]));
  const draft = { ...structuredClone(state), gameId: null, startAttempt: null };
  draft.players = draft.players.map(p => ({ ...p, isBot: !!users.get(p.userId)?.isBot }));
  resetReadiness(draft);
  draft.players = draft.players.map(({ isBot, ...p }) => p);
  return draft;
}

export function roomClaims(state, users) {
  if (state.status === 'CLOSED') return [];
  return [
    ...(['WAITING', 'STARTING'].includes(state.status) ? state.players.filter(p => !users.get(p.userId).isBot).map(p => ({ userId: p.userId, role: 'PLAYER' })) : []),
    ...state.spectators.map(p => ({ userId: p.userId, role: 'SPECTATOR' }))
  ];
}

export function splitRoomState(state) {
  const { status, ...data } = state;
  return { status, state: data };
}
