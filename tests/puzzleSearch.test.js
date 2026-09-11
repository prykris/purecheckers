import { readFileSync } from 'node:fs';
import { CheckersGame } from '../shared/game.js';
import { fullMoves, fromPosition, toPosition, search, scoreMoves, mirror, positionHash, applyFullMove, serializeMove } from '../shared/puzzleSearch.js';
import { verifyLine } from '../scripts/generate-puzzles.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/puzzle.json', import.meta.url)));

it('branches every continuation and serializes complete turns that the actual engine accepts', () => {
  const game = new CheckersGame(0);
  game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [r, c, color] of [[6, 1, 'red'], [5, 2, 'black'], [3, 2, 'black'], [3, 4, 'black']]) game.board[r][c] = { color, queen: false };
  const moves = fullMoves(game);
  expect(moves).toHaveLength(2);
  expect(moves.map(m => m.hops.length)).toEqual([2, 2]);
  expect(new Set(moves.map(m => m.toCol))).toEqual(new Set([1, 5]));
  for (const move of moves) {
    const replay = game.clone();
    expect(applyFullMove(replay, serializeMove(move))).toBeTruthy();
    expect(replay.board).toEqual(move.after.board);
    expect(replay.chainPiece).toBeNull();
    expect(replay.currentPlayer).toBe('black');
  }
});

it('scores immobilisation as a win even with equal material', () => {
  const game = new CheckersGame(0);
  game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  game.board[5][0] = { color: 'red', queen: false };
  game.board[7][2] = { color: 'black', queen: false };
  const result = search(game, { depth: 2 });
  expect(result.complete).toBe(true);
  expect(result.score).toBe(999);
  expect(result.pv[0].after.winner).toBe('red');
});

it('chooses the stronger capture continuation instead of the first enumerated branch', () => {
  const game = new CheckersGame(0);
  game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [r, c, color] of [[6, 1, 'red'], [5, 2, 'black'], [3, 2, 'black'], [3, 4, 'black'], [1, 6, 'black']]) game.board[r][c] = { color, queen: false };
  const moves = fullMoves(game);
  expect(moves[0].hops).toHaveLength(2);
  const result = search(game, { depth: 3 });
  expect(result.complete).toBe(true);
  expect(result.pv[0].hops).toHaveLength(3);
  expect(result.pv[0].promoted).toBe(true);
  expect(result.pv[0].toCol).toBe(7);
});

it('extends forced captures at the horizon and reports incomplete budgets honestly', () => {
  const game = fromPosition(fixture.position);
  const staticHorizon = search(game, { depth: 2, maxQuiescence: 0 });
  const extended = search(game, { depth: 2, maxQuiescence: 1 });
  expect(staticHorizon.pv).toHaveLength(2);
  expect(extended.pv).toHaveLength(3);
  expect(extended.pv[2].captured.length).toBeGreaterThan(0);
  expect(extended.score).toBeGreaterThan(staticHorizon.score + 1);
  const result = search(game, { depth: 9, nodeBudget: 1 });
  expect(result.complete).toBe(false);
  expect(result.aborted).toBe(true);
  expect(result.depth).toBe(0);
  const scored = scoreMoves(game, { depth: 2, nodeBudget: 0 });
  expect(scored.complete).toBe(false);
  expect(scored.scored.every(s => !s.complete)).toBe(true);
});

it('verifies the seeded tactical shot and rejects missing, partial and alternative solution lines', () => {
  const game = fromPosition(fixture.position);
  expect(verifyLine(game, fixture.solution, fixture.verifiedDepth).ok).toBe(true);
  expect(verifyLine(game, [], 8).reason).toBe('invalid-line-length');
  expect(verifyLine(game, fixture.solution.slice(0, 2), 8).ok).toBe(false);
  const alternate = fullMoves(game).find(m => m.toCol !== fixture.solution[0].toCol || m.toRow !== fixture.solution[0].toRow);
  expect(verifyLine(game, [serializeMove(alternate)], 8).ok).toBe(false);
  const real = Object.assign(new CheckersGame(0), fixture.position);
  real.positionHistory = [real._boardHash()];
  for (const move of fixture.solution) expect(applyFullMove(real, move)).toBeTruthy();
  expect(real.chainPiece).toBeNull();
});

it('preserves equivalent positions and evaluations under colour-swapped rotation', () => {
  const game = fromPosition(fixture.position);
  expect(mirror(mirror(game))).toEqual(toPosition(game));
  const mirrored = fromPosition(mirror(game));
  expect(search(game, { depth: 3 }).score).toBeCloseTo(search(mirrored, { depth: 3 }).score, 8);
  expect(positionHash(mirror(mirrored))).toBe(positionHash(game));
});

it('rejects two winning choices and treats exhausted verification as inconclusive', () => {
  const game = new CheckersGame(0);
  game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  game.board[5][0] = { color: 'red', queen: false };
  game.board[5][4] = { color: 'red', queen: false };
  game.board[7][2] = { color: 'black', queen: false };
  expect(verifyLine(game, [serializeMove(fullMoves(game)[0])], 8)).toMatchObject({ ok: false, conclusive: true, reason: 'two-wins@0' });
  expect(verifyLine(fromPosition(fixture.position), fixture.solution, 9, { budget: 0 })).toMatchObject({ ok: false, conclusive: false, reason: 'budget' });
});
