import { activeGames } from './games.js';
import { gameRooms, leaveRoom } from './rooms.js';
import { getSession, setDisconnectCallbacks } from './sessions.js';
import { publishGame } from './events.js';

export function configureLifecycle() {
  setDisconnectCallbacks({
    onGameTimeout(userId, gameId) {
      const game = activeGames.get(gameId);
      const color = game?.getPlayerColor(userId);
      if (!color || game.game.gameOver) return;
      game.endReason = 'disconnect';
      game.endGame(color === 'red' ? 'black' : 'red');
    },
    onRoomTimeout(userId, roomId) { leaveRoom(gameRooms.get(roomId), userId); }
  });
}

export function restoreMembership(userId) {
  const session = getSession(userId);
  if (session?.phase === 'in-room') {
    const room = gameRooms.get(session.roomId);
    const player = room?.players.find(p => p.userId === userId);
    if (player) player.online = true;
  }
  if (session?.phase === 'spectating') {
    const room = gameRooms.get(session.spectatingRoomId);
    if (room && !room.spectators.some(p => p.userId === userId)) room.spectators.push({ userId, username: session.username });
  }
  if (session?.gameId) publishGame(session.gameId);
}
