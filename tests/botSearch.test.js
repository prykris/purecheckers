import { CheckersGame } from '../shared/game.js';
import { scoreBotMoves, chooseSearchMove, gradeSearchMove, searchState, restoreSearchState } from '../shared/botSearch.js';
import { WorkerPool } from '../server/services/workerPool.js';
import { parseMove, moveNotation } from '../src/lib/content/position.js';

it('keeps equivalent heuristic evaluations tied instead of depending on floating-point summation order', () => {
  const game = new CheckersGame(0);
  expect(game.evaluate('red')).toBe(0);
  expect(game.evaluate('black')).toBe(0);
  const opening = parseMove('11-15')[0];
  game.makeMove(opening.fromRow, opening.fromCol, opening.toRow, opening.toCol);
  expect(game.evaluate('red')).toBe(0.1);
  expect(game.evaluate('black')).toBe(-0.1);
  const result = scoreBotMoves(game, { depth: 2, timeMs: Infinity, now: () => 0 });
  const scores = Object.fromEntries(result.scores.map(s => [moveNotation(s.move), s.score]));
  for (const reply of ['24-20', '23-19', '23-18', '21-17']) expect(scores[reply]).toBe(-0.15);
  const reply = game.getAllValidMoves().find(m => moveNotation(m) === '23-19');
  expect(gradeSearchMove(game, reply, { depth: 6, timeMs: Infinity, now: () => 0 })).toEqual({
    rating: 'best', scoreDiff: 0.1, depth: 6
  });
});

it('copies queued positions so later live mutations cannot change the search', () => {
  const game = new CheckersGame();
  const state = searchState(game);
  game.board[5][0] = null;
  game.currentPlayer = 'black';
  const copy = restoreSearchState(state);
  expect(copy.currentPlayer).toBe('red');
  expect(copy.board[5][0]).toEqual({ color: 'red', queen: false });
});

it('returns a legal fallback on an exhausted budget and never invents a grade', () => {
  const game = new CheckersGame();
  expect(scoreBotMoves(game, { nodeBudget: 0 }).completedDepth).toBe(0);
  const move = chooseSearchMove(game, { nodeBudget: 0 });
  expect(game.getAllValidMoves()).toContainEqual(move);
  expect(gradeSearchMove(game, move, { nodeBudget: 0 })).toBeNull();
});

it('chooses the winning continuation of a branching forced capture', () => {
  const game = new CheckersGame(0);
  game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  game.board[4][3] = { color: 'red', queen: false };
  game.board[3][2] = { color: 'black', queen: false };
  game.board[3][4] = { color: 'black', queen: false };
  game.board[1][6] = { color: 'black', queen: false };
  game.chainPiece = { row: 4, col: 3 };
  const result = scoreBotMoves(game, { depth: 2, timeMs: 1000 });
  expect(result.completedDepth).toBe(2);
  expect(result.scores).toHaveLength(2);
  const move = chooseSearchMove(game, { depth: 2, timeMs: 1000 });
  expect(move.toCol).toBe(5); // Takes two pieces and crowns, rather than ending after one.
});

it('runs the real worker against a copied game and returns a valid move and grading', async () => {
  const pool = new WorkerPool(new URL('../server/services/searchWorker.js', import.meta.url));
  try {
    const game = new CheckersGame();
    const payload = { state: searchState(game), options: { depth: 2, timeMs: 1000 } };
    const move = await pool.run({ ...payload, kind: 'move' });
    expect(game.getAllValidMoves()).toContainEqual(move);
    const grade = await pool.run({ ...payload, kind: 'grade', move });
    expect(grade).toMatchObject({ rating: 'best', scoreDiff: 0, depth: 2 });
  } finally { await pool.close(); }
});
