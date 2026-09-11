import { CheckersGame } from '../../shared/game.js';
import { gameResultCode, playerGameResult } from '../../shared/gameResult.js';

const STORAGE_KEY = 'checkers_game_events_v1';
const MAX_GAMES = 128;
const sources = new Set(['bot', 'quickplay', 'room', 'invite', 'fallback', 'unknown']);

function browserStorage() {
  try { return globalThis.sessionStorage; } catch { return null; }
}

// Use the shared rules to interpret turns, including multi-capture chains.
function hasMoved(game) {
  const replay = new CheckersGame();
  for (const move of game.moveHistory || []) {
    if (replay.currentPlayer === game.yourColor) return true;
    replay.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
  }
  return false;
}

// A read-only consumer of accepted session state. It never sends commands and
// never treats a click, acknowledgement or component mount as a game event.
export class GameAnalytics {
  constructor({ track, storage = browserStorage } = {}) {
    this.track = track;
    this.storage = storage;
    this.records = null;
    this.bind(null);
  }
  bind(userId) {
    this.userId = userId;
    this.previous = null;
    this.recovery = null;
    this.searchJourney = false;
  }
  load() {
    if (this.records) return;
    this.records = new Map();
    try {
      const entries = JSON.parse(this.storage()?.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(entries)) return;
      for (const entry of entries.slice(-MAX_GAMES)) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [key, value] = entry;
        if (typeof key === 'string' && value && sources.has(value.source) &&
            ['start', 'move', 'end'].every(field => typeof value[field] === 'boolean')) {
          // Earlier journals called all room-origin games invitations. They do
          // not establish that the player entered through an invitation link.
          this.records.set(key, { source: value.source === 'invite' && value.inviteConfirmed !== true ? 'room' : value.source,
            inviteConfirmed: value.inviteConfirmed === true,
            start: value.start, move: value.move, end: value.end });
        }
      }
    } catch { /* Storage is optional; keep deduplication in memory. */ }
  }
  save() {
    while (this.records.size > MAX_GAMES) this.records.delete(this.records.keys().next().value);
    try { this.storage()?.setItem(STORAGE_KEY, JSON.stringify([...this.records])); } catch {}
  }
  observe({ status, snapshot, recovery }) {
    if (this.userId == null || status !== 'ready' || !snapshot || snapshot === this.previous) return;
    this.load();
    const recovered = !this.previous || (recovery !== undefined && this.recovery !== recovery);
    const previous = recovered ? null : this.previous;
    if (recovered) this.searchJourney = false;
    this.previous = snapshot;
    this.recovery = recovery;
    if (snapshot.phase === 'matchmaking') this.searchJourney = true;
    else if (snapshot.phase === 'in-room') {
      if (previous?.phase !== 'matchmaking' && previous?.room?.id !== snapshot.room.id) this.searchJourney = false;
    } else if (snapshot.phase !== 'in-game') this.searchJourney = false;
    if (snapshot.phase !== 'in-game') return; // Spectating is never playing.
    const game = snapshot.game;
    if (!['red', 'black'].includes(game.yourColor)) return;
    const key = JSON.stringify([this.userId, game.gameId]);
    let record = this.records.get(key);
    const moved = record?.move || hasMoved(game);
    const isNew = !record;
    if (!record) {
      const source = game.enteredViaInvite === true ? 'invite' : game.origin === 'bot' && this.searchJourney ? 'fallback' :
        ['bot', 'quickplay', 'room'].includes(game.origin) ? game.origin : 'unknown';
      // An unknown game restored on connection is a baseline, not a new start
      // or a historical first move/result at today's timestamp.
      const baseline = !previous;
      record = { source, inviteConfirmed: game.enteredViaInvite === true, start: baseline && !!(game.started || game.gameOver || moved),
        move: baseline && moved, end: baseline && !!game.gameOver };
      this.records.set(key, record);
    }
    this.searchJourney = false;
    const events = [];
    const params = { origin: game.origin || 'unknown', recovered: !previous };
    if (!record.start && (game.started || game.gameOver)) {
      record.start = true;
      events.push(['game_start', { ...params, source: record.source, mode: game.mode || '' }]);
    }
    if (!record.move && moved) { record.move = true; events.push(['first_move', params]); }
    if (!record.end && game.gameOver) {
      record.end = true;
      const result = playerGameResult(gameResultCode(game.winner, game.endReason), game.yourColor);
      events.push(['game_end', { ...params, result: result === 'cancelled' ? 'aborted' : result, reason: game.endReason || '' }]);
    }
    // Record attempts before optional analytics calls, including reentrant calls.
    if (isNew || events.length) this.save();
    for (const [event, data] of events) { try { this.track(event, data); } catch {} }
  }
}
