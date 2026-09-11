import { get } from 'svelte/store';
import { token, captureSession, acceptProfile } from '$lib/stores/user.js';
import { withDeadline } from './actions/deadline.js';

const BASE = '/api';

async function request(method, path, body, { signal, authToken = get(token) } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = authToken;
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    signal,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  del: (path, body, options) => request('DELETE', path, body, options)
};

// Invite pre-check: null when the room is gone (404); throws on other failures.
export async function fetchInvite(code, options) {
  try { return await api.get('/rooms/invite/' + encodeURIComponent(code), options); }
  catch (error) { if (error?.status === 404) return null; throw error; }
}

// A profile read is bound to the account generation and ordered by its database
// revision. Caller-provided deadlines remain usable by wallet/upgrade workflows.
export async function refreshSession(options) {
  const scope = captureSession();
  if (!scope.token) return null;
  const read = signal => api.get('/auth/me', { ...options, signal, authToken: scope.token });
  const data = options?.signal ? await read(options.signal) : await withDeadline(read);
  return acceptProfile(data, scope);
}
