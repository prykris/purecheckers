import { writable, derived } from 'svelte/store';
import { SessionClient } from '../sessionClient.js';

const state = writable({ snapshot: null, status: 'disconnected', pending: null, error: null, recovery: 0 });
export const session = { subscribe: state.subscribe };
export const sessionClient = new SessionClient({ publish: value => state.set(value) });
export const snapshot = derived(session, value => value.snapshot);
export const sendCommand = (type, data) => sessionClient.send(type, data);
