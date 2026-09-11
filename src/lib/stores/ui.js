import { writable } from 'svelte/store';
import { BOT_DIFFICULTIES, botDifficultyLabel } from '../../../shared/bots.js';

// Layout-level UI state that must survive screen changes: the account sheet stays
// mounted through the post-game cleanup, and one notice bar serves every screen.
export const upgradeSheetOpen = writable(false);
export const openUpgradeSheet = () => upgradeSheetOpen.set(true);
export const closeUpgradeSheet = () => upgradeSheetOpen.set(false);

// { text, action?: { label, run } } or null.
export const notice = writable(null);
export const showNotice = (text, action = null) => notice.set({ text, action });
export const dismissNotice = () => notice.set(null);

// Remembered bot difficulty, shared by the Bot tab, the search fallback, the waiting
// room and the result sheet. Medium is the default everywhere.
const DIFF_KEY = 'checkers_bot_diff';
export const DIFFICULTIES = BOT_DIFFICULTIES;
function readDifficulty() {
  try { const v = localStorage.getItem(DIFF_KEY); return DIFFICULTIES.includes(v) ? v : 'medium'; } catch { return 'medium'; }
}
export const botDifficulty = writable(readDifficulty());
export function setBotDifficulty(value) {
  if (!DIFFICULTIES.includes(value)) return;
  botDifficulty.set(value);
  try { localStorage.setItem(DIFF_KEY, value); } catch {}
}
export const difficultyLabel = botDifficultyLabel;

// The friend shortcut preselects settings for the same editable room and ready flow.
export const NEARBY_ROOM = Object.freeze({ buyIn: 0, turnTimer: 60, isPrivate: true, allowSpectators: true, autoReady: false });
