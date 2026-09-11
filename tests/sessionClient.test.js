import { SessionClient } from '../src/lib/sessionClient.js';
import { PROTOCOL_VERSION, COMMAND_TTL_MS } from '../shared/protocol.js';

class Transport {
  constructor(id = 'connection-1') { this.id = id; this.connected = true; this.active = true; this.listeners = new Map(); this.sent = []; }
  on(event, fn) { const entries = this.listeners.get(event) || []; entries.push(fn); this.listeners.set(event, entries); }
  off(event, fn) { this.listeners.set(event, (this.listeners.get(event) || []).filter(item => item !== fn)); }
  emit(event, data, ack) { this.sent.push({ event, data, ack }); }
  receive(event, data) { for (const fn of this.listeners.get(event) || []) fn(data); }
  commands() { return this.sent.filter(message => message.event === 'session:command'); }
}
function snapshot(sequence = 1, extra = {}) {
  return { protocolVersion: PROTOCOL_VERSION, serverId: 'server-1', sequence, connectionId: 'connection-1', serverTime: Date.now(),
    context: { gameId: null, roomId: null, spectatingRoomId: null }, phase: 'idle', room: null, game: null, spectate: null, ...extra };
}
let client, transport, published;
beforeEach(() => { vi.useFakeTimers(); published = []; client = new SessionClient({ publish: state => published.push(state), id: () => 'command-1' }); transport = new Transport(); client.bind(transport); });
afterEach(() => { client.unbind(); vi.useRealTimers(); });
const accept = value => transport.receive('sync:state', value);

