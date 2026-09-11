import { writable, get } from 'svelte/store';

// One-time hints. The seen-set lives in localStorage; a `User.hintsSeen` column can
// mirror it later without changing this API. Later steps append ids to HINT_SEQUENCE.
export const HINT_SEQUENCE = Object.freeze(['welcome-bot']);
export const HINTS_KEY = 'checkers_hints';
export const LAST_TAB_KEY = 'checkers_last_tab';
export const PLAY_TABS = Object.freeze(['quick', 'rooms', 'bot']);

function defaultStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

function readSet(storage) {
  try {
    const raw = storage?.getItem(HINTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter(id => typeof id === 'string') : []);
  } catch { return new Set(); }
}

export function createHints(storage = defaultStorage()) {
  const store = writable(readSet(storage));
  const persist = set => { try { storage?.setItem(HINTS_KEY, JSON.stringify([...set])); } catch {} };
  const dismiss = id => {
    if (typeof id !== 'string' || !id || get(store).has(id)) return;
    store.update(set => { const next = new Set(set); next.add(id); persist(next); return next; });
  };
  return {
    subscribe: store.subscribe,
    seen: id => get(store).has(id),
    dismiss,
    dismissAll: (sequence = HINT_SEQUENCE) => { for (const id of sequence) dismiss(id); },
    reset: () => { store.set(new Set()); try { storage?.removeItem(HINTS_KEY); } catch {} },
    // The first in-game snapshot of any kind marks the welcome card seen. `Lobby`
    // stays mounted under the game, so the phase, not `gamesPlayed`, is the trigger.
    bindSession: session => session.subscribe(value => { if (value?.snapshot?.phase === 'in-game') dismiss('welcome-bot'); }),
  };
}

export const hints = createHints();

// First visit lands on Bot; afterwards the last used tab; Quick Play otherwise.
export function defaultTab({ user, seen = hints.seen, storage = defaultStorage() } = {}) {
  if (user && !seen('welcome-bot') && (user.gamesPlayed || 0) === 0) return 'bot';
  let last = null;
  try { last = storage?.getItem(LAST_TAB_KEY) || null; } catch {}
  return PLAY_TABS.includes(last) ? last : 'quick';
}

export function rememberTab(tab, storage = defaultStorage()) {
  if (!PLAY_TABS.includes(tab)) return;
  try { storage?.setItem(LAST_TAB_KEY, tab); } catch {}
}

// The lobby remains mounted beneath a game. Only the automatic first-game Bot
// selection yields to Quick Play when the hint is seen; explicit choices win.
export function createPlayTabs({ user, hintStore = hints, storage = defaultStorage() } = {}) {
  const initial = defaultTab({ user, seen: hintStore.seen, storage });
  const active = writable(initial);
  let automatic = initial === 'bot' && !hintStore.seen('welcome-bot') && (user?.gamesPlayed || 0) === 0;
  const unsubscribe = hintStore.subscribe(seen => {
    if (!automatic || !seen.has('welcome-bot')) return;
    automatic = false;
    active.set('quick');
    rememberTab('quick', storage);
  });
  return {
    subscribe: active.subscribe,
    select(tab) {
      if (!PLAY_TABS.includes(tab)) return;
      automatic = false;
      active.set(tab);
      rememberTab(tab, storage);
      if (tab === 'quick') hintStore.dismiss('welcome-bot');
    },
    dispose: unsubscribe
  };
}
