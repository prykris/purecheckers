import { puzzleStreak, validPuzzleProgress, validPuzzleAttemptResponse } from '../../../shared/puzzleProgress.js';
import { parsePuzzleDate } from '../../../shared/puzzleDates.js';
import { withDeadline } from '../actions/deadline.js';

const merge = (old = {}, next) => {
  const revealed = old.solved ? !!old.revealed : !!(old.revealed || next.revealed);
  return { ...old, ...next, solved: !revealed && !!(old.solved || next.solved), revealed,
    rewarded: !!old.rewarded, attempts: Math.max(old.attempts ?? 1, next.attempts ?? 1), hintUsed: !!(old.hintUsed || next.hintUsed) };
};
const pending = row => !!row.payload && row.synced !== JSON.stringify(row.payload);
// Server facts are the base; only genuinely pending local work is projected on
// top. A server reveal disqualifies a later local solve, even after reconnect.
function accept(row, confirmed, fingerprint) {
  const wasPending = pending(row), newer = wasPending && JSON.stringify(row.payload) !== fingerprint;
  row.confirmed = confirmed;
  if (row.payload && confirmed.revealed) row.payload = { ...row.payload, solved: false, revealed: true, turns: [] };
  if ((fingerprint !== undefined && !newer) || !wasPending) row.synced = JSON.stringify(row.payload);
  row.progress = pending(row) ? merge(confirmed, row.payload) : { ...confirmed };
}
const mergePayload = (old, next) => old?.solved && !old.revealed
  ? { ...merge(old, next), turns: old.turns, timeMs: Math.max(old.timeMs ?? 0, next.timeMs ?? 0) }
  : next;

const object = value => value && typeof value === 'object' && !Array.isArray(value);
function restoreData(saved, uuid) {
  if (saved?.version !== 1 || !object(saved.scopes) || typeof saved.visitorId !== 'string' || !saved.visitorId) {
    return { version: 1, visitorId: uuid(), scopes: {} };
  }
  const scopes = {};
  for (const [scope, values] of Object.entries(saved.scopes)) {
    if (!/^(visitor|user:[1-9]\d*)$/.test(scope) || !object(values)) continue;
    const records = scopes[scope] = {};
    for (const [date, row] of Object.entries(values)) {
      if (!parsePuzzleDate(date) || !object(row)) continue;
      const progress = { rewarded: false, ...row.progress };
      if (!validPuzzleProgress(progress)) continue;
      const payload = object(row.payload) && validPuzzleProgress({ ...row.payload, rewarded: false }) && Array.isArray(row.payload.turns) ? row.payload : undefined;
      records[date] = { progress, payload, synced: typeof row.synced === 'string' ? row.synced : undefined,
        confirmed: validPuzzleProgress(row.confirmed) ? row.confirmed : undefined };
    }
  }
  return { version: 1, visitorId: saved.visitorId, scopes };
}

