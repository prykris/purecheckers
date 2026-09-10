import { writable, derived } from 'svelte/store';
import { session, snapshot } from './session.js';

// Read-only projections of one authoritative snapshot. Screens cannot set these.
export const phase = derived(snapshot, s => s?.phase || 'idle');
export const activeRoom = derived(snapshot, s => s?.room || s?.spectate?.room || null);
export const searching = derived(phase, p => p === 'matchmaking');
export const gameState = derived(snapshot, s => {
  if (s?.phase === 'in-game') return { ...s.game, myColor: s.game.yourColor, mode: 'online', state: s.game };
  if (s?.phase === 'spectating') return {
    mode: 'spectator', roomId: s.spectate.roomId, gameId: s.spectate.gameId,
    spectatorRedName: s.spectate.redName, spectatorBlackName: s.spectate.blackName, state: s.spectate.gameState,
  };
  return null;
});
export const gameOverVisible = derived(gameState, g => !!g?.state?.gameOver);
export const connectionStatus = derived(session, s => s.status === 'ready' ? 'connected' : ['syncing', 'reconnecting'].includes(s.status) ? 'reconnecting' : 'disconnected');
export const presenceStats = writable({ online: 0, lookingToPlay: 0 });
export { browseTab, replayData } from './navigation.js';
export const roomChatMessages = writable([]);
export const roomUnreadChat = writable(0);
export const roomUnreadMentions = writable(0);
