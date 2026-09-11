import { resolveEmote } from '../services/emotes.js';

const senders = new WeakMap(); // runtime-only; no replay of transient reactions
const denied = (code, error) => ({ ok: false, code, error });

export function createGameEmoteAction(actor, { getGame, getSession, publish, resolve = resolveEmote, now = Date.now }) {
  return async ({ gameId, itemId } = {}, _request, work) => {
    if (!Number.isSafeInteger(gameId) || gameId < 1 || !Number.isSafeInteger(itemId) || itemId < 1 || itemId > 2_147_483_647) {
      return denied('INVALID_EMOTE', 'Select an available emote.');
    }
    const room = getGame(gameId);
    const current = () => {
      const session = getSession(actor.userId);
      return (!work || work.isCurrent()) && room && getGame(gameId) === room && !room.runtimeStopped && room.started &&
        !room.game.gameOver && !room.recovery && room.getPlayerColor(actor.userId) && session?.phase === 'in-game' &&
        session.gameId === gameId && session.connectionId === actor.connectionId;
    };
    if (!current()) return denied('GAME_UNAVAILABLE', 'Emotes are unavailable in this game state.');
    if (!senders.has(room)) senders.set(room, new Map());
    const states = senders.get(room);
    if (!states.has(actor.userId)) states.set(actor.userId, { pending: false, lastAttemptAt: null });
    const state = states.get(actor.userId);
    if (state.pending || (state.lastAttemptAt !== null && now() - state.lastAttemptAt < 2000)) return denied('RATE_LIMITED', 'Wait a moment before sending another emote.');
    state.pending = true; state.lastAttemptAt = now();
    try {
      const emote = await resolve(actor.userId, itemId);
      // Database access yields: departure, replacement, terminal state, recovery
      // or owner loss during that wait must invalidate this transient send.
      if (!current()) return denied('GAME_UNAVAILABLE', 'The game changed before the emote could be sent.');
      if (!emote) return denied('EMOTE_UNAVAILABLE', 'This emote is no longer available. Refresh your emotes.');
      publish(gameId, { gameId, userId: actor.userId, username: actor.username, emote });
      return { ok: true };
    } finally { state.pending = false; }
  };
}
