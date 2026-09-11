import { writable } from 'svelte/store';

// A read-only projection of the single site runtime, shared by public and app UI.
export const bootstrapState = writable({ loading: true, joiningInvite: false, hostName: null, error: null });
let retry = () => {};
export const retryBootstrap = () => retry();
export function bindBootstrapRetry(callback) { retry = callback; return () => { if (retry === callback) retry = () => {}; }; }
