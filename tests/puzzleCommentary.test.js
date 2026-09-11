import { readFileSync } from 'node:fs';
import { fromPosition, fullMoves } from '../shared/puzzleSearch.js';
import { moveNotation, squareCoords } from '../shared/notation.js';
import { alternativesNarration, classify, solutionNarration, THEME_TEXT } from '../scripts/generate-puzzles.js';

const buffer = JSON.parse(readFileSync(new URL('../data/puzzles/launch-buffer.json', import.meta.url)));
function replay(game, notation) {
  const line = [];
  for (const token of notation.match(/\b\d{1,2}(?:[-x]\d{1,2})+\b/g) || []) {
    const move = fullMoves(game).find(move => moveNotation(move) === token);
    expect(move, `Illegal commentary turn ${token}`).toBeDefined();
    line.push(move);
    game = move.after;
  }
  return line;
}
function position(pieces) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [square, color, queen = false] of pieces) {
    const { row, col } = squareCoords(square);
    board[row][col] = { color, queen };
  }
  return fromPosition({ board, currentPlayer: 'red' });
}
function example(game, answer, alternative) {
  const line = replay(game, answer);
  const [move, ...pv] = replay(game, alternative);
  return { verified: { game, line, side: game.currentPlayer }, score: { move, pv, complete: true, exact: true } };
}

it('describes an offered existing king as a king and distinguishes the forced reply', () => {
  const game = position([[10, 'red', true], [1, 'red'], [19, 'black'], [24, 'black']]);
  const line = replay(game, '10-15 19x10 1-5');
  const text = solutionNarration({ game, side: 'red', line }, {});
  expect(text).toContain('offering the king on 15');
  expect(text).not.toContain('offering the man');
  expect(text).toContain('Black must take 19x10');
});

it('does not claim one capture branch is forced when other full turns are legal', () => {
  const puzzle = buffer.find(p => p.date.startsWith('2026-09-20'));
  const game = fromPosition(puzzle.position);
  const line = replay(game, puzzle.solution.map(moveNotation).join(' '));
  expect(fullMoves(line[0].after).length).toBeGreaterThan(1);
  const text = solutionNarration({ game, side: 'red', line }, {});
  expect(text).toContain('Black has to capture, and the best try is 26x17');
  expect(text).not.toContain('Black must take');
});

it('reconstructs alternative capture facts instead of trusting cached annotations', () => {
  const game = position([[10, 'red', true], [1, 'red'], [19, 'black'], [24, 'black']]);
  const { verified, score } = example(game, '10-14', '10-15 19x10 1-5');
  const stale = { ...score, pv: score.pv.map(move => ({ ...move, captured: [], after: game })) };
  const text = alternativesNarration(verified, [stale]);
  expect(text).toContain("Black's 19x10 removes the king on 15.");
  expect(text).toContain('a man for Red and 2 men for Black');
  expect(text).toContain('check other legal replies');
  expect(text).not.toContain('wins');
});

it('reports an actual terminal alternative instead of inferring wins from material', () => {
  const game = position([[10, 'red'], [11, 'red'], [15, 'black']]);
  const { verified, score } = example(game, '11x18', '10x19');
  expect(alternativesNarration(verified, [score])).toContain('Red wins: the opponent has no pieces left.');
});

it('does not publish partial, bounded or illegal alternative continuations', () => {
  const game = fromPosition(buffer[0].position);
  const { verified, score } = example(game, '19-24', '14-17 21x14 19-24');
  expect(alternativesNarration(verified, [{ ...score, complete: false }, { ...score, exact: false }]))
    .toContain('No alternative continuation is shown here');
  const wrongReply = fullMoves(game).find(move => moveNotation(move) === '19-24');
  expect(() => alternativesNarration(verified, [{ ...score, pv: [wrongReply] }])).toThrow('Illegal commentary continuation');
});

it.each(buffer.map(puzzle => [puzzle.date.slice(0, 10), puzzle]))('keeps every launch line and sample legally replayable for %s', (_, puzzle) => {
  const game = fromPosition(puzzle.position);
  const solutionText = puzzle.commentary.solution.match(/^Solution: ([^.]+)\./)[1];
  expect(solutionText).toBe(puzzle.solution.map(moveNotation).join(' '));
  const line = replay(game, solutionText);
  const continuationText = puzzle.commentary.solution.match(/One continuation from the search is ([^.]+)\./)?.[1];
  if (continuationText) replay(line.at(-1).after, continuationText);
  const alternatives = [...puzzle.commentary.alternatives.matchAll(/Alternative ([^:]+): one sample line is ([^.]+)\./g)];
  expect(alternatives).toHaveLength(2);
  for (const [, move, sample] of alternatives) {
    expect(sample.startsWith(move)).toBe(true);
    expect(move).not.toBe(moveNotation(line[0]));
    replay(game, sample);
  }
  const classification = classify({ game, side: puzzle.sideToMove, line, legal: puzzle.legalMoves });
  expect(puzzle.commentary.theme).toBe(THEME_TEXT[classification.theme]);
  if (!line.at(-1).after.gameOver) expect(puzzle.commentary.solution).toContain('The game continues from this position.');
});
