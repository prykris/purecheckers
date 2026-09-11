import { writable } from 'svelte/store';
import { RoomListClient } from '../roomListClient.js';

const state = writable({ rooms: null, loading: false, error: null });
export const roomDirectory = { subscribe: state.subscribe };
export const roomDirectoryClient = new RoomListClient({ publish: value => state.set(value) });
