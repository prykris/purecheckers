import { readFileSync } from 'node:fs';
import { runGenerator, parseArgs, planDates } from '../scripts/generate-puzzles.js';
import { parsePuzzleDate, isoDate, puzzleCacheSeconds } from '../shared/puzzleDates.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/puzzle-generator-seed-1.json', import.meta.url)));

it('fills holes rather than treating the latest date as proof of a full buffer', () => {
  const today = new Date('2026-09-10');
  const slots = planDates({ today, targetBuffer: 3, existingDates: [today, new Date('2026-09-13')] });
  expect(slots.map(s => isoDate(s.date))).toEqual(['2026-09-11', '2026-09-12']);
  expect(planDates({ today, targetBuffer: 0 })).toEqual([]);
});

it.each([['--seed', 'NaN'], ['--reverify', '-1'], ['--reverify', '1.5'], ['--target-buffer', '2.5'], ['--max-candidates', '0'], ['--max-minutes', 'Infinity']])('rejects invalid generator options %s %s', (...args) => {
  expect(() => parseArgs(args)).toThrow();
});

it('uses valid UTC calendar dates and prevents today caches crossing publication time', () => {
  expect(parsePuzzleDate('2026-02-29')).toBeNull();
  expect(isoDate(parsePuzzleDate('2028-02-29'))).toBe('2028-02-29');
  expect(parsePuzzleDate('2026-9-10')).toBeNull();
  expect(puzzleCacheSeconds(new Date('2026-09-10'), new Date('2026-09-10T23:59:50Z'))).toBe(10);
});

it('reproduces the first verified puzzle for --dry-run --seed 1 without writing rows', async () => {
  const create = vi.fn();
  const result = await runGenerator({ prisma: { puzzle: { findMany: async () => [], create }, puzzleRejection: { findMany: async () => [] } }, ...parseArgs(['--dry-run', '--seed', '1', '--target-buffer', '1', '--max-candidates', '1']), now: new Date('2026-09-10'), log: () => {} });
  expect(result.proposed).toBe(1);
  expect(result.remaining).toBe(1);
  expect(result.puzzles[0].positionHash).toBe(fixture.positionHash);
  expect(result.puzzles[0].solution).toEqual(fixture.solution);
  expect(result.puzzles[0].generatorVersion).toBe(fixture.generatorVersion);
  expect(create).not.toHaveBeenCalled();
});

it('excludes persisted rejected positions before deep verification in a later generator run', async () => {
  const result = await runGenerator({ prisma: { puzzle: { findMany: async () => [] },
    puzzleRejection: { findMany: async () => [{ positionHash: fixture.positionHash, oppositeHash: fixture.positionHash }] } },
    ...parseArgs(['--dry-run', '--seed', '1', '--target-buffer', '1', '--max-candidates', '1', '--max-minutes', '0.1']),
    now: new Date('2026-09-10'), log: () => {} });
  expect(result.rejects.duplicate).toBeGreaterThan(0);
  expect(result.puzzles.every(puzzle => puzzle.positionHash !== fixture.positionHash)).toBe(true);
});
