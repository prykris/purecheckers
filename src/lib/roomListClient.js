/** One acknowledged list plus ordered changes; filters never start competing reads. */
export class RoomListClient {
  constructor({ publish, timeoutMs = 8000 }) {
    this.publish = publish; this.timeoutMs = timeoutMs;
    this.state = { rooms: null, loading: false, error: null }; this.generation = 0; this.revision = -1;
  }
  update(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  bind(socket) {
    this.dispose(); this.socket = socket;
    const refresh = () => this.refresh();
    const disconnect = () => { this.cancel(); this.update({ loading: false, error: 'Rooms are offline. Reconnecting…' }); };
    const change = value => {
      if (!Number.isSafeInteger(value?.revision) || !value.room?.id) return;
      if (this.changes) this.changes.push(value);
      this.apply(value);
    };
    socket.on('connect', refresh); socket.on('disconnect', disconnect); socket.on('room:list-update', change);
    this.detach = () => { socket.off('connect', refresh); socket.off('disconnect', disconnect); socket.off('room:list-update', change); };
    if (socket.connected) this.refresh(); else this.update({ loading: false, error: 'Rooms are reconnecting…' });
  }
  cancel() { this.generation++; clearTimeout(this.timer); this.changes = null; }
  apply({ revision, room }) {
    if (revision <= this.revision || this.state.rooms === null) return;
    this.revision = revision;
    const rooms = this.state.rooms.filter(r => r.id !== room.id);
    if (!room.closed) rooms.push(room);
    this.update({ rooms });
  }
  refresh() {
    this.cancel(); this.revision = -1;
    if (!this.socket?.connected) { this.update({ loading: false, error: 'Rooms are offline. Reconnect and retry.' }); return; }
    const generation = this.generation; this.changes = [];
    this.update({ loading: true, error: null });
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.cancel(); this.update({ loading: false, error: 'Could not load rooms. Please retry.' });
    }, this.timeoutMs);
    this.socket.emit('room:list', {}, response => {
      if (generation !== this.generation) return;
      clearTimeout(this.timer);
      const changes = this.changes || []; this.changes = null;
      if (!response?.ok || !Array.isArray(response.rooms) || !Number.isSafeInteger(response.revision)) {
        this.update({ loading: false, error: response?.error || 'Could not load rooms. Please retry.' }); return;
      }
      this.revision = response.revision;
      this.update({ rooms: response.rooms, loading: false, error: null });
      for (const change of changes.sort((a, b) => a.revision - b.revision)) this.apply(change);
    });
  }
  dispose() { this.cancel(); this.detach?.(); this.detach = null; this.socket = null; this.update({ rooms: null, loading: false, error: null }); }
}
