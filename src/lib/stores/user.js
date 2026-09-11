import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { AccountSession } from '../accountSession.js';

const state = writable({ token: null, user: null, generation: 0 });
let savedToken = null;
if (browser) { try { savedToken = localStorage.getItem('checkers_token'); } catch {} }
const account = new AccountSession({ token: savedToken, publish: value => {
  if (browser) {
    try {
      if (value.token) localStorage.setItem('checkers_token', value.token);
      else localStorage.removeItem('checkers_token');
    } catch { /* The current tab can still hold an authenticated session. */ }
  }
  state.set(value);
} });
export const user = derived(state, value => value.user);
export const token = derived(state, value => value.token);
export const captureSession = () => account.capture();
export const isCurrentSession = scope => account.current(scope);
export const beginAuthentication = () => account.beginAuthentication();
export const establishSession = (data, scope) => account.establish(data, scope);
export const acceptProfile = (data, scope) => account.accept(data, scope);
export const clearSession = () => account.clear();
