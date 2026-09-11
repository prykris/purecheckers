import { readFileSync } from 'node:fs';
import { verifyPuzzleBatch } from '../scripts/import-puzzles.js';
const buffer = JSON.parse(readFileSync(new URL('../data/puzzles/launch-buffer.json', import.meta.url)));
const fixture = buffer[0];
const verify = row => verifyPuzzleBatch([row], { log: () => {} });

it('preserves reviewed content and generation provenance while verifying the artifact', () => {
  const [row] = verify(fixture);
  expect(row).toEqual({ ...fixture, date: new Date(fixture.date) });
  expect(fixture.date).toBe('2026-09-10T00:00:00.000Z');
});

it.each([
  ['board shape', row => { row.position.board.pop(); }],
  ['light square', row => { row.position.board[0][0] = { color: 'red', queen: false }; }],
  ['piece type', row => { row.position.board.flat().find(Boolean).queen = 'false'; }],
  ['mover', row => { row.sideToMove = 'purple'; }],
  ['legal choices', row => { row.legalMoves++; }],
  ['empty turn', row => { row.solution[0].hops = []; }],
  ['capture annotations', row => { row.solution.at(-1).captured = []; }],
  ['promotion annotation', row => { row.solution[0].promoted = !row.solution[0].promoted; }],
  ['endpoint annotation', row => { row.solution[0].toRow = 99; }],
  ['insufficient depth', row => { row.verifiedDepth = 7; }],
  ['nonfinite score', row => { row.scoreGap = Infinity; }],
  ['unsupported difficulty', row => { row.difficulty = 'IMPOSSIBLE'; }],
  ['incorrect difficulty', row => { row.difficulty = row.difficulty === 'HARD' ? 'EASY' : 'HARD'; }],
  ['duplicate theme', row => { row.themes.push(row.theme); }],
  ['missing commentary', row => { row.commentary.alternatives = ''; }],
  ['missing provenance', row => { row.generatorVersion = ''; }],
  ['source ID', row => { row.sourceGameId = -1; }],
  ['date suffix', row => { row.date = '2026-09-10junk'; }],
  ['timestamp not midnight', row => { row.date = '2026-09-10T12:00:00.000Z'; }],
])('rejects invalid %s before publication', (_, change) => {
  const row = structuredClone(fixture); change(row);
  expect(() => verify(row)).toThrow(/Invalid/);
});

it('rejects a discontinuous capture chain even when its landing-square key is unchanged', () => {
  const row = structuredClone(buffer.find(row => row.solution.some(move => move.hops.length > 1)));
  const chain = row.solution.find(move => move.hops.length > 1);
  expect(chain).toBeDefined();
  chain.hops[1].fromRow = (chain.hops[1].fromRow + 2) % 8;
  expect(() => verify(row)).toThrow('solution annotations');
});

it('rejects invalid or non-midnight reassignment dates', () => {
  for (const startDate of [new Date(NaN), new Date('2026-09-12T12:00:00Z'), '2026-09-12']) {
    expect(() => verifyPuzzleBatch([fixture], { startDate })).toThrow('Invalid puzzle start date');
  }
});
