import { readFileSync } from 'node:fs';
import { PuzzleController } from '../src/lib/puzzle/controller.js';
import { puzzleStreak, validatePuzzleSolve } from '../shared/puzzleProgress.js';
const puzzle = JSON.parse(readFileSync(new URL('./fixtures/puzzle.json', import.meta.url)));
const buffer = JSON.parse(readFileSync(new URL('../data/puzzles/launch-buffer.json', import.meta.url)));
const controllers = [];
const make = options => { const c = new PuzzleController(puzzle, { reducedMotion: () => true, ...options }); controllers.push(c); return c; };
afterEach(() => { controllers.splice(0).forEach(c => c.dispose()); vi.useRealTimers(); });

it('plays every user decision and automatic reply to a server-valid solve', async () => {
  const progress = vi.fn(), c = make({ progress });
  for (let i = 0; i < puzzle.solution.length; i += 2) {
    for (const hop of puzzle.solution[i].hops) { await c.select(hop.fromRow, hop.fromCol); await c.select(hop.toRow, hop.toCol); }
  }
  expect(c.status).toBe('solved');
  const result = progress.mock.calls.at(-1)[0];
  expect(result.solved).toBe(true); expect(result.attempts).toBe(1);
  expect(validatePuzzleSolve(puzzle, result.turns)).toBe(true);
});

it('plays every launch puzzle through the browser controller to a server-valid solve', async () => {
  expect(buffer).toHaveLength(31);
  expect(new Set(buffer.map(p => p.date)).size).toBe(31);
  expect(new Set(buffer.map(p => p.positionHash)).size).toBe(31);
  for (const puzzle of buffer) {
    const progress = vi.fn();
    const controller = new PuzzleController(puzzle, { reducedMotion: () => true, progress });
    controllers.push(controller);
    for (let i = 0; i < puzzle.solution.length; i += 2) {
      for (const hop of puzzle.solution[i].hops) {
        await controller.select(hop.fromRow, hop.fromCol);
        await controller.select(hop.toRow, hop.toCol);
      }
    }
    expect(controller.snapshot().solved, puzzle.date).toBe(true);
    expect(validatePuzzleSolve(puzzle, progress.mock.calls.at(-1)[0].turns), puzzle.date).toBe(true);
  }
});

it('carries anonymous progress into login but clears a different account’s board state', () => {
  const c = make();
  c.restore({ revealed: true, attempts: 3 }, 'visitor');
  c.restore({ revealed: true, attempts: 3 }, 'user:1');
  expect(c.revealed).toBe(true);
  c.restore(undefined, 'user:2');
  expect(c.revealed).toBe(false); expect(c.attempts).toBe(1);
  expect(c.game.board).toEqual(puzzle.position.board);
});

it('restores the position after a wrong complete turn, counts hints, and locks revealed solves out of streaks', async () => {
  const c = make();
  const initial = structuredClone(c.game.board);
  const wrong = c.game.getAllValidMoves().find(m => m.toRow !== puzzle.solution[0].toRow || m.toCol !== puzzle.solution[0].toCol);
  await c.select(wrong.fromRow, wrong.fromCol); await c.select(wrong.toRow, wrong.toCol);
  expect(c.game.board).toEqual(initial); expect(c.attempts).toBe(2);
  c.hint(); expect(c.hintUsed).toBe(true); expect(c.attempts).toBe(3);
  await c.reveal(); expect(c.status).toBe('revealed');
  c.reset(); expect(c.revealed).toBe(true);
});

it('interrupts animation and automatic replies when reset or disposed', async () => {
  vi.useFakeTimers(); const publish = vi.fn(), c = make({ reducedMotion: () => false, publish });
  const hop = puzzle.solution[0].hops[0];
  await c.select(hop.fromRow, hop.fromCol);
  const moving = c.select(hop.toRow, hop.toCol);
  expect(c.status).toBe('animating'); c.reset();
  await moving; await vi.runAllTimersAsync();
  expect(c.index).toBe(0); expect(c.game.board).toEqual(puzzle.position.board);
  const revealing = c.reveal(); c.dispose(); const count = publish.mock.calls.length;
  await revealing; await vi.runAllTimersAsync(); expect(publish).toHaveBeenCalledTimes(count);
});

it('computes UTC streaks without letting revealed or future dates extend them', () => {
  const history = { '2026-09-09': { solved: true }, '2026-09-08': { solved: true }, '2026-09-11': { solved: true } };
  expect(puzzleStreak(history, new Date('2026-09-10T23:59:59Z'))).toBe(2);
  history['2026-09-10'] = { solved: true, revealed: true };
  expect(puzzleStreak(history, new Date('2026-09-10'))).toBe(2);
  expect(puzzleStreak(history, new Date('2026-09-12'))).toBe(1);
});

it('corrects local solved feedback when server history disqualifies the attempt', async () => {
  const c = make();
  for (let i = 0; i < puzzle.solution.length; i += 2) {
    for (const hop of puzzle.solution[i].hops) { await c.select(hop.fromRow, hop.fromCol); await c.select(hop.toRow, hop.toCol); }
  }
  expect(c.snapshot().solved).toBe(true);
  c.restore({ solved: false, revealed: true, attempts: 2 }, 'user:1');
  expect(c.snapshot()).toMatchObject({ solved: false, revealed: true, status: 'revealed' });
  expect(c.snapshot().notice).toContain('earns no reward');
});
