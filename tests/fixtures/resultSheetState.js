import { writable } from 'svelte/store';

export const gameState = writable(null), presenceStats = writable({ searching: 0 });
export const session = writable({ status: 'ready', pending: null }), user = writable(null);
export const botDifficulty = writable('easy');
export const NEARBY_ROOM = {};
export function sendCommand() { throw Error('SSR must not send a gameplay command'); }
export function browseTo() { throw Error('SSR must not navigate'); }
export function openUpgradeSheet() { throw Error('SSR must not open account forms'); }
export function track() { throw Error('SSR must not emit analytics'); }
