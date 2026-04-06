import { io } from 'socket.io-client';
import { get } from 'svelte/store';
import { token } from '$lib/stores/user.js';
import { connectionStatus } from '$lib/stores/app.js';

let socket = null;

export function connectSocket() {
  if (socket) return socket;
  const t = get(token);
  if (!t) return null;

  socket = io({ auth: { token: t }, transports: ['websocket', 'polling'] });
  socket.on('connect', () => { connectionStatus.set('connected'); });
  socket.on('disconnect', () => { connectionStatus.set('reconnecting'); });
  socket.io.on('reconnect_attempt', () => { connectionStatus.set('reconnecting'); });
  socket.io.on('reconnect', () => { connectionStatus.set('connected'); });
  socket.io.on('reconnect_failed', () => { connectionStatus.set('disconnected'); });
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
