import { CheckersGame } from '../../shared/game.js';
import { positionHash, toPosition } from '../../shared/puzzleSearch.js';
import { gameParticipants, isDiscoverableGame } from './publicGames.js';
import { publicUsername, publicProfilePath } from './publicName.js';

export const MIN_SOURCE_PLY = 8;

// Validate the entire replay before exposing any of its positions. A legal
// prefix of a corrupt or unfinished capture chain is not a verified source.
export function replayPuzzlePositions(row) {
  if (!isDiscoverableGame(row)) return [];
  const game = new CheckersGame(0), positions = [];
  let ply = 0;
  for (const move of row.moveHistory) {
    if (game.gameOver || !move || !['fromRow', 'fromCol', 'toRow', 'toCol'].every(key =>
      Number.isInteger(move[key]) && move[key] >= 0 && move[key] < 8)) return [];
    const result = game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    if (!result) return [];
    if (!result.chainContinues && ++ply >= MIN_SOURCE_PLY && !game.gameOver) {
      positions.push({ position: toPosition(game), ply });
    }
  }
  return game.chainPiece ? [] : positions;
}

export async function puzzleSource(db, puzzle) {
  if (puzzle.sourceGameId == null) return null;
  const row = await db.game.findUnique({ where: { id: puzzle.sourceGameId }, include: gameParticipants });
  if (puzzle.sideToMove !== puzzle.position.currentPlayer) return null;
  const hash = positionHash(puzzle.position);
  if (!replayPuzzlePositions(row).some(({ position }) => positionHash(position) === hash)) return null;
  return { id: row.id, url: `/game/${row.id}`,
    redProfileUrl: publicProfilePath(row.redPlayer), blackProfileUrl: publicProfilePath(row.blackPlayer),
    redPlayer: publicUsername(row.redPlayer.username), blackPlayer: publicUsername(row.blackPlayer.username) };
}
