import { writable } from 'svelte/store';

// Anonymous SSR state: public content must render before account restoration.
export const user = writable(null);
export const session = writable({ status: 'disconnected', snapshot: null });
export const locale = writable('en');
