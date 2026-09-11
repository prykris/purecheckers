import { isDeepStrictEqual } from 'node:util';
import { GAME_OVER_LINGER_MS } from '../../shared/constants.js';

export const RESULT_STATE_VERSION = 1;
export class ResultActionRejected extends Error {}
const validId = value => Number.isSafeInteger(value) && value > 0;
const validKey = value => typeof value === 'string' && value.length > 0 && value.length <= 100;

export function initialResultState(run, users, sourceRoom = null) {
  const endedAt = run.checkpoint?.endedAt;
  if (!run.checkpoint?.engine?.gameOver || !validId(endedAt)) throw Error('A result requires a terminal checkpoint');
  const deadline = endedAt + GAME_OVER_LINGER_MS;
  const spectators = sourceRoom?.status === 'PLAYING' && sourceRoom.state.gameId === run.id
    ? sourceRoom.state.spectators.map(p => ({ userId: p.userId, roomId: Number(sourceRoom.id),
      deadline: p.online === false ? Math.min(deadline, p.disconnectDeadline) : deadline })) : [];
  return normalizeResultState({ status: 'OPEN', deadline,
    players: [run.redPlayerId, run.blackPlayerId].map(userId => ({ userId, viewing: !users.get(userId)?.isBot, requested: !!users.get(userId)?.isBot })),
    spectators, rematch: null }, run, users);
}

export function normalizeResultState(state, run, users) {
  if (!state || run.checkpoint?.schema !== 1 || !run.checkpoint?.engine?.gameOver ||
      !['OPEN', 'STARTING', 'REMATCHED', 'CLOSED'].includes(state.status) || !validId(state.deadline) ||
      state.deadline !== run.checkpoint?.endedAt + GAME_OVER_LINGER_MS || !Array.isArray(state.players) || !Array.isArray(state.spectators) ||
      !isDeepStrictEqual(state.players.map(p => p.userId), [run.redPlayerId, run.blackPlayerId])) throw Error('Invalid result state');
  const seen = new Set();
  const players = state.players.map(p => {
    if (!validId(p.userId) || !users.has(p.userId) || typeof p.viewing !== 'boolean' || typeof p.requested !== 'boolean' || seen.has(p.userId)) throw Error('Invalid result player');
    seen.add(p.userId);
    const bot = !!users.get(p.userId).isBot;
    if ((bot && p.viewing) || (bot && !p.requested) || (!bot && !p.viewing && p.requested)) throw Error('Invalid result participation');
    return { userId: p.userId, viewing: p.viewing, requested: p.requested };
  });
  const spectators = state.spectators.map(p => {
    if (!validId(p.userId) || !users.has(p.userId) || users.get(p.userId).isBot || seen.has(p.userId) || !validId(p.roomId) ||
        BigInt(p.roomId) !== run.roomId || !validId(p.deadline) || p.deadline > state.deadline) throw Error('Invalid result spectator');
    seen.add(p.userId); return { userId: p.userId, roomId: p.roomId, deadline: p.deadline };
  });
  const rematch = state.rematch ?? null;
  if (rematch && (!validKey(rematch.key) || !isDeepStrictEqual(rematch.players, [run.blackPlayerId, run.redPlayerId]) ||
      (rematch.gameId !== null && !validId(rematch.gameId)))) throw Error('Invalid rematch identity');
  if ((state.status === 'OPEN' && rematch) || (state.status === 'STARTING' && (!rematch || rematch.gameId !== null)) ||
      (state.status === 'REMATCHED' && (!rematch?.gameId || players.some(p => p.viewing))) ||
      (state.status === 'CLOSED' && (players.some(p => p.viewing) || spectators.length))) throw Error('Invalid result phase');
  if (state.status === 'STARTING' && !players.every(p => users.get(p.userId).isBot || (p.viewing && p.requested))) throw Error('Rematch consent is incomplete');
  return { status: state.status, deadline: state.deadline, players, spectators,
    rematch: rematch ? { key: rematch.key, players: [...rematch.players], gameId: rematch.gameId } : null };
}

export const resultViewers = state => [
  ...state.players.filter(p => p.viewing).map(p => ({ userId: p.userId, role: 'PLAYER' })),
  ...state.spectators.map(p => ({ userId: p.userId, role: 'SPECTATOR' }))
];
export function splitResultState(state) { const { status, ...data } = state; return { status, state: data }; }

function closeIfEmpty(state) { if (!resultViewers(state).length) state.status = 'CLOSED'; }
function withdraw(state, userId) {
  const player = state.players.find(p => p.userId === userId);
  if (player?.viewing) { player.viewing = false; player.requested = false; }
  state.spectators = state.spectators.filter(p => p.userId !== userId);
}

// Commands name domain transitions, not arbitrary JSON mutations. Unresolved
// starts must be cancelled through the game repository before player departure.
export function transitionResult(before, action, { run, users, now, rematchKey }) {
  const state = structuredClone(before), notices = [];
  if (!validId(now)) throw Error('Invalid result clock');
  if (state.status === 'CLOSED') throw Error('Result is closed');
  if (action.type === 'request-rematch') {
    if (state.status !== 'OPEN' || now >= state.deadline) throw new ResultActionRejected('Rematch is unavailable');
    const player = state.players.find(p => p.userId === action.userId);
    if (!player?.viewing || users.get(player.userId).isBot) throw new ResultActionRejected('Not viewing this result as a player');
    if (state.players.some(p => !users.get(p.userId).isBot && !p.viewing)) throw new ResultActionRejected('Your opponent has left');
    player.requested = true;
    if (state.players.every(p => p.requested)) {
      state.status = 'STARTING'; state.rematch = { key: rematchKey, players: [run.blackPlayerId, run.redPlayerId], gameId: null };
    }
  } else if (action.type === 'dismiss') {
    if (!resultViewers(state).some(p => p.userId === action.userId)) throw Error('Not viewing this result');
    if (state.status === 'STARTING' && state.players.some(p => p.userId === action.userId)) throw Error('Resolve the rematch before leaving');
    withdraw(state, action.userId); closeIfEmpty(state);
  } else if (action.type === 'expire') {
    const expired = [...(now >= state.deadline ? state.players.filter(p => p.viewing) : []), ...state.spectators.filter(p => now >= p.deadline)];
    if (state.status === 'STARTING' && expired.some(p => state.players.some(player => player.userId === p.userId))) throw Error('Resolve the rematch before expiry');
    for (const p of expired) { withdraw(state, p.userId); notices.push({ userId: p.userId, reason: 'game-expired', context: { gameId: run.id } }); }
    closeIfEmpty(state);
  } else throw Error('Unknown result transition');
  return { state: normalizeResultState(state, run, users), notices };
}

export function resultAfterCancelledRematch(before, run, users) {
  if (!['STARTING', 'REMATCHED'].includes(before.status) || !before.rematch) throw Error('No rematch to cancel');
  const state = { ...structuredClone(before), status: 'OPEN', rematch: null };
  for (const p of state.players) { p.viewing = !users.get(p.userId).isBot; p.requested = !!users.get(p.userId).isBot; }
  return normalizeResultState(state, run, users);
}
