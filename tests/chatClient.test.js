import { ChatClient } from '../src/lib/chat/client.js';
import { mentionSegments } from '../shared/chat.js';

class Transport {
  connected = true; listeners = new Map(); sent = [];
  on(event, fn) { const list = this.listeners.get(event) || []; list.push(fn); this.listeners.set(event, list); }
  off(event, fn) { this.listeners.set(event, (this.listeners.get(event) || []).filter(item => item !== fn)); }
  emit(event, data, ack) { this.sent.push({ event, data, ack }); }
  receive(event, data) { for (const fn of this.listeners.get(event) || []) fn(data); }
}
const message = (id, extra = {}) => ({ id, channelId: 'game:3', senderId: 2, content: `Message ${id}`, mentions: [], ...extra });
let client, socket, published;
beforeEach(() => {
  vi.useFakeTimers(); published = [];
  client = new ChatClient({ channelId: 'game:3', userId: 1, publish: value => published.push(value), uuid: () => 'request-1', timeoutMs: 100 });
  socket = new Transport(); client.bind(socket);
});
afterEach(() => { client.dispose(); vi.useRealTimers(); });
const history = (messages, hasMore = false) => ({ ok: true, messages, hasMore });

it('merges history and sender echoes by persisted id, including an empty successful history', async () => {
  const read = client.load();
  socket.receive('chat:v2:message', message(4)); socket.receive('chat:v2:message', message(4));
  socket.sent.at(-1).ack(history([message(3), message(4)])); await read;
  expect(client.state.messages.map(m => m.id)).toEqual([3, 4]);
  const refresh = client.recover(); socket.sent.at(-1).ack(history([])); await refresh;
  expect(client.state.loaded).toBe(true); expect(client.state.messages.map(m => m.id)).toEqual([3, 4]);
});
it('keeps a timed-out draft, retries the same id, and accepts an echo before the acknowledgement', async () => {
  client.setDraft('Hello'); const first = client.send(); const request = socket.sent.at(-1);
  expect(client.state.messages).toEqual([]); expect(client.state.delivery).toBe('sending');
  await vi.advanceTimersByTimeAsync(100); expect(await first).toBe(false);
  expect(client.state.delivery).toBe('uncertain'); client.setDraft('Different'); expect(client.state.draft).toBe('Hello');
  const retry = client.send(); expect(socket.sent.at(-1).data).toEqual(request.data);
  const confirmed = message(7, { senderId: 1, content: 'Hello', clientMessageId: 'request-1' });
  socket.receive('chat:v2:message', confirmed);
  expect(client.state.draft).toBe(''); expect(client.state.delivery).toBe('idle');
  socket.sent.at(-1).ack({ ok: true, message: confirmed }); expect(await retry).toBe(true);
  request.ack({ ok: true, message: confirmed }); expect(client.state.messages).toHaveLength(1);
});
it('keeps rejected and offline drafts editable without fabricating a delivered message', async () => {
  client.setDraft('Hi'); const sending = client.send();
  socket.sent.at(-1).ack({ ok: false, code: 'rate_limited', error: 'Wait a moment' }); await sending;
  expect(client.state).toMatchObject({ draft: 'Hi', delivery: 'idle', sendError: 'Wait a moment', messages: [] });
  socket.connected = false; socket.receive('disconnect'); expect(await client.send()).toBe(false);
  expect(client.state.sendError).toContain('offline'); client.setDraft('Still here'); expect(client.state.draft).toBe('Still here');
});
it('uses recovered history to confirm a send and discards reads from a previous connection', async () => {
  client.setDraft('Hello'); const send = client.send(); const oldSend = socket.sent.at(-1);
  const oldRead = client.load(), oldHistory = socket.sent.at(-1);
  socket.connected = false; socket.receive('disconnect'); await Promise.all([send, oldRead]);
  socket.connected = true; const recovery = client.recover();
  oldHistory.ack(history([message(99)])); oldSend.ack({ ok: false, code: 'forbidden' });
  socket.sent.at(-1).ack(history([message(5, { senderId: 1, clientMessageId: 'request-1' })])); await recovery;
  expect(client.state.messages.map(m => m.id)).toEqual([5]); expect(client.state.draft).toBe('');
  expect(client.state).toMatchObject({ connected: true, delivery: 'idle', loading: false });
});
it('keeps pagination pending until its response and exposes failures instead of guessing exhaustion', async () => {
  const initial = client.load(); socket.sent.at(-1).ack(history([message(10)], true)); await initial;
  const older = client.load(true); expect(socket.sent.at(-1).data.beforeId).toBe(10);
  await vi.advanceTimersByTimeAsync(100); expect(await older).toBe(false);
  expect(client.state.hasMore).toBe(true); expect(client.state.historyError).toBeTruthy();
  const retry = client.load(true); socket.sent.at(-1).ack(history([message(9)], false)); await retry;
  expect(client.state.messages.map(m => m.id)).toEqual([9, 10]); expect(client.state.hasMore).toBe(false);
});
it('does not conceal a history gap when live messages arrive during reconnect recovery', async () => {
  client.receive(message(1)); const read = client.recover(); client.receive(message(102));
  socket.sent.at(-1).ack(history([message(100), message(101)], true)); await read;
  expect(client.state.messages.map(m => m.id)).toEqual([100, 101, 102]); expect(client.state.hasMore).toBe(true);
});
it('deduplicates unread mentions, never counts own messages, and tolerates denied storage', () => {
  client.storage = { setItem() { throw new Error('denied'); } };
  client.receive(message(1, { mentions: [1] })); client.receive(message(1, { mentions: [1] }));
  client.receive(message(2, { senderId: 1 })); expect(client.state.unread).toBe(1); expect(client.state.mentions).toBe(1);
  client.setVisible(true); client.receive(message(3)); expect(client.state.unread).toBe(0);
  client.setVisible(false); client.receive(message(4)); expect(client.state.unread).toBe(1);
});
it('does not publish disposed requests or interpret message text as markup', async () => {
  const read = client.load(), old = socket.sent.at(-1); client.dispose(); const count = published.length;
  old.ack(history([message(1)])); await read; expect(published).toHaveLength(count);
  const text = '<img src=x onerror=alert(1)> @Alice &lt;script&gt;';
  expect(mentionSegments(text).map(s => s.text).join('')).toBe(text);
});

it('settles when a rendering subscriber reports visibility after every publication', () => {
  const writes = [];
  client.storage = { setItem: (...args) => writes.push(args) };
  client.receive(message(1, { mentions: [1] }));
  let renders = 0;
  client.publish = () => {
    if (++renders > 10) throw new Error('Visibility publication loop');
    client.setVisible(true);
  };
  client.setVisible(true);
  expect(renders).toBe(1);
  expect(client.state).toMatchObject({ unread: 0, mentions: 0 });
  client.receive(message(2));
  client.receive(message(2));
  client.markRead();
  expect(renders).toBe(3);
  expect(writes.map(([, value]) => value)).toEqual(['1', '2']);
  expect(client.lastSeen).toBe(2);
  client.setVisible(false);
  // A hidden channel still counts unread; becoming visible clears it once.
  client.publish = value => published.push(value);
  client.receive(message(3, { mentions: [1] }));
  expect(client.state).toMatchObject({ unread: 1, mentions: 1 });
  client.setVisible(true);
  expect(client.state).toMatchObject({ unread: 0, mentions: 0 });
});
