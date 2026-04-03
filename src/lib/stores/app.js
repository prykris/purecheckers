import { writable } from 'svelte/store';

// Server-authoritative phase: 'idle' | 'in-room' | 'matchmaking' | 'in-game' | 'spectating'
export const phase = writable('idle');

// Active game state
export const gameState = writable(null);

// Active room (persists across screens — null when not in a room)
export const activeRoom = writable(null);

// Matchmaking search state (persists across screens when minimized)
export const searching = writable(false);

// Presence stats (updated by socketService)
export const presenceStats = writable({ online: 0, lookingToPlay: 0 });

// Browse tab (client-controlled, not server-driven)
export const browseTab = writable('lobby');

// Game over modal visible (prevents phase change from dismissing game screen)
export const gameOverVisible = writable(false);

// Room/game chat (separate from global chat)
export const roomChatMessages = writable([]);
export const roomUnreadChat = writable(0);
