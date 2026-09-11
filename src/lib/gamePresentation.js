
// Animation is optional presentation. A skipped revision or recovery snaps to
// the latest board; it never replays missed commands or changes accepted state.
export function planBoardTransition(previous, next, recovery = false) {
  if (recovery || !previous || previous.gameId !== next.gameId || previous.gameOver ||
      next.moveHistory.length !== previous.moveHistory.length + 1) return null;
  if (!previous.moveHistory.every((move, index) => sameMove(move, next.moveHistory[index]))) return null;
  const move = next.moveHistory.at(-1);
  const piece = previous.board[move.fromRow]?.[move.fromCol];
  const destination = next.board[move.toRow]?.[move.toCol];
  if (!piece || destination?.color !== piece.color) return null;
  return { ...move, pieceColor: piece.color, pieceQueen: piece.queen,
    continuation: !!previous.chainPiece && previous.chainPiece.row === move.fromRow && previous.chainPiece.col === move.fromCol && move.captured.length > 0,
    promoted: !piece.queen && !!destination.queen,
    captured: move.captured.map(cap => ({ ...cap, ...previous.board[cap.row][cap.col] })) };
}

// A live snapshot can contain several jumps from one turn. Reconstruct only that
// verified capture path for display; never replay unrelated missed turns.
export function planBoardTransitions(previous, next) {
  const adjacent = planBoardTransition(previous, next);
  if (adjacent) return [{ snapshot: next, plan: adjacent }];
  if (!previous || previous.gameId !== next.gameId || previous.gameOver) return null;
  const count = next.moveHistory.length - previous.moveHistory.length;
  if (count < 2 || count > PRESENTATION_TIMING.maxCaptureSteps ||
      !previous.moveHistory.every((move, index) => sameMove(move, next.moveHistory[index]))) return null;
  const game = restoreGame(new CheckersGame(previous.turnTime), previous), steps = [];
  let before = previous;
  for (const move of next.moveHistory.slice(previous.moveHistory.length)) {
    if (!move.captured.length || (steps.length && !game.chainPiece) ||
        !game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol) || !sameMove(move, game.moveHistory.at(-1))) return null;
    const snapshot = { ...next, ...structuredClone(game) };
    const plan = planBoardTransition(before, snapshot);
    if (!plan) return null;
    steps.push({ snapshot, plan }); before = snapshot;
  }
  if (!sameBoardPosition(before, next) || before.currentPlayer !== next.currentPlayer ||
      before.gameOver !== next.gameOver || before.chainPiece?.row !== next.chainPiece?.row || before.chainPiece?.col !== next.chainPiece?.col) return null;
  steps.at(-1).snapshot = next;
  return steps;
}

function sameMove(a, b) {
  return b && a.fromRow === b.fromRow && a.fromCol === b.fromCol && a.toRow === b.toRow && a.toCol === b.toCol &&
    a.captured.length === b.captured.length && a.captured.every((p, i) => p.row === b.captured[i].row && p.col === b.captured[i].col);
}

export function sameBoardPosition(a, b) {
  return a && b && a.gameId === b.gameId && a.moveHistory.length === b.moveHistory.length &&
    a.moveHistory.every((move, i) => sameMove(move, b.moveHistory[i])) &&
    a.board.every((row, r) => row.every((piece, c) => piece?.color === b.board[r][c]?.color && !!piece?.queen === !!b.board[r][c]?.queen));
}

export const PRESENTATION_TIMING = Object.freeze({ move: 260, capture: 120, promotion: 160, result: 180, entrance: 220, maxBacklog: 600, maxPending: 2, maxCaptureSteps: 12 });

export function transitionDuration(plan) {
  return PRESENTATION_TIMING.move + (plan.captured.length ? PRESENTATION_TIMING.capture : 0) + (plan.promoted ? PRESENTATION_TIMING.promotion : 0);
}

export function transitionFrame(plan, elapsed) {
  const { move, capture, promotion } = PRESENTATION_TIMING;
  const captureEnd = move + (plan.captured.length ? capture : 0);
  const stage = elapsed < move ? 'moving' : elapsed < captureEnd ? 'capturing' : plan.promoted ? 'promoting' : 'settled';
  const clamp = value => Math.max(0, Math.min(1, value));
  return { ...plan, stage, movement: 1 - (1 - clamp(elapsed / move)) ** 3,
    captureProgress: clamp((elapsed - move) / capture), crownProgress: plan.promoted ? clamp((elapsed - captureEnd) / promotion) : 0 };
}
import { CheckersGame } from '../../shared/game.js';
import { restoreGame } from './boardSnapshot.js';
