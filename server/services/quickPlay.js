/**
 * Quick play matchmaking — pairs waiting players and creates rooms.
 *
 * Prioritizes registered-vs-registered (RANKED), falls back to mixed/guest
 * matches (FRIENDLY). Uses ELO-window matching with expanding window over time.
 */
import {
  MATCHMAKING_BASE_WINDOW,
  MATCHMAKING_WINDOW_GROWTH,
  MATCHMAKING_MAX_WINDOW
} from '../../shared/constants.js';

class QuickPlayPool {
  constructor() {
    this.players = []; // { userId, elo, isGuest, joinedAt }
  }

  add(userId, elo, isGuest) {
    if (this.players.some(p => p.userId === userId)) return;
    this.players.push({ userId, elo, isGuest, joinedAt: Date.now() });
  }

  remove(userId) {
    this.players = this.players.filter(p => p.userId !== userId);
  }

  /**
   * Try to match players. Returns an array of pairs:
   * [{ a, b, mode }] where a/b are player objects and mode is 'RANKED' or 'FRIENDLY'.
   */
  tryMatch() {
    const now = Date.now();
    const matched = new Set();
    const pairs = [];

    const registered = [];
    const guests = [];

    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].isGuest) {
        guests.push(i);
      } else {
        registered.push(i);
      }
    }

    // Pass 1: registered-vs-registered (RANKED)
    this._matchWithinGroup(registered, now, matched, pairs, 'RANKED');

    // Pass 2: guest-vs-guest (FRIENDLY)
    this._matchWithinGroup(guests, now, matched, pairs, 'FRIENDLY');

    // Pass 3: remaining registered-vs-guest (FRIENDLY) — only for players waiting 10s+
    const remainingRegistered = registered.filter(i => !matched.has(i));
    const remainingGuests = guests.filter(i => !matched.has(i));
    for (const ri of remainingRegistered) {
      if (matched.has(ri)) continue;
      const a = this.players[ri];
      const waitTime = (now - a.joinedAt) / 1000;
      if (waitTime < 10) continue; // Only fall back after 10 seconds

      const window = this._eloWindow(waitTime);
      for (const gi of remainingGuests) {
        if (matched.has(gi)) continue;
        const b = this.players[gi];
        if (Math.abs(a.elo - b.elo) <= window) {
          matched.add(ri);
          matched.add(gi);
          pairs.push({ a, b, mode: 'FRIENDLY' });
          break;
        }
      }
    }

    // Remove matched players
    this.players = this.players.filter((_, idx) => !matched.has(idx));

    return pairs;
  }

  _matchWithinGroup(indices, now, matched, pairs, mode) {
    for (let i = 0; i < indices.length; i++) {
      const ai = indices[i];
      if (matched.has(ai)) continue;
      const a = this.players[ai];
      const waitTime = (now - a.joinedAt) / 1000;
      const window = this._eloWindow(waitTime);

      for (let j = i + 1; j < indices.length; j++) {
        const bi = indices[j];
        if (matched.has(bi)) continue;
        const b = this.players[bi];
        if (Math.abs(a.elo - b.elo) <= window) {
          matched.add(ai);
          matched.add(bi);
          pairs.push({ a, b, mode });
          break;
        }
      }
    }
  }

  _eloWindow(waitTimeSeconds) {
    return Math.min(
      MATCHMAKING_BASE_WINDOW + Math.floor(waitTimeSeconds / 10) * MATCHMAKING_WINDOW_GROWTH,
      MATCHMAKING_MAX_WINDOW
    );
  }

  size() {
    return this.players.length;
  }

  has(userId) {
    return this.players.some(p => p.userId === userId);
  }
}

export const quickPlayPool = new QuickPlayPool();
