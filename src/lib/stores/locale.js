import { writable } from 'svelte/store';
import { browser } from '$app/environment';
// SSR and the first hydration render agree; restore the preference after mount.
export const locale = writable('en');
export function restoreLocale() {
  if (browser) { try { locale.set(localStorage.getItem('checkers_language') === 'es' ? 'es' : 'en'); } catch {} }
}
export function setLocale(value) {
  if (!['en', 'es'].includes(value)) return;
  locale.set(value);
  if (browser) { try { localStorage.setItem('checkers_language', value); } catch {} }
}
