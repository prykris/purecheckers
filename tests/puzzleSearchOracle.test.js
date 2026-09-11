import { readFileSync } from 'node:fs';
import { CheckersGame } from '../shared/game.js';
import { search, scoreMoves } from '../shared/puzzleSearch.js';
const rows = JSON.parse(readFileSync(new URL('../data/puzzles/launch-buffer.json', import.meta.url)));

// Exhaustive reference: raw engine hops and clone(), no generator fullMoves,
// alpha-beta, move ordering, search clones or terminal-score implementation.
function turns(game) {
  const out = [];
  function next(state) {
    for (const move of state.getAllValidMoves()) {
      const after = state.clone();
      // Match the documented tactical-search exclusion of historical draws.
      after.moveHistory = []; after.positionHistory = []; after.movesWithoutCapture = 0;
      const result = after.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      if (result.chainContinues) next(after); else out.push(after);
    }
  }
  if (!game.gameOver) next(game);
  return out;
}
function minimax(game, depth, ply = 0) {
  if (game.gameOver) return game.winner === null ? 0 : (game.winner === game.currentPlayer ? 1 : -1) * (1000 - ply);
  const legal = game.getAllValidMoves();
  if (!legal.length) return -(1000 - ply);
  if (depth <= 0 && !legal.some(move => move.captured.length)) return game.evaluate(game.currentPlayer);
  return Math.max(...turns(game).map(after => -minimax(after, depth - 1, ply + 1)));
}

it('matches exhaustive depth-three search and capture extension for every launch position', () => {
  for (const row of rows) {
    const game = Object.assign(new CheckersGame(0), structuredClone(row.position));
    const expected = minimax(game, 3);
    const actual = search(game, { depth: 3, nodeBudget: 1_000_000 });
    expect(actual.complete, row.date).toBe(true);
    expect(actual.score, row.date).toBe(expected);
    const bounded = scoreMoves(game, { depth: 2, gapWindow: 1.5, nodeBudget: 1_000_000 });
    expect(bounded.complete, row.date).toBe(true);
    for (const move of bounded.scored) {
      const exact = -minimax(move.move.after, 2, 1);
      if (move.exact) expect(move.score, row.date).toBe(exact);
      else expect(move.score, row.date).toBeGreaterThanOrEqual(exact);
    }
    expect(game.board).toEqual(row.position.board);
  }
});
