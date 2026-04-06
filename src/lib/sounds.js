/**
 * Sound engine.
 *
 * Lazy-loads audio files on first play. Respects mute toggle (persisted to localStorage).
 * Supports concurrent playback of the same sound (pooling).
 * All sounds are short clips loaded from /sounds/*.mp3.
 */
import { writable, get } from 'svelte/store';

// ---- Mute state (persisted) ----
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('checkers_muted') : null;
export const muted = writable(stored === 'true');

muted.subscribe(val => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('checkers_muted', String(val));
  }
});

export function toggleMute() {
  muted.update(v => !v);
}

// ---- Volume (0-1, persisted) ----
const storedVol = typeof localStorage !== 'undefined' ? localStorage.getItem('checkers_volume') : null;
export const volume = writable(storedVol ? parseFloat(storedVol) : 0.5);

volume.subscribe(val => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('checkers_volume', String(val));
  }
});

// ---- Sound definitions ----
// Keys map to filenames in /sounds/ (without extension)
// Add .mp3 files to src/static/sounds/ matching these names
const SOUNDS = {
  // Gameplay
  place:          { src: '/sounds/piece-moved.wav', pool: 3 },
  capture:        { src: '/sounds/piece-stumped.wav', pool: 4 },
  king:           { src: '/sounds/king-ding.wav', pool: 1 },
  gameStart:      { src: '/sounds/pieces-land-on-board.wav', pool: 1 },
  victory:        { src: '/sounds/victory-jingle.wav', pool: 1 },
  defeat:         { src: '/sounds/defeat.mp3', pool: 1 },
  tick:           { src: '/sounds/time-beep-warning.wav', pool: 1 },
  // UI
  click:          { src: '/sounds/ui-button-click.wav', pool: 2 },
  emote:          { src: '/sounds/move-swoosh.wav', pool: 2 },
  error:          { src: '/sounds/error.wav', pool: 1 },
  disconnect:     { src: '/sounds/disconnected.mp3', pool: 1 },
  reconnect:      { src: '/sounds/connected.mp3', pool: 1 },
};

// ---- Audio pool ----
// Each sound gets a pool of Audio elements for concurrent playback
const pools = {};

function getPool(name) {
  if (pools[name]) return pools[name];
  const def = SOUNDS[name];
  if (!def) return null;
  pools[name] = [];
  for (let i = 0; i < def.pool; i++) {
    const audio = new Audio(def.src);
    audio.preload = 'auto';
    pools[name].push(audio);
  }
  return pools[name];
}

// ---- Play a sound ----
let audioUnlocked = false;

/**
 * Play a sound by name.
 * @param {string} name - Key from SOUNDS
 * @param {object} [opts] - Optional overrides
 * @param {number} [opts.volume] - Override volume (0-1)
 * @param {number} [opts.rate] - Playback rate (default 1)
 */
export function play(name, opts = {}) {
  if (typeof window === 'undefined') return; // SSR guard
  if (get(muted)) return;

  const pool = getPool(name);
  if (!pool) return;

  // Find an available audio element (not currently playing)
  let audio = pool.find(a => a.paused || a.ended);
  if (!audio) {
    // All busy — reuse the first one
    audio = pool[0];
  }

  const vol = opts.volume ?? get(volume);
  audio.volume = Math.max(0, Math.min(1, vol));
  if (opts.rate) audio.playbackRate = opts.rate;
  audio.currentTime = 0;

  // Browsers require a user gesture before playing audio.
  // The first play() call might be rejected silently — that's fine.
  audio.play().catch(() => {});
}

/**
 * Preload all sounds (call after first user interaction).
 */
export function preloadAll() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  for (const name of Object.keys(SOUNDS)) {
    getPool(name);
  }
}
