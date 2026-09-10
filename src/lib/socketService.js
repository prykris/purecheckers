import { get } from 'svelte/store';
import { roomChatMessages, roomUnreadChat, roomUnreadMentions, presenceStats } from './stores/app.js';
import { sessionClient, session } from './stores/session.js';
import { user } from './stores/user.js';
import { connectSocket, getSocket } from './socket.js';

let detach = null;
let activeChannelId = null;

export function attachSocketListeners() {
  const socket = getSocket();
  if (!socket || detach) return;
  const listeners = [];
  const on = (event, fn) => { socket.on(event, fn); listeners.push([event, fn]); };
  on('presence:stats', data => presenceStats.set(data));
  // ---- Chat messages (unified channel system) ----
  on('chat:message', (msg) => {
    if (msg.channelId !== activeChannelId) return;
    const u = get(user);
    if (msg.senderId === u?.id) return;
    roomChatMessages.update(msgs => [...msgs, msg]);
    roomUnreadChat.update(n => n + 1);
    if (msg.mentions?.includes(u?.id)) {
      roomUnreadMentions.update(n => n + 1);
    }
  });

  // ---- Chat history response ----
  on('chat:history', ({ channelId, messages, prepend }) => {
    if (channelId !== activeChannelId) return;
    if (!messages || messages.length === 0) return;
    if (prepend) {
      roomChatMessages.update(existing => [...messages, ...existing]);
      return;
    }
    roomChatMessages.set(messages);

    const lastSeenId = parseInt(localStorage.getItem(`chat_seen_${channelId}`) || '0');
    if (lastSeenId > 0) {
      const unread = messages.filter(m => m.id > lastSeenId).length;
      roomUnreadChat.set(unread);
    }
  });


  let recovery = -1;
  const unsubscribe = session.subscribe(value => {
    const channel = value.snapshot?.chatChannelId || null;
    if (channel !== activeChannelId || (value.status === 'ready' && recovery !== value.recovery)) {
      recovery = value.recovery;
      setActiveChannel(channel);
    }
  });
  sessionClient.bind(socket);
  detach = () => { unsubscribe(); for (const [event, fn] of listeners) socket.off(event, fn); sessionClient.unbind(); };
}

export function setActiveChannel(channelId) {
  activeChannelId = channelId;
  roomChatMessages.set([]);
  roomUnreadChat.set(0);
  if (channelId) {
    const socket = getSocket();
    if (socket) {
      socket.emit('chat:join', { channelId });
      socket.emit('chat:history', { channelId });
    }
  }
}

/**
 * Mark the current channel as read.
 */
export function markChannelRead() {
  if (!activeChannelId) return;
  const msgs = get(roomChatMessages);
  if (msgs.length > 0) {
    const lastId = msgs[msgs.length - 1].id;
    if (lastId) localStorage.setItem(`chat_seen_${activeChannelId}`, String(lastId));
  }
  roomUnreadChat.set(0);
  roomUnreadMentions.set(0);
}

export function getActiveChannelId() {
  return activeChannelId;
}


export function detachSocketListeners() { detach?.(); detach = null; activeChannelId = null; }
export async function initSocket() {
  const socket = connectSocket();
  attachSocketListeners();
  if (socket && !socket.connected) socket.connect();
  return socket;
}
