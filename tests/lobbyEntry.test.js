import { get, writable } from 'svelte/store';
import { createHints, createPlayTabs, defaultTab, HINTS_KEY, LAST_TAB_KEY } from '../src/lib/hints.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const newcomer = { isGuest: true, gamesPlayed: 0 };

it.each([true, false])('starts a first-time player on Bot (guest: %s)', isGuest => {
  const saved = storage({ [LAST_TAB_KEY]: 'rooms' }), hints = createHints(saved);
  expect(defaultTab({ user: { isGuest, gamesPlayed: 0 }, seen: hints.seen, storage: saved })).toBe('bot');
});

it('moves the automatically selected tab after the first accepted game, without unmounting the lobby', () => {
  const saved = storage(), hints = createHints(saved), session = writable({ snapshot: { phase: 'idle' } });
  const tabs = createPlayTabs({ user: newcomer, hintStore: hints, storage: saved }), unbind = hints.bindSession(session);
  expect(get(tabs)).toBe('bot');
  session.set({ snapshot: { phase: 'in-game' } });
  expect(get(tabs)).toBe('quick');
  session.set({ snapshot: { phase: 'idle' } });
  expect(get(tabs)).toBe('quick');
  expect(saved.getItem(LAST_TAB_KEY)).toBe('quick');
  unbind(); tabs.dispose();
});

it.each(['bot', 'rooms'])('retains an explicit %s choice when the first game dismisses the welcome', tab => {
  const saved = storage(), hints = createHints(saved), tabs = createPlayTabs({ user: newcomer, hintStore: hints, storage: saved });
  tabs.select(tab); hints.dismiss('welcome-bot');
  expect(get(tabs)).toBe(tab); expect(saved.getItem(LAST_TAB_KEY)).toBe(tab);
  tabs.dispose();
});

it('honours Skip and remembered returning-player tabs without restoring the welcome', () => {
  const saved = storage(), hints = createHints(saved), tabs = createPlayTabs({ user: newcomer, hintStore: hints, storage: saved });
  tabs.select('quick'); expect(hints.seen('welcome-bot')).toBe(true);
  tabs.select('rooms'); tabs.dispose();
  const returningHints = createHints(saved);
  expect(defaultTab({ user: newcomer, seen: returningHints.seen, storage: saved })).toBe('rooms');
  expect(returningHints.seen('welcome-bot')).toBe(true);
});

it('ignores invalid preferences and tolerates malformed or denied browser storage', () => {
  const corrupt = storage({ [HINTS_KEY]: '{broken', [LAST_TAB_KEY]: 'missing' });
  expect(defaultTab({ user: { gamesPlayed: 2 }, seen: createHints(corrupt).seen, storage: corrupt })).toBe('quick');
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() { throw Error('denied'); } };
  const hints = createHints(denied), tabs = createPlayTabs({ user: newcomer, hintStore: hints, storage: denied });
  tabs.select('unknown'); expect(get(tabs)).toBe('bot');
  tabs.select('quick'); expect(get(tabs)).toBe('quick'); expect(hints.seen('welcome-bot')).toBe(true);
  hints.reset(); tabs.dispose();
});

it('stops updating a disposed lobby preference owner', () => {
  const saved = storage(), hints = createHints(saved), tabs = createPlayTabs({ user: newcomer, hintStore: hints, storage: saved });
  tabs.dispose(); hints.dismiss('welcome-bot');
  expect(get(tabs)).toBe('bot'); expect(saved.getItem(LAST_TAB_KEY)).toBeNull();
});

it('loads the difficulty preference when accessing browser storage itself is denied', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  vi.resetModules();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Storage denied'); } });
  try {
    const { botDifficulty, setBotDifficulty } = await import('../src/lib/stores/ui.js');
    expect(get(botDifficulty)).toBe('medium');
    setBotDifficulty('hard'); expect(get(botDifficulty)).toBe('hard');
    setBotDifficulty('invalid'); expect(get(botDifficulty)).toBe('hard');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    vi.resetModules();
  }
});
