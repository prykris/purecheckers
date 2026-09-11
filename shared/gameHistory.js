import { CheckersGame } from './game.js';
import { moveNotation } from './notation.js';

// A read-only projection of a standard game's recorded steps. Derive captures,
// crowns and turn boundaries from the rules, including for older records that
// lack those annotations. Never skip an invalid step and resume a false replay.
export function describeHistory(history) {
  const replay = new CheckersGame();
  const capturedPieces = { red: [], black: [] }, moves = [], moveLog = [];
  if (!Array.isArray(history)) return { capturedPieces, moves, moveLog, invalidMoveIndex: 0 };
  let turn = null;
  for (const [index, move] of history.entries()) {
    const color = replay.currentPlayer;
    const board = replay.board.map(row => row.slice());
    const result = move && replay.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    if (!result) return { capturedPieces, moves, moveLog, invalidMoveIndex: index };
    const normalized = replay.moveHistory.at(-1);
    moves.push(normalized);
    for (const cap of result.captured) capturedPieces[color].push({ ...board[cap.row][cap.col] });
    if (!turn) {
      turn = { num: moveLog.length + 1, color, hops: [], captured: [], promoted: false, notation: '' };
      moveLog.push(turn);
    }
    turn.hops.push(normalized);
    turn.captured.push(...result.captured);
    turn.promoted ||= result.promoted;
    turn.notation = moveNotation(turn) + (turn.promoted ? ' K' : '');
    if (!result.chainContinues) turn = null;
  }
  return { capturedPieces, moves, moveLog, invalidMoveIndex: null };
}
