import { withDeadline } from './actions/deadline.js';

// Owns one view's read lifecycle, not business state. A newer request or account
// generation invalidates older completions even if the transport ignores abort.
export class ReadResource {
  constructor({ load, readScope, isCurrent, publish, timeoutMs = 15_000 }) {
    Object.assign(this, { load, readScope, isCurrent, publish, timeoutMs });
    this.sequence = 0;
    this.disposed = false;
    this.request = null;
    this.state = { data: null, status: 'idle', error: null };
    this.publish(this.state);
  }

  current(scope) { return !this.disposed && this.isCurrent(scope); }
  emit(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  cancel() {
    this.sequence++;
    this.request?.abort();
    this.request = null;
  }
  reset() {
    this.cancel();
    if (!this.disposed) this.emit({ data: null, status: 'idle', error: null });
  }
  dispose() { this.disposed = true; this.cancel(); }

  async refresh() {
    if (this.disposed) return false;
    this.cancel();
    const sequence = this.sequence, scope = this.readScope(), controller = new AbortController();
    this.request = controller;
    const current = () => sequence === this.sequence && this.current(scope);
    this.emit({ status: 'loading', error: null });
    try {
      const data = await withDeadline(signal => this.load({ scope, signal }), 'Loading timed out. Please retry.',
        { timeoutMs: this.timeoutMs, signal: controller.signal });
      if (!current()) return false;
      this.emit({ data, status: 'ready', error: null });
      return true;
    } catch (error) {
      if (current()) this.emit({ status: 'error', error: error?.message || 'Could not load. Please retry.' });
      return false;
    } finally {
      if (this.request === controller) this.request = null;
    }
  }
}
