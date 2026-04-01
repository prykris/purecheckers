import { writable } from 'svelte/store';

// Valid screens
const SCREENS = new Set([
  'auth', 'lobby', 'search', 'wheel', 'game',
  'shop', 'profile', 'friends', 'treasury', 'room-waiting'
]);

function screenFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return SCREENS.has(hash) ? hash : null;
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
