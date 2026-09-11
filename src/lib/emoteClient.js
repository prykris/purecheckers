import { ReadResource } from './readResource.js';

// Emotes are transient notifications: read recovery is automatic, sends never
// replay after an uncertain acknowledgement or a changed game/connection.
export class EmoteClient {
  constructor({ load, send, canSend, readScope, isCurrent, publish }) {
    Object.assign(this, { send, canSend, readScope, publish });
    this.state = { emotes: [], status: 'idle', readError: null, error: null, sending: false };
    this.resource = new ReadResource({ readScope, isCurrent, load: async context => {
      const data = await load(context);
      if (!Array.isArray(data?.emotes) || data.emotes.some(e => !Number.isSafeInteger(e?.id) || e.id < 1 || typeof e.name !== 'string' || typeof e.emoji !== 'string' || typeof e.label !== 'string')) throw Error('Could not confirm emotes. Please refresh.');
      return data;
    }, publish: value => this.emit({ emotes: value.data?.emotes ?? [], status: value.status, readError: value.error }) });
  }
  emit(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  reset() { this.emit({ sending: false, error: null }); this.resource.reset(); }
  dispose() { this.resource.dispose(); }
  refresh() { return this.resource.refresh(); }

  async sendItem(itemId) {
    if (this.resource.disposed || this.state.sending || !this.canSend() || !this.state.emotes.some(e => e.id === itemId)) return false;
    const scope = this.readScope();
    this.emit({ sending: true, error: null });
    try {
      const result = await this.send(itemId, scope);
      if (!this.resource.current(scope)) return false;
      if (result?.ok !== true) {
        this.emit({ error: result?.error || 'Emote delivery was not confirmed. You can try again.' });
        if (result?.code === 'EMOTE_UNAVAILABLE') await this.refresh();
        return false;
      }
      return true;
    } catch {
      if (this.resource.current(scope)) this.emit({ error: 'Emote delivery was not confirmed. You can try again.' });
      return false;
    } finally { if (this.resource.current(scope)) this.emit({ sending: false }); }
  }
}
