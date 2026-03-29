import { writable } from 'svelte/store';

export const user = writable(null);
export const token = writable(localStorage.getItem('checkers_token') || null);

token.subscribe(val => {
  if (val) localStorage.setItem('checkers_token', val);
  else localStorage.removeItem('checkers_token');
});
