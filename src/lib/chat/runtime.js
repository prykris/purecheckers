import { writable } from 'svelte/store';
import { ChatClient, emptyChat } from './client.js';
import { roomUnreadChat, roomUnreadMentions } from '../stores/app.js';

export const roomChat = writable({ client: null, state: emptyChat() });
export const globalChat = writable({ client: null, state: emptyChat() });
let socket = null, userId = null, room = null, global = null;
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };

function create(channelId, store, isRoom = false) {
  const client = new ChatClient({ channelId, userId, storage, publish: state => {
    store.set({ client, state });
    if (isRoom) { roomUnreadChat.set(state.unread); roomUnreadMentions.set(state.mentions); }
  } });
  client.bind(socket); return client;
}
export function bindChat(transport, identity) {
  detachChat(); socket = transport; userId = identity;
  global = create('global', globalChat);
}
export function recoverChat(channelId) {
  if (!socket) return;
  if (room?.channelId !== channelId) {
    room?.dispose(); room = null;
    roomChat.set({ client: null, state: emptyChat() }); roomUnreadChat.set(0); roomUnreadMentions.set(0);
    if (channelId) room = create(channelId, roomChat, true);
  }
  void room?.recover(); void global?.recover();
}
export function detachChat() {
  room?.dispose(); global?.dispose(); room = global = socket = userId = null;
  roomChat.set({ client: null, state: emptyChat() }); globalChat.set({ client: null, state: emptyChat() });
  roomUnreadChat.set(0); roomUnreadMentions.set(0);
}
