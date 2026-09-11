import { writable } from 'svelte/store';
import { api } from '../api.js';
import { AppearanceClient, bindAppearance } from '../appearanceClient.js';
import { user, captureSession, isCurrentSession } from './user.js';
import { session } from './session.js';
import { renderTheme } from '../theme.js';

const state = writable({ data: null, status: 'idle', error: null });
export const appearance = { subscribe: state.subscribe };
let active = null;
let stopActive = null;
export function startAppearance() {
  stopActive?.();
  // Retire the browser-only selection; it cannot grant a paid palette.
  try { localStorage.removeItem('checkers_theme'); localStorage.removeItem('checkers_theme_vars'); } catch {}
  const stopTheme = state.subscribe(value => renderTheme(value.data?.theme));
  const client = new AppearanceClient({ load: ({ scope, signal }) => api.get('/shop/appearance', { authToken: scope.token, signal }),
    readScope: captureSession, isCurrent: isCurrentSession, publish: state.set });
  active = client;
  const stop = bindAppearance({ client, user, session, capture: captureSession,
    onFocus: callback => { window.addEventListener('focus', callback); return () => window.removeEventListener('focus', callback); } });
  let stopped = false;
  const dispose = () => {
    if (stopped) return;
    stopped = true; stop(); stopTheme();
    if (active === client) { active = null; stopActive = null; }
  };
  stopActive = dispose;
  return dispose;
}
export const refreshAppearance = () => active && captureSession().token ? active.refresh() : Promise.resolve(false);
