import { activeGames } from './games.js';
import { reconcileUserRoom } from './rooms.js';
import { getSession, setDisconnectCallbacks } from './sessions.js';
import { publishGame } from './events.js';
import { GameplayOwnershipLost } from '../services/gameplayOwnership.js';
import { restoreSessionNotice } from './notices.js';
import { reconcileResultUser } from './resultRuntime.js';

export function configureLifecycle() {
  setDisconnectCallbacks({
    onGameTimeout: expireDisconnectedGame
  });
}

function retryExpiry(session, stillDisconnected, stopped, retry, error) {
  console.error('Disconnect expiry failed:', error.message);
  if (error instanceof GameplayOwnershipLost || !stillDisconnected() || stopped()) return;
  // Reconnect/phase changes clear this timer; expiry never outruns the accepted
  // session context. A storage failure must not silently abandon cleanup.
  session.disconnectDeadline = Date.now() + 1000;
  clearTimeout(session.disconnectTimer);
  session.disconnectTimer = setTimeout(() => {
    session.disconnectTimer = null; session.disconnectDeadline = null;
    void retry();
  }, 1000);
  session.disconnectTimer.unref?.();
}

export function expireDisconnectedGame(userId, gameId) {
  const game = activeGames.get(gameId), session = getSession(userId);
  const color = game?.getPlayerColor(userId);
  const stillDisconnected = () => getSession(userId) === session && session?.gameId === gameId && !session.connectionId;
  if (!color || game.runtimeStopped || game.recovery || game.game.gameOver || !stillDisconnected()) return Promise.resolve();
  return game.endGame(color === 'red' ? 'black' : 'red', 'disconnect', null, stillDisconnected).catch(error => {
    retryExpiry(session, stillDisconnected, () => game.runtimeStopped || game.game.gameOver,
      () => expireDisconnectedGame(userId, gameId), error);
  });
}

export async function restoreMembership(userId) {
  const session = getSession(userId);
  await reconcileUserRoom(userId);
  await reconcileResultUser(userId);
  await restoreSessionNotice(userId);
  if (session?.gameId || session?.spectatingGameId) publishGame(session.gameId || session.spectatingGameId);
}
