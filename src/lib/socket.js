import { io } from 'socket.io-client';
import { get } from 'svelte/store';
import { token, user } from './stores/user.js';

// The connection identity is the user id, not the token: an in-place guest upgrade swaps
// the token without rebuilding the socket. `auth` is read at (re)connect time so a later
// reconnect presents the current token.
let socket = null, socketUserId = null;
export function connectSocket() {
  const id = get(user)?.id ?? null;
  if (socket && socketUserId !== id) disconnectSocket();
  if (!socket && get(token) && id !== null) {
    socket = io({ autoConnect: false, auth: cb => cb({ token: get(token) }), transports: ['websocket', 'polling'] });
    socketUserId = id;
  }
  return socket;
}
export function getSocket() { return socket; }
export function disconnectSocket() { socket?.disconnect(); socket = null; socketUserId = null; }
