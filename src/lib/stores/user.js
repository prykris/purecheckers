import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const user = writable(null);
export const token = writable(browser ? localStorage.getItem('checkers_token') : null);

if (browser) {
  token.subscribe(val => {
    if (val) localStorage.setItem('checkers_token', val);
    else localStorage.removeItem('checkers_token');
  });
}
