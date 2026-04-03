/**
 * Move quality analysis.
 *
 * Compares a player's move against the best move found by minimax.
 * Used to rate moves (best/good/inaccuracy/blunder) and drive bot emotes.
 */

const DEPTH = 4; // Analysis depth — fast enough (~50ms) to run inline

/**
 * Analyze how good a move was.
 * @param {object} preMovGame - Clone of the game BEFORE the move was made
 * @param {object} postMoveGame - The game AFTER the move was made
 * @param {string} playerColor - Color of the player who moved
 * @returns {{ rating: string, scoreDiff: number }}
 */
export function analyzeMoveQuality(preMoveGame, postMoveGame, playerColor) {
  // Score the position after the played move (from opponent's perspective, inverted)
  const opponentColor = playerColor === 'red' ? 'black' : 'red';
  const actualScore = postMoveGame.evaluate(playerColor);

  // Find the best possible score from the pre-move position
  const bestScore = findBestScore(preMoveGame, playerColor);

  const scoreDiff = bestScore - actualScore;

  let rating;
  if (scoreDiff <= 0) rating = 'best';
  else if (scoreDiff < 0.5) rating = 'good';
  else if (scoreDiff < 2) rating = 'inaccuracy';
  else rating = 'blunder';

  return { rating, scoreDiff };
}

/**
 * Find the best achievable score from this position using minimax.
 */
function findBestScore(game, color) {
  const moves = game.getAllValidMoves();
  if (moves.length === 0) return game.evaluate(color);

  let bestScore = -Infinity;
  for (const move of moves) {
    const sim = game.clone();
    sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    finishChain(sim);
    const score = minimax(sim, DEPTH - 1, -Infinity, Infinity, false, color);
    if (score > bestScore) bestScore = score;
  }
  return bestScore;
}

function finishChain(game) {
  while (game.chainPiece) {
    const moves = game.getAllValidMoves();
    if (moves.length === 0) break;
    game.makeMove(moves[0].fromRow, moves[0].fromCol, moves[0].toRow, moves[0].toCol);
  }
}

function minimax(game, depth, alpha, beta, maximizing, color) {
  if (depth === 0 || game.gameOver) return game.evaluate(color);
  const moves = game.getAllValidMoves();
  if (moves.length === 0) return game.evaluate(color);

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const sim = game.clone();
      sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      finishChain(sim);
      const ev = minimax(sim, depth - 1, alpha, beta, false, color);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const sim = game.clone();
      sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      finishChain(sim);
      const ev = minimax(sim, depth - 1, alpha, beta, true, color);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}
