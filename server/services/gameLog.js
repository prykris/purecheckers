import { publicUsername, publicProfilePath } from './publicName.js';

// The same saved game has one list projection, whether read globally or through
// the authenticated player's history. Membership uses IDs, never display names.
export function gameLogEntry(game) {
  return {
    id: game.id, redPlayerId: game.redPlayerId, blackPlayerId: game.blackPlayerId,
    redPlayer: publicUsername(game.redPlayer.username), blackPlayer: publicUsername(game.blackPlayer.username),
    redProfileUrl: publicProfilePath(game.redPlayer), blackProfileUrl: publicProfilePath(game.blackPlayer),
    result: game.result, mode: game.mode, isBotGame: game.redPlayer.isBot || game.blackPlayer.isBot,
    redEloChange: game.redEloChange, blackEloChange: game.blackEloChange,
    date: game.startedAt, endedAt: game.endedAt, endReason: game.endReason,
    moveCount: Array.isArray(game.moveHistory) ? game.moveHistory.length : null
  };
}
