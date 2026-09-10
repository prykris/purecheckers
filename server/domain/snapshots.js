import { getSession } from './sessions.js';
import { DRAW_OFFER_COOLDOWN_MS } from '../../shared/constants.js';

export function buildSyncPayload(userId, { gameRooms, activeGames, getPresenceStats, sanitizeRoom }) {
  const session = getSession(userId);
  if (!session) {
    return { phase: 'idle', room: null, game: null, matchmaking: null, spectate: null, chatChannelId: null, presenceStats: null };
  }

  const payload = {
    phase: session.phase,
    room: null,
    game: null,
    matchmaking: null,
    spectate: null,
    chatChannelId: null,
    presenceStats: getPresenceStats ? getPresenceStats() : null,
  };

  switch (session.phase) {
    case 'in-room': {
      const room = gameRooms.get(session.roomId);
      if (room) {
        payload.room = sanitizeRoom(room);
        payload.chatChannelId = `room:${room.id}`;
      } else {
        throw new Error("Session refers to a missing room");
      }
      break;
    }

    case 'matchmaking': {
      payload.matchmaking = { joinedAt: Date.now() };
      break;
    }

    case 'in-game': {
      const gameRoom = activeGames.get(session.gameId);
      if (gameRoom && gameRoom.getPlayerColor(userId)) {
        const opponentId = gameRoom.getOpponentId(userId);
        const opponentSession = getSession(opponentId);
        // Look up opponent name — check session, then scan room players for bots
        let opponentName = opponentSession?.username || gameRoom.playerNames?.[opponentId];
        if (!opponentName) {
          // Bot or disconnected player — find name from the room that started this game
          for (const room of gameRooms.values()) {
            if (room.gameId === gameRoom.id) {
              const p = room.players.find(pl => pl.userId === opponentId);
              if (p) opponentName = p.username;
              break;
            }
          }
        }
        payload.game = {
          gameId: gameRoom.id,
          yourColor: gameRoom.getPlayerColor(userId),
          drawOfferAvailableAt: (gameRoom.lastDrawOffer[userId] || 0) + DRAW_OFFER_COOLDOWN_MS,
          opponentName: opponentName || 'Opponent',
          opponentId,
          opponentOnline: !!opponentSession?.connectionId || gameRoom.botIds?.has(opponentId) === true,
          ...gameRoom.getState(),
        };
        payload.chatChannelId = `game:${gameRoom.id}`;
      } else {
        throw new Error("Session refers to a missing game");
      }
      break;
    }

    case 'spectating': {
      const room = gameRooms.get(session.spectatingRoomId);
      const gameRoom = session.spectatingGameId ? activeGames.get(session.spectatingGameId) : null;
      if (!room && !gameRoom) throw new Error('Session refers to a missing spectator room');
      // Get player names for spectator display
      let redName = 'Red', blackName = 'Black';
      if (gameRoom && room) {
        const redPlayer = room.players.find(p => p.userId === gameRoom.redUserId);
        const blackPlayer = room.players.find(p => p.userId === gameRoom.blackUserId);
        if (redPlayer) redName = redPlayer.username;
        if (blackPlayer) blackName = blackPlayer.username;
      }
      payload.spectate = {
        roomId: session.spectatingRoomId,
        gameId: session.spectatingGameId,
        room: room ? sanitizeRoom(room) : null,
        gameState: gameRoom ? gameRoom.getState() : null,
        redName,
        blackName,
      };
      if (session.spectatingGameId) {
        payload.chatChannelId = `game:${session.spectatingGameId}`;
      } else if (session.spectatingRoomId) {
        payload.chatChannelId = `room:${session.spectatingRoomId}`;
      }
      break;
    }

    // 'idle' — everything stays null
  }

  return payload;
}
