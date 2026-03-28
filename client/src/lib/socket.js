import { io } from 'socket.io-client';
import { get } from 'svelte/store';
import { token } from '../stores/user.js';

let socket = null;

export function connectSocket() {
  if (socket?.connected) return socket;
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
