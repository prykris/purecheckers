/**
 * Game screen store + override.
 *
 * Determines what full-screen game overlay to show.
 * Values: 'none' | 'room-waiting' | 'search' | 'wheel' | 'game'
 *
 * The layout calls computeGameScreen() inside an $effect
 * so it updates reactively when phase or gameOverVisible change.
 */
import { writable, get } from 'svelte/store';
import { phase, gameOverVisible } from './app.js';

// Manual override for transient screens (wheel, viewing room-waiting/search)
let _override = 'none';

export const gameScreen = writable('none');

export function setScreenOverride(screen) {
  _override = screen;
  recompute();
}

export function clearScreenOverride() {
  _override = 'none';
  recompute();
}

/**
 * Recompute the gameScreen value from current state.
 * Called by the layout's $effect when phase or gameOverVisible change,
 * and internally when override changes.
 */
export function recompute() {
  let result = 'none';

  if (_override !== 'none') {
    result = _override;
  } else if (get(gameOverVisible)) {
    result = 'game';
  } else {
    const p = get(phase);
    if (p === 'in-game' || p === 'spectating') {
      result = 'game';
    }
  }

  gameScreen.set(result);
}