// Progress is scoped by account. Anonymous progress can be claimed once on
// login; changing accounts never uploads the previous account's history.
export class PuzzleJournal {
  constructor({ storage, request, uuid, publish = () => {} }) {
    this.storage = storage; this.request = request; this.publish = publish; this.generation = 0;
    this.identity = null; this.running = null; this.disposed = false; this.error = null; this.storageError = null;
    try { this.data = JSON.parse(storage.getItem('checkers_puzzle') ?? 'null'); } catch {}
    this.data = restoreData(this.data, uuid);
    this.save();
  }
  scope() { return this.identity ? 'user:' + this.identity.id : 'visitor'; }
  records() { return this.data.scopes[this.scope()] ??= {}; }
  view() {
    const history = Object.fromEntries(Object.entries(this.records()).map(([date, row]) => [date, row.progress]));
    const pending = Object.fromEntries(Object.entries(this.records()).map(([date, row]) => [date, !!row.payload && row.synced !== JSON.stringify(row.payload)]));
    return { history, pending, scope: this.scope(), streak: puzzleStreak(history), syncing: !!this.running, error: this.error, storageError: this.storageError };
  }
  save() {
    if (this.disposed) return;
    try { this.storage.setItem('checkers_puzzle', JSON.stringify(this.data)); this.storageError = null; }
    catch { this.storageError = 'Progress cannot be stored in this browser. Keep this page open until it syncs.'; }
    this.publish(this.view());
  }
  setIdentity(identity) {
    if (this.disposed || (identity?.id === this.identity?.id && identity?.token === this.identity?.token && identity?.generation === this.identity?.generation)) return;
    this.generation++; this.abort?.abort(); this.identity = identity; this.error = null;
    if (identity) {
      const records = this.records();
      for (const [date, row] of Object.entries(this.data.scopes.visitor ?? {})) {
        const previous = records[date];
        records[date] = { ...previous, progress: merge(previous?.progress, row.progress),
          payload: row.payload ? mergePayload(previous?.payload, row.payload) : previous?.payload, synced: null };
      }
      this.data.scopes.visitor = {};
    }
    this.save(); void this.sync();
  }
  record(date, payload) {
    if (this.disposed) return;
    const previous = this.records()[date];
    const next = mergePayload(previous?.payload, payload);
    this.records()[date] = { ...previous, progress: merge(previous?.confirmed ?? previous?.progress, next), payload: next };
    this.queued = true; this.save(); void this.sync();
  }
  async sync() {
    if (this.disposed || this.running) return this.running;
    const generation = this.generation, scope = this.scope(), identity = this.identity;
    this.queued = false; let failed = false; this.error = null;
    const abort = new AbortController(); this.abort = abort;
    const request = (url, options) => withDeadline(signal => this.request(url, {
      ...options, generation: identity?.generation, signal: AbortSignal.any([signal, abort.signal])
    }), 'Saving puzzle progress timed out. Retry to confirm it.');
    const work = async () => {
      const records = this.data.scopes[scope] ?? {};
      for (const [date, row] of Object.entries(records)) {
        if (this.disposed || generation !== this.generation) return;
        if (!row.payload) continue;
        const fingerprint = JSON.stringify(row.payload);
        if (row.synced === fingerprint) continue;
        try {
          const result = await request('/api/puzzle/' + date + '/attempt', { method: 'POST',
            token: identity?.token, signal: abort.signal, body: { ...row.payload, visitorId: this.data.visitorId } });
          if (this.disposed || generation !== this.generation) return;
          if (!validPuzzleAttemptResponse(result)) throw new Error('Invalid progress confirmation. Retry to confirm it.');
          // A newer local attempt must remain pending while this older ack arrives.
          const live = records[date];
          if (JSON.stringify(live.payload) === fingerprint) live.synced = fingerprint;
          accept(live, result.attempt, fingerprint); this.save();
        } catch (error) {
          if (this.disposed || generation !== this.generation) return;
          failed = true; this.error = error.message || 'Progress could not be saved. Retry to confirm it.'; this.save(); return;
        } // Keep pending progress for online, focus or explicit retry.
      }
      if (identity) {
        try {
          const result = await request('/api/puzzle/history', { token: identity.token, signal: abort.signal });
          if (this.disposed || generation !== this.generation) return;
          if (!result?.history || typeof result.history !== 'object' || Array.isArray(result.history)
            || !Object.entries(result.history).every(([date, progress]) => parsePuzzleDate(date) && validPuzzleProgress(progress))) {
            throw new Error('Invalid puzzle history. Refresh to load it again.');
          }
          for (const date of Object.keys(records)) {
            if (!(date in result.history) && !pending(records[date])) delete records[date];
          }
          for (const [date, progress] of Object.entries(result.history)) {
            const row = records[date] ??= { progress: {} };
            accept(row, progress);
          }
          this.save();
        } catch (error) {
          if (this.disposed || generation !== this.generation) return;
          failed = true; this.error = error.message || 'Puzzle history could not be loaded. Retry to refresh it.'; this.save();
        }
      }
    };
    this.running = work().finally(() => {
      this.running = null;
      if (!this.disposed) this.save();
      if (!this.disposed && (generation !== this.generation || (this.queued && !failed))) void this.sync();
    });
    this.save();
    return this.running;
  }
  dispose() { this.disposed = true; this.generation++; this.abort?.abort(); }
}
