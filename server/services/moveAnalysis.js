/**
 * Move quality analysis.
 *
 * Compares a player's move against all possible moves using minimax.
 * The player's move is scored the same way as all alternatives — apples to apples.
 */

const DEPTH = 6; // Same as hard bot — accurate analysis

/**
 * Analyze how good a move was.
 * @param {object} preMoveGame - Clone of the game BEFORE the move was made
 * @param {{ fromRow, fromCol, toRow, toCol }} playedMove - The move the player made
 * @param {string} playerColor - Color of the player who moved
 * @returns {{ rating: string, scoreDiff: number }}
 */
export function analyzeMoveQuality(preMoveGame, playedMove, playerColor) {
  const moves = preMoveGame.getAllValidMoves();
  if (moves.length <= 1) return { rating: 'best', scoreDiff: 0 }; // Only one legal move

  let bestScore = -Infinity;
  let playedScore = -Infinity;

  for (const move of moves) {
    const sim = preMoveGame.clone();
    sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    finishChain(sim);

    // Evaluate from opponent's perspective (minimizing), same as minimax would
    const score = minimax(sim, DEPTH - 1, -Infinity, Infinity, false, playerColor);

    if (score > bestScore) bestScore = score;

    // Check if this is the move the player actually made
    if (move.fromRow === playedMove.fromRow && move.fromCol === playedMove.fromCol &&
        move.toRow === playedMove.toRow && move.toCol === playedMove.toCol) {
      playedScore = score;
    }
  }

  const scoreDiff = bestScore - playedScore;

  let rating;
  if (scoreDiff <= 0.1) rating = 'best';
  else if (scoreDiff < 0.5) rating = 'good';
  else if (scoreDiff < 2) rating = 'inaccuracy';
  else rating = 'blunder';

  return { rating, scoreDiff };
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
