import { writable, derived } from 'svelte/store';
import { SessionClient } from '../sessionClient.js';

const state = writable({ snapshot: null, status: 'disconnected', pending: null, error: null, recovery: 0 });
export const session = { subscribe: state.subscribe };
export const sessionClient = new SessionClient({ publish: value => state.set(value) });
export const snapshot = derived(session, value => value.snapshot);
export const sendCommand = (type, data) => sessionClient.send(type, data);

// Display deadlines against the last accepted server clock, including unlimited games.
// The interval exists only while a view subscribes; it never advances domain state.
export const serverNow = derived(session, (value, set) => {
  if (!value.snapshot) { set(null); return; }
  const receivedAt = sessionClient.receivedAt, timestamp = value.snapshot.serverTime;
  const update = () => set(timestamp + Math.max(0, Date.now() - receivedAt));
  update(); const timer = setInterval(update, 250);
  return () => clearInterval(timer);
});
