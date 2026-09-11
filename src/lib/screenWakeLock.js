// A wake-lock request cannot be cancelled. Each visible target owns its result;
// obsolete results are released instead of being installed after navigation.
export class ScreenWakeLock {
  constructor({ document, request }) {
    this.document = document;
    this.request = request;
    this.target = null;
    this.generation = 0;
    this.pending = null;
    this.held = null;
    this.disposed = false;
    this.onVisibility = () => this.sync();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setTarget(target) {
    if (this.disposed || this.target === target) return;
    this.invalidate();
    this.target = target;
    this.sync();
  }

  release(lock) {
    try { Promise.resolve(lock.release()).catch(() => {}); } catch {}
  }

  invalidate() {
    this.generation++;
    this.pending = null;
    const held = this.held;
    this.held = null;
    if (held) {
      held.lock.removeEventListener?.('release', held.onRelease);
      this.release(held.lock);
    }
  }

  sync() {
    if (this.disposed) return;
    if (this.target === null || this.document.visibilityState !== 'visible') { this.invalidate(); return; }
    if (this.pending || (this.held && !this.held.lock.released)) return;
    const ticket = { generation: this.generation };
    this.pending = ticket;
    const current = () => !this.disposed && ticket.generation === this.generation &&
      this.target !== null && this.document.visibilityState === 'visible';
    ticket.task = Promise.resolve().then(() => current() ? this.request('screen') : null).then(lock => {
      if (!lock) return;
      if (!current()) {
        this.release(lock); return;
      }
      if (lock.released) return;
      const held = { lock, onRelease: () => { if (this.held === held) this.held = null; } };
      this.held = held;
      lock.addEventListener?.('release', held.onRelease, { once: true });
    }).catch(() => { /* Optional capability: refusal never blocks room entry. */ })
      .finally(() => { if (this.pending === ticket) this.pending = null; });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.document.removeEventListener('visibilitychange', this.onVisibility);
    this.invalidate();
  }
}
