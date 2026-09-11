import { writable, derived, get } from 'svelte/store';
import { user, token, captureSession, isCurrentSession } from '$lib/stores/user.js';
import { refreshSession } from '$lib/api.js';
import { PuzzleJournal } from './journal.js';
import { validPuzzleAttemptResponse } from '../../../shared/puzzleProgress.js';

export const puzzleHistory = writable({ history: {}, pending: {}, scope: 'visitor', streak: 0, syncing: false, error: null, storageError: null });
let journal;
export const recordPuzzleProgress = (date, progress) => journal?.record(date, progress);
export const retryPuzzleProgress = () => journal?.sync();
export function startPuzzleHistory() {
  if (journal) return () => {};
  // Access inside the guarded storage methods also covers blocked browser storage.
  const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
  const active = new PuzzleJournal({ storage, uuid: () => crypto.randomUUID(), publish: puzzleHistory.set,
    request: async (url, options) => {
      const response = await fetch(url, { method: options.method ?? 'GET', signal: options.signal,
        headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}) },
        body: options.body ? JSON.stringify(options.body) : undefined });
      if (!response.ok) throw new Error('Puzzle progress not saved yet');
      const result = await response.json();
      // A retry can confirm an earlier credit while coinsAwarded is zero.
      if (validPuzzleAttemptResponse(result) && result.attempt.rewarded && get(token) === options.token
        && isCurrentSession({ generation: options.generation })) void refreshSession().catch(() => {});
      return result;
    } });
  journal = active;
  const unsubscribe = derived([user, token], ([$user, $token]) => $user?.id && $token ? { id: $user.id, token: $token, generation: captureSession().generation } : null)
    .subscribe(identity => active.setIdentity(identity));
  const retry = () => { active.save(); void active.sync(); };
  retry();
  window.addEventListener('online', retry); window.addEventListener('focus', retry);
  return () => { unsubscribe(); window.removeEventListener('online', retry); window.removeEventListener('focus', retry); active.dispose(); if (journal === active) journal = null; };
}
