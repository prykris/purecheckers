import { io } from 'socket.io-client';
import { get } from 'svelte/store';
import { token } from './stores/user.js';

let socket = null;
export function connectSocket() {
  if (!socket && get(token)) socket = io({ autoConnect: false, auth: { token: get(token) }, transports: ['websocket', 'polling'] });
  return socket;
}
export function getSocket() { return socket; }
export function disconnectSocket() { socket?.disconnect(); socket = null; }
