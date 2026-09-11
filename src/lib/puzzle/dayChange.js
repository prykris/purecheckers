import { todayUtc, addDays, isoDate } from '../../../shared/puzzleDates.js';

// A suspended/offline tab may miss midnight. Only acknowledge the new date
// after its page data reloads; a failed reload must remain retryable.
export function watchPuzzleDay(onChange, target = window) {
  let day = isoDate(new Date()), timer, running = false, stopped = false;
  function schedule() {
    clearTimeout(timer);
    if (stopped) return;
    const now = new Date();
    timer = setTimeout(check, day === isoDate(now) ? Math.max(1, addDays(todayUtc(now), 1) - now) : 30_000);
  }
  async function check() {
    if (stopped || running) return;
    const next = isoDate(new Date());
    if (next === day) { schedule(); return; }
    running = true;
    try { await onChange(); if (!stopped) day = next; }
    catch { /* Keep the old date: timer, focus and online can retry. */ }
    finally { running = false; schedule(); }
  }
  schedule(); target.addEventListener('focus', check); target.addEventListener('online', check);
  return () => { stopped = true; clearTimeout(timer); target.removeEventListener('focus', check); target.removeEventListener('online', check); };
}
