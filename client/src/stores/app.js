import { writable } from 'svelte/store';

// Current screen: 'auth' | 'lobby' | 'search' | 'wheel' | 'game' | 'shop' | 'profile' | 'friends'
export const screen = writable('auth');

// Active game state
export const gameState = writable(null); // { gameId, myColor, opponentName, ... }