describe('session recovery coordinator', () => {
  it('gates input until the first complete snapshot and exposes an immutable snapshot', async () => {
    expect((await client.send('room:create')).ok).toBe(false);
    expect(published.at(-1).error).toBe('Waiting for the server connection');
    accept(snapshot()); expect(client.state.status).toBe('ready');
    expect(Object.isFrozen(client.state.snapshot)).toBe(true); expect(Object.isFrozen(client.state.snapshot.context)).toBe(true);
  });
  it('ignores duplicate, stale, malformed and foreign-connection snapshots', () => {
    accept(snapshot(3));
    for (const packet of [snapshot(1), snapshot(3), snapshot(4, { connectionId: 'old' }), snapshot(4, { phase: 'in-game' }), snapshot(4, { protocolVersion: 9 })]) accept(packet);
    expect(client.state.snapshot.sequence).toBe(3);
  });
  it('converges to the newest complete state despite arbitrary reordering and duplication', () => {
    const packets = Array.from({ length: 200 }, (_, i) => snapshot(i + 1));
    for (let i = 199; i >= 0; i--) { accept(packets[(i * 73) % 200]); accept(packets[(i * 73) % 200]); }
    expect(client.state.snapshot.sequence).toBe(200);
  });
  it('retries exactly the same command after a lost acknowledgement, independent of clock snapshots', async () => {
    accept(snapshot()); const pending = client.send('room:create', { turnTimer: 30 });
    accept(snapshot(2)); vi.advanceTimersByTime(1000); accept(snapshot(3)); vi.advanceTimersByTime(1000);
    const commands = transport.commands(); expect(commands).toHaveLength(2); expect(commands[1].data).toEqual(commands[0].data);
    commands[1].ack({ ok: true, snapshot: snapshot(4) }); expect((await pending).ok).toBe(true);
    vi.advanceTimersByTime(4000); expect(transport.commands()).toHaveLength(2);
  });
  it('applies rejection state before clearing pending input', async () => {
    accept(snapshot()); const pending = client.send('room:create');
    transport.commands()[0].ack({ ok: false, error: 'Cannot afford buy-in', snapshot: snapshot(2) });
    expect(await pending).toMatchObject({ ok: false }); expect(client.state.snapshot.sequence).toBe(2);
    expect(client.state.pending).toBeNull(); expect(client.state.error).toBe('Cannot afford buy-in');
  });
  it('prevents a second command while confirmation is pending and never predicts the phase', async () => {
    accept(snapshot()); client.send('room:create');
    expect((await client.send('matchmaking:join')).ok).toBe(false); expect(transport.commands()).toHaveLength(1);
    expect(published.at(-1).error).toBe('A request is still being confirmed');
    expect(client.state.snapshot.phase).toBe('idle');
  });
  it('keeps pending intent across disconnect, waits for recovery and ignores old acknowledgements', async () => {
    accept(snapshot()); const pending = client.send('room:create'); const old = transport.commands()[0];
    transport.connected = false; transport.receive('disconnect', 'transport close'); vi.advanceTimersByTime(5000);
    expect(transport.commands()).toHaveLength(1);
    transport.id = 'connection-2'; transport.connected = true; transport.receive('connect');
    expect(transport.commands()).toHaveLength(1);
    accept(snapshot(2, { connectionId: 'connection-2' }));
    expect(transport.commands()).toHaveLength(2); expect(transport.commands()[1].data.id).toBe(old.data.id);
    old.ack({ ok: true, snapshot: snapshot(8) }); expect(client.state.pending).toBe('room:create');
    transport.commands()[1].ack({ ok: true, snapshot: snapshot(3, { connectionId: 'connection-2' }) });
    expect((await pending).ok).toBe(true); expect(client.state.recovery).toBe(2);
  });
  it('abandons old-server commands and replaces the entire context after server restart', async () => {
    accept(snapshot()); const pending = client.send('room:create');
    transport.receive('disconnect', 'transport close'); transport.receive('connect');
    accept(snapshot(1, { serverId: 'server-2' }));
    expect((await pending).ok).toBe(false); expect(client.state.snapshot.serverId).toBe('server-2');
    expect(transport.commands()).toHaveLength(1);
  });
  it('does not accept an unexpected server epoch while already synchronized', () => {
    accept(snapshot()); accept(snapshot(99, { serverId: 'different' })); expect(client.state.snapshot.serverId).toBe('server-1');
  });
  it('expires uncertain commands, requests recovery and does not keep replaying them', async () => {
    accept(snapshot()); const pending = client.send('room:create'); vi.advanceTimersByTime(COMMAND_TTL_MS);
    expect((await pending).ok).toBe(false); expect(client.state.status).toBe('syncing');
    const count = transport.commands().length; vi.advanceTimersByTime(10000); expect(transport.commands()).toHaveLength(count);
  });
  it('retries snapshot recovery when its reply is dropped', () => {
    const before = transport.sent.length; vi.advanceTimersByTime(2000); expect(transport.sent.length).toBeGreaterThan(before);
    accept(snapshot()); const count = transport.sent.length; vi.advanceTimersByTime(5000); expect(transport.sent).toHaveLength(count);
  });
  it('does not silently recover a superseded tab or let late data revive it', () => {
    accept(snapshot()); transport.receive('session:kicked'); accept(snapshot(9)); transport.receive('connect');
    expect(client.state.status).toBe('replaced'); expect(client.state.snapshot.sequence).toBe(1);
  });
  it('removes only its own listeners and cancels work when unbound', async () => {
    const unrelated = vi.fn(); transport.on('sync:state', unrelated); accept(snapshot()); const pending = client.send('room:create');
    client.unbind(); expect((await pending).ok).toBe(false); expect(client.state.snapshot).toBeNull();
    transport.receive('sync:state', snapshot(5)); expect(unrelated).toHaveBeenCalledTimes(2); expect(client.state.snapshot).toBeNull();
  });
  it('copies command data and uses server time even if the device clock is wrong', () => {
    accept(snapshot(1, { serverTime: 1000 })); vi.advanceTimersByTime(100);
    const data = { ready: true }; client.send('room:ready', data); data.ready = false;
    expect(transport.commands()[0].data.createdAt).toBe(1100); expect(transport.commands()[0].data.data.ready).toBe(true);
  });
  it('recovers after an incomplete acknowledgement instead of enabling input on uncertain state', async () => {
    accept(snapshot()); const pending = client.send('room:create'); transport.commands()[0].ack({ ok: true });
    expect((await pending).ok).toBe(false); expect(client.state.status).toBe('syncing');
  });
});
