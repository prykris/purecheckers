import { CheckersGame, EVALUATION_SCALE } from './game.js';

export function searchState(game) {
  return structuredClone({ board: game.board, currentPlayer: game.currentPlayer, chainPiece: game.chainPiece,
    gameOver: game.gameOver, winner: game.winner, drawReason: game.drawReason,
    positionHistory: game.positionHistory, movesWithoutCapture: game.movesWithoutCapture });
}

export function restoreSearchState(state) {
  return Object.assign(new CheckersGame(0), state, { moveHistory: [] });
}

const STOP = Symbol('search budget');
const sameMove = (a, b) => a && b && a.fromRow === b.fromRow && a.fromCol === b.fromCol && a.toRow === b.toRow && a.toCol === b.toCol;

// Iterative deepening publishes only complete root passes. Capture chains keep
// the same side and depth until the turn actually changes; all branches count.
export function scoreBotMoves(game, { depth = 6, timeMs = 400, nodeBudget = 150000, now = performance.now.bind(performance) } = {}) {
  const deadline = now() + timeMs;
  const color = game.currentPlayer;
  const moves = game.getAllValidMoves();
  let nodes = 0;
  let completedDepth = 0;
  let scores = [];
  function search(position, remaining, alpha, beta) {
    if (++nodes > nodeBudget || now() >= deadline) throw STOP;
    if (position.gameOver) return position.winner === null ? 0 : position.winner === color ? 10000 + remaining : -10000 - remaining;
    const legal = position.getAllValidMoves();
    if (!legal.length) return position.currentPlayer === color ? -10000 - remaining : 10000 + remaining;
    if (remaining <= 0 && !position.chainPiece) return position.evaluate(color);
    const maximizing = position.currentPlayer === color;
    let best = maximizing ? -Infinity : Infinity;
    for (const move of legal) {
      const next = position.clone();
      next.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      const value = search(next, remaining - Number(next.currentPlayer !== position.currentPlayer), alpha, beta);
      best = maximizing ? Math.max(best, value) : Math.min(best, value);
      if (maximizing) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  for (let iteration = 1; iteration <= depth; iteration++) {
    try {
      const nextScores = moves.map(move => {
        const next = game.clone();
        next.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        return { move, score: search(next, iteration - Number(next.currentPlayer !== color), -Infinity, Infinity) };
      });
      scores = nextScores; completedDepth = iteration;
    } catch (err) { if (err !== STOP) throw err; break; }
  }
  return { scores, completedDepth, nodes };
}

export function chooseSearchMove(game, options) {
  const { scores } = scoreBotMoves(game, options);
  if (!scores.length) return game.getAllValidMoves()[0] ?? null;
  const best = Math.max(...scores.map(s => s.score));
  const candidates = scores.filter(s => s.score === best);
  return candidates[Math.floor(Math.random() * candidates.length)].move;
}

export function gradeSearchMove(game, playedMove, options) {
  const { scores, completedDepth } = scoreBotMoves(game, options);
  const played = scores.find(s => sameMove(s.move, playedMove));
  if (!played || !completedDepth) return null;
  const scoreDiff = (Math.round(Math.max(...scores.map(s => s.score)) * EVALUATION_SCALE)
    - Math.round(played.score * EVALUATION_SCALE)) / EVALUATION_SCALE;
  return { rating: scoreDiff <= 0.1 ? 'best' : scoreDiff < 0.5 ? 'good' : scoreDiff < 2 ? 'inaccuracy' : 'blunder', scoreDiff, depth: completedDepth };
}
