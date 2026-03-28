import {
  MATCHMAKING_BASE_WINDOW,
  MATCHMAKING_WINDOW_GROWTH,
  MATCHMAKING_MAX_WINDOW
} from '../../shared/constants.js';

class RankedQueue {
  constructor() {
    this.players = []; // { userId, elo, socketId, joinedAt }
  }

  add(userId, elo, socketId) {
    // Don't double-add
    if (this.players.some(p => p.userId === userId)) return;
    this.players.push({ userId, elo, socketId, joinedAt: Date.now() });
  }

  remove(userId) {
    this.players = this.players.filter(p => p.userId !== userId);
  }

  removeBySocket(socketId) {
    this.players = this.players.filter(p => p.socketId !== socketId);
  }

  tryMatch() {
    const now = Date.now();
    const matched = [];

    for (let i = 0; i < this.players.length; i++) {
      if (matched.includes(i)) continue;
      const a = this.players[i];
      const waitTime = (now - a.joinedAt) / 1000;
      const window = Math.min(
        MATCHMAKING_BASE_WINDOW + Math.floor(waitTime / 10) * MATCHMAKING_WINDOW_GROWTH,
        MATCHMAKING_MAX_WINDOW
      );

      for (let j = i + 1; j < this.players.length; j++) {
        if (matched.includes(j)) continue;
        const b = this.players[j];
        if (Math.abs(a.elo - b.elo) <= window) {
          matched.push(i, j);
          break;
        }
      }
    }

    // Extract matched pairs and remove from queue
    const pairs = [];
    for (let k = 0; k < matched.length; k += 2) {
      pairs.push([this.players[matched[k]], this.players[matched[k + 1]]]);
    }
    // Remove matched players (iterate in reverse to preserve indices)
    const toRemove = new Set(matched);
    this.players = this.players.filter((_, idx) => !toRemove.has(idx));

    return pairs;
  }

  size() {
    return this.players.length;
  }

  has(userId) {
    return this.players.some(p => p.userId === userId);
  }
}

export const rankedQueue = new RankedQueue();
