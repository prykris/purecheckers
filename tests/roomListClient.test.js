import { RoomListClient } from '../src/lib/roomListClient.js';
import { filterRooms } from '../shared/roomList.js';

const room = (id, extra = {}) => ({ id, settings: { buyIn: 0 }, status: 'waiting', players: [{ userId: id }], createdAt: id, ...extra });
let client, socket;
beforeEach(() => {
  vi.useFakeTimers();
  socket = { connected: true, callbacks: {}, sent: [],
    on(event, callback) { this.callbacks[event] = callback; }, off(event) { delete this.callbacks[event]; },
    emit(event, data, ack) { this.sent.push({ event, data, ack }); } };
  client = new RoomListClient({ publish: () => {}, timeoutMs: 100 }); client.bind(socket);
});
afterEach(() => { client.dispose(); vi.useRealTimers(); });
const reply = (rooms, revision) => ({ ok: true, rooms, revision });
it('merges newer changes into a delayed complete list without reviving closed rooms', () => {
  socket.callbacks['room:list-update']({ room: { id: 1, closed: true }, revision: 2 });
  socket.callbacks['room:list-update']({ room: room(2), revision: 3 });
  socket.sent[0].ack(reply([room(1)], 1));
  expect(client.state.rooms.map(r => r.id)).toEqual([2]);
  socket.callbacks['room:list-update']({ room: room(1), revision: 1 });
  expect(client.state.rooms.map(r => r.id)).toEqual([2]);
});
it('does not regress a complete list with an older queued update', () => {
  socket.callbacks['room:list-update']({ room: room(1), revision: 1 });
  socket.sent[0].ack(reply([room(1, { status: 'playing' })], 2));
  expect(client.state.rooms[0].status).toBe('playing');
});
it('distinguishes timeout from empty and ignores responses from a previous connection', () => {
  const old = socket.sent[0]; vi.advanceTimersByTime(100);
  expect(client.state).toMatchObject({ rooms: null, loading: false }); expect(client.state.error).toBeTruthy();
  socket.callbacks.connect(); old.ack(reply([room(1)], 50));
  socket.sent.at(-1).ack(reply([], 0)); expect(client.state).toMatchObject({ rooms: [], error: null, loading: false });
});
it('shares consistent filters across list snapshots and live updates without another request', () => {
  socket.sent[0].ack(reply([room(1), room(2, { settings: { buyIn: 5 } }), room(3, { status: 'starting' })], 3));
  expect(filterRooms(client.state.rooms, 'free').map(r => r.id)).toEqual([1, 3]);
  expect(filterRooms(client.state.rooms, 'available').map(r => r.id)).toEqual([1, 2]);
  socket.callbacks['room:list-update']({ room: room(2, { players: [{}, {}] }), revision: 4 });
  expect(filterRooms(client.state.rooms, 'available').map(r => r.id)).toEqual([1]);
  expect(socket.sent).toHaveLength(1);
});
it('clears the previous identity and pending replies on disposal', () => {
  const old = socket.sent[0]; client.dispose(); old.ack(reply([room(1)], 1));
  expect(client.state.rooms).toBeNull(); expect(Object.keys(socket.callbacks)).toHaveLength(0);
});

it('keeps locked rooms through snapshots and visibility updates, excluding them only from the Open filter', () => {
  socket.sent[0].ack(reply([room(1, { settings: { buyIn: 0, isPrivate: true } })], 1));
  expect(filterRooms(client.state.rooms)).toHaveLength(1);
  expect(filterRooms(client.state.rooms, 'available')).toHaveLength(0);
  socket.callbacks['room:list-update']({ room: room(1, { settings: { buyIn: 0, isPrivate: false } }), revision: 2 });
  expect(filterRooms(client.state.rooms, 'available')).toHaveLength(1);
  socket.callbacks['room:list-update']({ room: room(1, { settings: { buyIn: 0, isPrivate: true } }), revision: 3 });
  expect(client.state.rooms).toHaveLength(1);
  expect(filterRooms(client.state.rooms, 'available')).toHaveLength(0);
  socket.callbacks['room:list-update']({ room: { id: 1, closed: true }, revision: 4 });
  expect(client.state.rooms).toEqual([]);
});
