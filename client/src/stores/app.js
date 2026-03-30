import { writable } from 'svelte/store';

// Current screen: 'auth' | 'lobby' | 'search' | 'wheel' | 'game' | 'shop' | 'profile' | 'friends' | 'treasury' | 'room-waiting'
export const screen = writable('auth');

// Active game state
export const gameState = writable(null);

// Active room (persists across screens — null when not in a room)
export const activeRoom = writable(null); // { id, joinCode, joinUrl, qrDataUrl, players, status, settings }
