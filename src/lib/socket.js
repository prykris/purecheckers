import { io } from 'socket.io-client';
import { get } from 'svelte/store';
import { token } from '$lib/stores/user.js';

let socket = null;

export function connectSocket() {
  // Return existing socket if it exists (connected or connecting)
  if (socket) return socket;
  const t = get(token);
  if (!t) return null;

  socket = io({ auth: { token: t }, transports: ['websocket', 'polling'] });
  socket.on('connect', () => console.log('Socket connected'));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
