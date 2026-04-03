import { writable } from 'svelte/store';

// Screens navigable via URL hash (safe to restore without server state)
const SAFE_HASH_SCREENS = new Set([
  'auth', 'lobby', 'shop', 'profile', 'friends', 'treasury'
]);

function screenFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  // Only allow safe screens via hash — phase-gated screens (room-waiting, game, search, wheel)
  // must be entered via sync:state, not URL navigation
  return SAFE_HASH_SCREENS.has(hash) ? hash : null;
}

function createScreenStore() {
  const { subscribe, set, update } = writable('auth');

  function setScreen(value) {
    set(value);
    const target = `#/${value}`;
    if (window.location.hash !== target) {
      window.history.pushState(null, '', target);
    }
  }

  window.addEventListener('popstate', () => {
    const s = screenFromHash();
    if (s) set(s);
  });

  return { subscribe, set: setScreen, update };
}

export const screen = createScreenStore();

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

// Room/game chat (separate from global chat)
export const roomChatMessages = writable([]);
export const roomUnreadChat = writable(0);
