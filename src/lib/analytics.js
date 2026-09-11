const GAME_EVENTS = new Set(['game_start', 'first_move', 'game_end']);
const MAX_PENDING_EVENTS = 64;

function browserTransport() {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return null;
  const script = document.getElementById('google-tag');
  return { gtag: window.gtag.bind(window), target: script ? new URL(script.src).searchParams.get('id') : null,
    location: window.location.href };
}

// Reporting has no authority over gameplay. GA4 owns the visitor/session cohort;
// do not infer it from account age, game count or another browser-storage marker.
// Look it up for each event batch so a long-lived tab can enter a later session.
export function createAnalyticsTracker({ readTransport = browserTransport, timeoutMs = 250 } = {}) {
  let pending = null;
  function emit(item, cohort) {
    try {
      const params = { ...item.params };
      if (GAME_EVENTS.has(item.event)) {
        delete params.first_session;
        params.cohort_status = cohort === null ? 'unknown' : 'known';
        if (cohort !== null) params.first_session = cohort === 1;
      }
      item.transport.gtag('event', item.event, params);
    } catch { /* Analytics failure cannot escape into the caller. */ }
  }
  function finish(batch, value) {
    if (pending !== batch) return; // Late, duplicate or superseded callback.
    pending = null;
    clearTimeout(batch.timer);
    const number = typeof value === 'number' || (typeof value === 'string' && /^[1-9]\d*$/.test(value)) ? Number(value) : NaN;
    const cohort = Number.isSafeInteger(number) && number > 0 ? number : null;
    for (const item of batch.items) emit(item, cohort);
  }
  return function track(event, params = {}) {
    try {
      const transport = readTransport();
      if (typeof transport?.gtag !== 'function') return;
      // Capture route and parameters now, before a lookup can cross navigation.
      const item = { event, params: { page_location: transport.location, ...params }, transport };
      if (pending && pending.target !== transport.target) finish(pending, undefined);
      if (pending) {
        pending.items.push(item);
        if (pending.items.length >= MAX_PENDING_EVENTS) finish(pending, undefined);
        return;
      }
      if (!GAME_EVENTS.has(event) || !transport.target) { emit(item, null); return; }
      const batch = { target: transport.target, items: [item], timer: null };
      pending = batch;
      batch.timer = setTimeout(() => finish(batch, undefined), timeoutMs);
      try { transport.gtag('get', transport.target, 'session_number', value => finish(batch, value)); }
      catch { finish(batch, undefined); }
    } catch { /* Includes unavailable browser APIs and optional transport setup. */ }
  };
}

// All client events use this boundary; domain observers decide when they occur.
export const track = createAnalyticsTracker();
