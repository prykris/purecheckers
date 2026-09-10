import { PROTOCOL_VERSION, COMMAND_TTL_MS, validSnapshot } from '../../shared/protocol.js';

// Transport-independent session client; tested with lost acknowledgements,
// replacement transports and out-of-order snapshots. No component owns recovery.
export class SessionClient {
  constructor({ publish, now = Date.now, id = () => crypto.randomUUID(), retryMs = 2000 }) {
    this.publish = publish; this.now = now; this.id = id; this.retryMs = retryMs;
    this.state = { snapshot: null, status: 'disconnected', pending: null, error: null, recovery: 0 };
    this.socket = null; this.listeners = []; this.timer = null; this.command = null;
  }
  update(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  bind(socket) {
    this.unbind(); this.socket = socket;
    const listen = (event, fn) => { socket.on(event, fn); this.listeners.push([event, fn]); };
    listen('connect', () => this.recover());
    listen('disconnect', reason => {
      clearTimeout(this.timer); clearTimeout(this.snapshotTimer);
      this.update({ status: reason === 'io server disconnect' ? 'replaced' : 'reconnecting' });
    });
    listen('connect_error', () => this.update({ status: socket.active ? 'reconnecting' : 'disconnected' }));
    listen('session:kicked', () => { this.finish({ ok: false, error: 'Session replaced' }); this.update({ status: 'replaced' }); });
    listen('sync:state', snapshot => this.accept(snapshot));
    if (socket.connected) this.recover(); else this.update({ status: 'reconnecting' });
  }
  accept(snapshot) {
    if (this.state.status === 'replaced' || !this.socket?.connected || !validSnapshot(snapshot) || snapshot.connectionId !== this.socket.id) return false;
    const previous = this.state.snapshot;
    if (previous?.serverId === snapshot.serverId && snapshot.sequence <= previous.sequence) return false;
    if (previous && previous.serverId !== snapshot.serverId && this.state.status === 'ready') return false;
    const recovering = this.state.status !== 'ready';
    clearTimeout(this.snapshotTimer);
    this.receivedAt = this.now();
    this.update({ snapshot: freeze(snapshot), status: 'ready', recovery: this.state.recovery + Number(recovering) });
    if (this.command) {
      if (this.command.request.serverId !== snapshot.serverId) this.finish({ ok: false, error: 'Server restarted. State refreshed; please try again.' });
      else if (recovering) this.transmit();
    }
    return true;
  }
  recover() {
    if (!this.socket?.connected || this.state.status === 'replaced') return;
    this.update({ status: 'syncing' });
    this.requestSnapshot();
  }
  requestSnapshot() {
    clearTimeout(this.snapshotTimer);
    const socket = this.socket;
    if (!socket?.connected) return;
    socket.emit('sync:request', {}, snapshot => { if (this.socket === socket) this.accept(snapshot); });
    this.snapshotTimer = setTimeout(() => { if (this.state.status !== 'ready') this.requestSnapshot(); }, this.retryMs);
  }
  send(type, data = {}) {
    if (this.state.status !== 'ready' || !this.socket?.connected) return Promise.resolve({ ok: false, error: 'Waiting for the server connection' });
    if (this.command) return Promise.resolve({ ok: false, error: 'A request is still being confirmed' });
    const snapshot = this.state.snapshot;
    const request = {
      protocolVersion: PROTOCOL_VERSION, id: this.id(), type, data: structuredClone(data),
      serverId: snapshot.serverId, context: snapshot.context,
      createdAt: snapshot.serverTime + (this.now() - this.receivedAt),
    };
    return new Promise(resolve => {
      this.command = { request, resolve, startedAt: this.now() };
      this.update({ pending: type, error: null });
      this.transmit();
    });
  }
  transmit() {
    if (!this.command || !this.socket?.connected || this.state.status !== 'ready') return;
    const command = this.command, socket = this.socket, connectionId = socket.id;
    if (this.now() - command.startedAt >= COMMAND_TTL_MS - this.retryMs) {
      this.finish({ ok: false, error: 'Confirmation timed out. State refreshed; check the result before retrying.' });
      this.recover(); return;
    }
    socket.emit('session:command', command.request, result => {
      if (this.socket !== socket || socket.id !== connectionId || this.command !== command) return;
      if (result?.snapshot) this.accept(result.snapshot);
      if (!validSnapshot(result?.snapshot)) {
        this.finish({ ok: false, error: 'Confirmation was incomplete. Recovering server state.' });
        this.recover();
      } else this.finish(result);
    });
    this.scheduleRetry();
  }
  scheduleRetry() { clearTimeout(this.timer); if (this.command) this.timer = setTimeout(() => this.transmit(), this.retryMs); }
  finish(result) {
    clearTimeout(this.timer);
    const command = this.command; this.command = null;
    if (command) { this.update({ pending: null, error: result.ok ? null : result.error }); command.resolve(result); }
  }
  unbind() {
    clearTimeout(this.timer); clearTimeout(this.snapshotTimer);
    if (this.socket) for (const [event, fn] of this.listeners) this.socket.off(event, fn);
    this.listeners = []; this.socket = null;
    this.finish({ ok: false, error: 'Session closed' });
    this.update({ snapshot: null, status: 'disconnected', error: null });
  }
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
