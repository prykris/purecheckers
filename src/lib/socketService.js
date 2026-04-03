/**
 * Central socket event handler — connects once, updates stores.
 * UI components just read from stores. NO navigation here.
 */
import { get } from 'svelte/store';
import { phase, gameState, activeRoom, roomChatMessages, roomUnreadChat, searching, presenceStats, gameOverVisible } from '$lib/stores/app.js';
import { setScreenOverride, clearScreenOverride } from '$lib/stores/gameScreen.js';
import { user } from '$lib/stores/user.js';
import { connectSocket, disconnectSocket, getSocket } from '$lib/socket.js';

let attached = false;
let retryTimer = null;
let activeChannelId = null;

// Resolve function for sync:state promise (used by layout on init)
let syncResolve = null;
export function waitForSync() {
  return new Promise(resolve => {
    syncResolve = resolve;
  });
}

export function attachSocketListeners() {
  if (attached) return;
  const socket = getSocket();
  if (!socket) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(attachSocketListeners, 300);
    return;
  }
  attached = true;

  // ---- Server-authoritative sync ----
  socket.on('sync:state', (payload) => {
    applySync(payload);
    if (syncResolve) {
      syncResolve(payload);
      syncResolve = null;
    }
    // No navigation here. The layout's $effect on gameScreen handles rendering.
  });

  // ---- Presence stats ----
  socket.on('presence:stats', (data) => {
    presenceStats.set(data);
  });

  // ---- Room updates (incremental) ----
  socket.on('room:updated', ({ room, closed }) => {
    const ar = get(activeRoom);
    if (!ar) return;
    if (closed && room?.id === ar.id) {
      activeRoom.set(null);
      gameState.set(null);
      phase.set('idle');
      roomChatMessages.set([]);
      roomUnreadChat.set(0);
      activeChannelId = null;
      clearScreenOverride();
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
      gameState.set(null);
      phase.set('idle');
      roomChatMessages.set([]);
      roomUnreadChat.set(0);
      activeChannelId = null;
      clearScreenOverride();
    }
  });

  // ---- Game start (matchmaking or room) ----
  socket.on('matchmaking:found', (data) => {
    searching.set(false);

    const gs = get(gameState);
    if (gs?.mode === 'spectator' && gs?.roomId) {
      socket.emit('room:leave', { roomId: gs.roomId });
    }

    roomUnreadChat.set(0);
    activeChannelId = `game:${data.gameId}`;
    phase.set('in-game');
    gameState.set({
      gameId: data.gameId,
      myColor: data.yourColor,
      opponentName: data.opponent.username,
      opponentId: data.opponent.id,
      mode: 'online'
    });
    // Show wheel overlay — gameScreen derives to 'wheel'
    setScreenOverride('wheel');
  });

  // ---- Chat messages (unified channel system) ----
  socket.on('chat:message', (msg) => {
    if (msg.channelId !== activeChannelId) return;
    const u = get(user);
    if (msg.senderId === u?.id) return;
    roomChatMessages.update(msgs => [...msgs, msg]);
    roomUnreadChat.update(n => n + 1);
  });

  // ---- Chat history response ----
  socket.on('chat:history', ({ channelId, messages }) => {
    if (channelId !== activeChannelId) return;
    if (!messages || messages.length === 0) return;
    roomChatMessages.set(messages);

    const lastSeenId = parseInt(localStorage.getItem(`chat_seen_${channelId}`) || '0');
    if (lastSeenId > 0) {
      const unread = messages.filter(m => m.id > lastSeenId).length;
      roomUnreadChat.set(unread);
    }
  });

  console.log('[SocketService] Listeners attached');
}

/**
 * Apply a sync:state payload from the server.
 * Atomically sets all stores. NO navigation — rendering is reactive.
 */
function applySync(payload) {
  phase.set(payload.phase);

  switch (payload.phase) {
    case 'idle':
      activeRoom.set(null);
      gameState.set(null);
      searching.set(false);
      // If game over modal was visible, keep it (gameOverVisible stays true)
      // Otherwise clear any override
      if (!get(gameOverVisible)) {
        clearScreenOverride();
      }
      break;

    case 'in-room':
      activeRoom.set(payload.room);
      gameState.set({ roomId: payload.room.id, mode: 'room', roomData: payload.room });
      searching.set(false);
      break;

    case 'matchmaking':
      activeRoom.set(null);
      gameState.set(null);
      searching.set(true);
      break;

    case 'in-game':
      activeRoom.set(null);
      searching.set(false);
      gameState.set({
        gameId: payload.game.gameId,
        myColor: payload.game.yourColor,
        opponentName: payload.game.opponentName,
        opponentId: payload.game.opponentId,
        opponentOnline: payload.game.opponentOnline,
        mode: 'online',
        reconnectState: {
          board: payload.game.board,
          currentPlayer: payload.game.currentPlayer,
          redTime: payload.game.redTime,
          blackTime: payload.game.blackTime,
          chainPiece: payload.game.chainPiece,
          gameOver: payload.game.gameOver,
          winner: payload.game.winner,
          moveHistory: payload.game.moveHistory,
        },
      });
      break;

    case 'spectating':
      activeRoom.set(payload.spectate?.room || null);
      searching.set(false);
      gameState.set({
        mode: 'spectator',
        roomId: payload.spectate?.roomId,
        gameId: payload.spectate?.gameId,
        spectatorRedName: payload.spectate?.redName || 'Red',
        spectatorBlackName: payload.spectate?.blackName || 'Black',
        reconnectState: payload.spectate?.gameState || null,
      });
      break;
  }

  if (payload.presenceStats) {
    presenceStats.set(payload.presenceStats);
  }

  if (payload.chatChannelId && payload.chatChannelId !== activeChannelId) {
    setActiveChannel(payload.chatChannelId);
  } else if (!payload.chatChannelId && activeChannelId) {
    activeChannelId = null;
    roomChatMessages.set([]);
    roomUnreadChat.set(0);
  }
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
}

export function getActiveChannelId() {
  return activeChannelId;
}

export function detachSocketListeners() {
  const socket = getSocket();
  if (socket && attached) {
    socket.off('sync:state');
    socket.off('presence:stats');
    socket.off('room:updated');
    socket.off('room:kicked');
    socket.off('matchmaking:found');
    socket.off('chat:message');
    socket.off('chat:history');
  }
  attached = false;
  clearTimeout(retryTimer);
}

/**
 * Single entry point: connect socket, attach listeners, wait for sync:state.
 */
export async function initSocket() {
  const sock = connectSocket();
  attachSocketListeners();
  if (!sock) return null;

  const payload = await Promise.race([
    waitForSync(),
    new Promise(resolve => setTimeout(() => resolve(null), 3000))
  ]);
  return payload;
}

/**
 * Tear down and reconnect (e.g., after guest upgrade).
 */
export async function reconnectSocket() {
  detachSocketListeners();
  disconnectSocket();
  return initSocket();
}
