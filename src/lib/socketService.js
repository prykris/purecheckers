import { bindChat, recoverChat, detachChat } from './chat/runtime.js';
import { roomDirectoryClient } from './stores/roomDirectory.js';
import { get } from 'svelte/store';
import { presenceStats } from './stores/app.js';
import { sessionClient, session } from './stores/session.js';
import { user, captureSession, isCurrentSession } from './stores/user.js';
import { connectSocket, getSocket } from './socket.js';
import { refreshSession } from './api.js';
import { createProfileReconciliation } from './profileReconciliation.js';
import { GameAnalytics } from './gameAnalytics.js';
import { track } from './analytics.js';

const gameAnalytics = new GameAnalytics({ track });

let detach = null;
let activeChannelId = null;

export function attachSocketListeners() {
  const socket = getSocket();
  if (!socket || detach) return;
  const listeners = [];
  const on = (event, fn) => { socket.on(event, fn); listeners.push([event, fn]); };
  const socketUserId = get(user)?.id;
  gameAnalytics.bind(socketUserId);
  let profileScope = null, profiles = null;
  on('account:revision', hint => {
    if (get(user)?.id !== socketUserId) return;
    if (!profileScope || !isCurrentSession(profileScope)) {
      profiles?.dispose();
      profileScope = captureSession();
      const scope = profileScope;
      profiles = createProfileReconciliation({ readProfile: () => get(user), refresh: refreshSession,
        isCurrent: () => isCurrentSession(scope) });
    }
    void profiles.observe(hint);
  });
  // { online, humansOnline, searching }: `online` includes the viewer, `searching` is the queue only.
  on('presence:stats', data => presenceStats.set({
    online: Number(data?.online) || 0,
    humansOnline: Number(data?.humansOnline ?? data?.online) || 0,
    searching: Number(data?.searching) || 0,
  }));
  bindChat(socket, get(user)?.id);
  roomDirectoryClient.bind(socket);

  let recovery = -1;
  let settledGame = null;
  const refreshProfile = () => { void refreshSession().catch(() => {}); };
  window.addEventListener('focus', refreshProfile);
  const unsubscribe = session.subscribe(value => {
    // Optional reporting must never interrupt session/chat/profile recovery.
    if (get(user)?.id === socketUserId) { try { gameAnalytics.observe(value); } catch {} }
    const channel = value.snapshot?.chatChannelId || null;
    if (channel !== activeChannelId || (value.status === 'ready' && recovery !== value.recovery)) {
      recovery = value.recovery;
      activeChannelId = channel;
      if (value.status === 'ready') { recoverChat(channel); refreshProfile(); }
    }
    const game = value.snapshot?.game;
    const settled = game?.gameOver && game.persistStatus === 'saved' ? game.gameId : null;
    if (settled !== settledGame) { settledGame = settled; if (settled !== null) refreshProfile(); }
  });
  sessionClient.bind(socket);
  detach = () => { profiles?.dispose(); window.removeEventListener('focus', refreshProfile); unsubscribe(); for (const [event, fn] of listeners) socket.off(event, fn); sessionClient.unbind(); detachChat(); roomDirectoryClient.dispose(); };
}

export function detachSocketListeners() { detach?.(); detach = null; activeChannelId = null; }
export async function initSocket() {
  const socket = connectSocket();
  attachSocketListeners();
  if (socket && !socket.connected) socket.connect();
  return socket;
}
