import { getSession } from './sessions.js';
import { gameRooms, broadcastRoomUpdate } from './rooms.js';
import { activeGames } from './games.js';
import { publishUser, publishGame } from './events.js';
import { connectedUsers } from '../socket/connections.js';

// An in-place account upgrade (guest -> registered) keeps the socket: identity is keyed on
// the user id. Everything that cached the old name or guest flag is updated here and the
// user's snapshot is republished. Returns false when the user has no live session.
export function applyIdentityChange({ id, username, isGuest }) {
  const session = getSession(id);
  if (!session) return false;
  session.username = username;
  session.isGuest = !!isGuest;
  const connection = connectedUsers.get(id);
  if (connection) {
    connection.username = username;
    connection.socket.username = username;
    connection.socket.isGuest = !!isGuest;
  }
  for (const room of gameRooms.values()) {
    const member = [...room.players, ...room.spectators].find(m => m.userId === id);
    if (!member) continue;
    member.username = username;
    if ('isGuest' in member) member.isGuest = !!isGuest;
    if (room.hostId === id) room.hostName = username;
    broadcastRoomUpdate(room);
  }
  for (const game of activeGames.values()) {
    if (!game.playerNames?.[id] || game.playerNames[id] === username) continue;
    game.playerNames[id] = username;
    game.version++;
    publishGame(game.id);
  }
  publishUser(id);
  return true;
}
