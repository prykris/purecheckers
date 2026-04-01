/**
 * Central socket event handler — connects once, updates stores.
 * UI components just read from stores.
 */
import { get } from 'svelte/store';
import { screen, gameState, activeRoom, roomChatMessages, roomUnreadChat, searching, presenceStats } from '../stores/app.js';
import { user } from '../stores/user.js';
import { getSocket } from './socket.js';

let attached = false;
let retryTimer = null;
let activeChannelId = null; // the channel the user is currently viewing

export function attachSocketListeners() {
  if (attached) return;
  const socket = getSocket();
  if (!socket) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(attachSocketListeners, 300);
    return;
  }
  attached = true;

  // ---- Presence stats ----
  socket.on('presence:stats', (data) => {
    presenceStats.set(data);
  });

  // ---- Room updates ----
  socket.on('room:updated', ({ room, closed }) => {
    const ar = get(activeRoom);
    if (!ar) return;
    if (closed && room?.id === ar.id) {
      activeRoom.set(null);
      roomChatMessages.set([]);
      roomUnreadChat.set(0);
      activeChannelId = null;
      return;
    }
    if (room && room.id === ar.id) {
      activeRoom.set(room);
    }
  });

  socket.on('room:kicked', ({ roomId }) => {
    const ar = get(activeRoom);
    if (ar?.id === roomId) {
      activeRoom.set(null);
      roomChatMessages.set([]);
      roomUnreadChat.set(0);
      activeChannelId = null;
    }
  });

  // ---- Game start (matchmaking or room) ----
  socket.on('matchmaking:found', (data) => {
    searching.set(false);

    // Clean up whatever the user was doing
    const gs = get(gameState);
    if (gs?.mode === 'spectator' && gs?.roomId) {
      // Leave spectated room
      socket.emit('room:leave', { roomId: gs.roomId });
    }

    roomUnreadChat.set(0);
    activeChannelId = `game:${data.gameId}`;
    gameState.set({
      gameId: data.gameId,
      myColor: data.yourColor,
      opponentName: data.opponent.username,
      opponentId: data.opponent.id,
      mode: 'online'
    });
    screen.set('wheel');
  });

  // ---- Chat messages (unified channel system) ----
  socket.on('chat:message', (msg) => {
    // Only add to room chat if it's for the active channel
    if (msg.channelId !== activeChannelId) return;
    const u = get(user);
    // Skip own messages (already added optimistically)
    if (msg.senderId === u?.id) return;
    roomChatMessages.update(msgs => [...msgs, msg]);
    roomUnreadChat.update(n => n + 1);
  });

  // ---- Chat history response ----
  socket.on('chat:history', ({ channelId, messages }) => {
    if (channelId !== activeChannelId) return;
    if (!messages || messages.length === 0) return;
    roomChatMessages.set(messages);

    // Compute unread from lastSeenId
    const lastSeenId = parseInt(localStorage.getItem(`chat_seen_${channelId}`) || '0');
    if (lastSeenId > 0) {
      const unread = messages.filter(m => m.id > lastSeenId).length;
      roomUnreadChat.set(unread);
    }
  });

  // ---- Room reconnect ----
  socket.on('room:reconnect', ({ room }) => {
    activeRoom.set(room);
    gameState.set({ roomId: room.id, mode: 'room', roomData: room });
    setActiveChannel(`room:${room.id}`);
  });

  console.log('[SocketService] Listeners attached');
}

/**
 * Set the active chat channel and load its history.
 */
export function setActiveChannel(channelId) {
  activeChannelId = channelId;
  roomChatMessages.set([]);
  roomUnreadChat.set(0);
  if (channelId) {
    const socket = getSocket();
    if (socket) {
      socket.emit('chat:join', { channelId });
      // Load last seen ID from localStorage
      const lastSeenId = parseInt(localStorage.getItem(`chat_seen_${channelId}`) || '0');
      socket.emit('chat:history', { channelId, afterId: lastSeenId > 0 ? undefined : undefined });
      // Always load full history for now — unread tracking via lastSeenId
      socket.emit('chat:history', { channelId });
    }
  }
}

/**
 * Mark the current channel as read (store last seen message ID).
 */
export function markChannelRead() {
  if (!activeChannelId) return;
  const msgs = get(roomChatMessages);
  if (msgs.length > 0) {
    const lastId = msgs[msgs.length - 1].id;
    if (lastId) localStorage.setItem(`chat_seen_${activeChannelId}`, String(lastId));
  }
  roomUnreadChat.set(0);
}

/**
 * Get the current active channel ID.
 */
export function getActiveChannelId() {
  return activeChannelId;
}

export function detachSocketListeners() {
  const socket = getSocket();
  if (socket && attached) {
    socket.off('presence:stats');
    socket.off('room:updated');
    socket.off('room:kicked');
    socket.off('matchmaking:found');
    socket.off('chat:message');
    socket.off('chat:history');
    socket.off('room:reconnect');
  }
  attached = false;
  clearTimeout(retryTimer);
}
