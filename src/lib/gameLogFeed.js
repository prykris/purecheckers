import { ReadResource } from './readResource.js';

// Socket events invalidate a read; they are never a second game-history writer.
// Coalesce hints received during a read into one follow-up request so an older
// response cannot hide a newly committed game or starve under frequent updates.
export class GameLogFeed {
  constructor({ request, isCurrent, publish }) {
    this.query = null; this.socket = null; this.started = false;
    this.reading = false; this.dirty = false; this.disposed = false; this.epoch = 0;
    this.resource = new ReadResource({
      readScope: () => this.query,
      isCurrent: scope => scope === this.query && isCurrent(scope.identity),
      load: async ({ scope, signal }) => {
        const data = await request(scope.mine ? '/auth/history' : '/leaderboard/games',
          { signal, authToken: scope.mine ? scope.identity.token : null });
        if (!Array.isArray(data?.games) || data.games.some(game => !game || !Number.isSafeInteger(game.id) || game.id <= 0 ||
            !Number.isSafeInteger(game.redPlayerId) || game.redPlayerId <= 0 ||
            !Number.isSafeInteger(game.blackPlayerId) || game.blackPlayerId <= 0)) throw Error('Invalid game history response. Please retry.');
        return data.games.map(game => ({ ...game, result: game.resultCode ?? game.result }));
      }, publish
    });
    this.invalidate = () => { void this.refresh(); };
  }
  setQuery(mine, identity) {
    const before = this.query;
    if (before && before.mine === mine && before.identity.id === identity.id && before.identity.generation === identity.generation) {
      before.identity = identity; // Token renewal changes the next read, not ownership.
      return;
    }
    this.epoch++; this.reading = false; this.dirty = false;
    this.query = { mine, identity }; this.resource.reset();
    if (this.started) void this.refresh();
  }
  start(socket) {
    if (this.started || this.disposed) return;
    this.started = true; this.socket = socket;
    socket?.on('global:game-ended', this.invalidate);
    socket?.on('connect', this.invalidate);
    void this.refresh();
  }
  async refresh() {
    if (this.disposed || !this.query || (this.query.mine && !this.query.identity.id)) return;
    if (this.reading) { this.dirty = true; return; }
    const epoch = this.epoch;
    this.reading = true; this.dirty = false;
    try { await this.resource.refresh(); }
    finally {
      if (this.disposed || epoch !== this.epoch) return;
      this.reading = false;
      if (this.dirty) void this.refresh();
    }
  }
  dispose() {
    this.disposed = true; this.epoch++;
    this.socket?.off('global:game-ended', this.invalidate);
    this.socket?.off('connect', this.invalidate);
    this.resource.dispose();
  }
}
