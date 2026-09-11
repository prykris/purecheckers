// One outstanding intent per account in this browser tab. Persist before sending,
// retain uncertain outcomes, and isolate replies by account generation.
export class ActionJournal {
  constructor({ storage, uuid, send, publish, confirm = async () => {}, validIntent, validReceipt, namespace, label = 'Action' }) {
    Object.assign(this, { storage, uuid, send, publish, confirm, validIntent, validReceipt, namespace, label });
    this.userId = null;
    this.generation = 0;
    this.pending = null;
    this.busy = false;
    this.blocked = false;
    this.error = '';
  }

  emit() { this.publish({ pending: this.pending, busy: this.busy, blocked: this.blocked, error: this.error }); }
  storageKey() { return `purecheckers:${this.namespace}:v1:${this.userId}`; }

  setIdentity(userId, identityGeneration = null) {
    if (this.userId === userId && this.identityGeneration === identityGeneration) return;
    this.userId = userId;
    this.identityGeneration = identityGeneration;
    this.generation++;
    this.pending = null; this.busy = false; this.blocked = false; this.error = '';
    if (userId) {
      try {
        const raw = this.storage.getItem(this.storageKey());
        if (raw) {
          const intent = JSON.parse(raw);
          if (!this.validIntent(intent)) throw new Error('Invalid saved action');
          this.pending = intent;
        }
      } catch {
        this.blocked = true;
        this.error = 'Saved action information could not be read. Actions are paused in this tab.';
      }
    }
    this.emit();
  }

  async start(kind, payload) {
    if (!this.userId || this.blocked) throw new Error('Actions are unavailable');
    if (this.pending || this.busy) throw new Error('Confirm the pending action before starting another');
    const intent = { kind, payload: structuredClone(payload), requestId: this.uuid() };
    if (!this.validIntent(intent)) throw new Error('Invalid action');
    try { this.storage.setItem(this.storageKey(), JSON.stringify(intent)); }
    catch { throw new Error('Enable browser storage before sending an action'); }
    this.pending = intent;
    return this.retry();
  }

  async retry() {
    if (!this.pending || this.busy || this.blocked) return null;
    const generation = this.generation;
    const intent = structuredClone(this.pending);
    this.busy = true; this.error = ''; this.emit();
    try {
      const receipt = await this.send(intent.kind, { ...intent.payload, requestId: intent.requestId });
      if (generation !== this.generation) return null;
      if (!this.validReceipt(receipt, intent, this.userId)) throw new Error('The action response could not be confirmed');
      try { await this.confirm(receipt); }
      catch {
        if (generation === this.generation) this.error = `${typeof this.label === 'function' ? this.label(intent) : this.label} confirmed. Your account could not be refreshed; reload to see its latest state.`;
      }
      if (generation !== this.generation) return null;
      this.clear();
      return receipt;
    } catch (error) {
      if (generation !== this.generation) return null;
      // These responses explicitly reject the command. Timeouts, rate limits and
      // server/network failures leave its result uncertain and retain the ID.
      if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) this.clear();
      this.error = error.message;
      throw error;
    } finally {
      if (generation === this.generation) { this.busy = false; this.emit(); }
    }
  }

  clear() {
    // If storage cleanup fails, keep the safely retryable intent visible.
    this.storage.removeItem(this.storageKey());
    this.pending = null;
  }
}
