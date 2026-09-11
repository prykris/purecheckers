import { ReadResource } from './readResource.js';
import { FRIENDSHIP_CHANGED } from '../../shared/friendshipActions.js';

// Every friendship surface has the same account, notification and recovery lifecycle.
export function bindFriendsClient({ client, user, capture, socket, onFocus, isVisible = () => true, isBusy = () => false, onIdentityChange = () => {} }) {
  let generation, accountId;
  const unsubscribe = user.subscribe(value => {
    const next = capture().generation;
    if (generation === next && accountId === value?.id) return;
    generation = next; accountId = value?.id; client.reset(); onIdentityChange();
    if (value) void client.refresh();
  });
  const refresh = () => {
    if (capture().token && isVisible() && !isBusy()) client.invalidate();
  };
  const heartbeat = () => { if (client.state.status !== 'loading') refresh(); };
  socket?.on('connect', refresh); socket?.on('presence:stats', heartbeat); socket?.on(FRIENDSHIP_CHANGED, refresh);
  const offFocus = onFocus(refresh);
  return () => {
    unsubscribe(); client.dispose(); offFocus();
    socket?.off('connect', refresh); socket?.off('presence:stats', heartbeat); socket?.off(FRIENDSHIP_CHANGED, refresh);
  };
}

const confirmation = { request: 'Friend request sent.', accept: 'Friend request accepted.', remove: 'Friendship removed.', tip: 'Tip confirmed.' };
export class FriendsClient {
  constructor({ load, perform, tip, readScope, isCurrent, publish }) {
    Object.assign(this, { perform, tip, readScope, publish });
    this.invalidated = false;
    this.state = { data: null, status: 'idle', readError: null, error: null, success: null, action: null };
    this.resource = new ReadResource({ readScope, isCurrent, load: async context => {
      const data = await load(context);
      if (!data || !['friends', 'requests', 'outgoing'].every(key => Array.isArray(data[key]))) throw Error('Could not confirm friends data. Please refresh.');
      return data;
    }, publish: value => this.emit({ data: value.data, status: value.status, readError: value.error }) });
  }
  emit(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  reset() { this.invalidated = false; this.emit({ action: null, error: null, success: null }); this.resource.reset(); }
  dispose() { this.resource.dispose(); }
  invalidate() { this.invalidated = true; this.drainInvalidation(); }
  drainInvalidation() {
    if (!this.invalidated || this.resource.disposed || this.state.action || this.state.status === 'loading') return;
    this.invalidated = false; void this.refresh();
  }
  async refresh() {
    if (this.resource.disposed || this.state.action) return false;
    this.emit({ error: null });
    const result = await this.resource.refresh();
    this.drainInvalidation();
    return result;
  }
  async confirmed(kind) {
    if (this.resource.disposed) return;
    this.emit({ success: confirmation[kind] || 'Action confirmed.' });
    await this.refresh();
  }
  async act(kind, payload) {
    if (this.resource.disposed || this.state.action || this.state.status !== 'ready' || !Object.hasOwn(confirmation, kind)) return false;
    const scope = this.readScope();
    this.emit({ action: kind, error: null, success: null });
    try {
      const receipt = await (kind === 'tip' ? this.tip(payload) : this.perform(kind, payload));
      if (!receipt || !this.resource.current(scope)) return false;
      this.emit({ success: confirmation[kind] });
      const fresh = await this.resource.refresh();
      if (!this.resource.current(scope)) return false;
      if (!fresh) this.emit({ error: 'Action confirmed. Refresh to load the latest friends list.' });
      return true;
    } catch (error) {
      if (this.resource.current(scope)) { this.emit({ error: error.message }); await this.resource.refresh(); }
      return false;
    } finally { if (this.resource.current(scope)) { this.emit({ action: null }); this.drainInvalidation(); } }
  }
}
