import { readPuzzleBuffer } from '../server/services/puzzleBuffer.js';
import { maintainPuzzleBuffer } from '../scripts/maintain-puzzles.js';
import { parseBufferArgs } from '../scripts/puzzle-buffer.js';

function database(dates) {
  return { puzzleRejection: { findMany: async () => [] }, puzzle: { findMany: vi.fn(async ({ where }) => dates.map(date => ({ date: new Date(date) }))
    .filter(row => row.date >= where.date.gte && row.date <= where.date.lte)) } };
}
const now = new Date('2026-12-31T23:59:59Z');

it('finds a gap even when the latest row reaches the requested horizon', async () => {
  const report = await readPuzzleBuffer(database(['2026-12-30', '2026-12-31', '2027-01-02', '2028-01-01']), { now, days: 2 });
  expect(report).toMatchObject({ today: '2026-12-31', through: '2027-01-02', requiredDays: 3,
    availableDays: 2, consecutiveDays: 1, firstMissingDate: '2027-01-01', missingDates: ['2027-01-01'], healthy: false });
});

it('reports zero consecutive coverage when today is missing and treats days=0 as today only', async () => {
  expect(await readPuzzleBuffer(database(['2027-01-01']), { now, days: 1 })).toMatchObject({ consecutiveDays: 0, healthy: false });
  expect(await readPuzzleBuffer(database(['2026-12-31']), { now, days: 0 })).toMatchObject({ requiredDays: 1, consecutiveDays: 1, missingDates: [], healthy: true });
});

it('checks the committed calendar after a maintenance job crosses UTC midnight', async () => {
  const dates = ['2026-12-31'];
  const db = database(dates);
  const report = await maintainPuzzleBuffer({ db, options: { targetBuffer: 1 }, now: () => new Date('2027-01-01'),
    run: async () => { dates.push('2027-01-01'); return { written: 1, remaining: 0 }; } });
  expect(report).toMatchObject({ exitCode: 3, written: 1, buffer: { today: '2027-01-01', missingDates: ['2027-01-02'] } });
});

it('keeps lock contention distinct even if an existing buffer is healthy', async () => {
  const report = await maintainPuzzleBuffer({ db: database(['2026-12-31']), options: { targetBuffer: 0 }, now: () => now, run: async () => ({ busy: true }) });
  expect(report).toMatchObject({ exitCode: 4, busy: true, written: 0, buffer: { healthy: true } });
});

it('does not describe dry-run candidates as stored availability and retains reverification findings', async () => {
  const report = await maintainPuzzleBuffer({ db: database([]), options: { targetBuffer: 1, dryRun: true, seed: 7 }, now: () => now,
    run: async () => ({ written: 0, proposed: 2, remaining: 0, reverification: { inconclusive: 1 } }) });
  expect(report).toMatchObject({ exitCode: 3, dryRun: true, seed: 7, written: 0, proposed: 2, reverification: { inconclusive: 1 }, buffer: { availableDays: 0 } });
});

it('reports a protected failed puzzle as requiring attention even when dates are available', async () => {
  const protectedFailures = [{ id: 1, date: '2026-12-31', reason: 'published-or-protected' }];
  expect(await maintainPuzzleBuffer({ db: database(['2026-12-31']), options: { targetBuffer: 0 }, now: () => now,
    run: async () => ({ written: 0, protectedFailures }) })).toMatchObject({ exitCode: 5, protectedFailures, buffer: { healthy: true } });
});

it('does not mask a failed publishing transaction as healthy availability', async () => {
  const db = database(['2026-12-31']);
  await expect(maintainPuzzleBuffer({ db, options: { targetBuffer: 0 }, run: async () => { throw Error('transaction rolled back'); } })).rejects.toThrow('rolled back');
  expect(db.puzzle.findMany).not.toHaveBeenCalled();
});

it.each([['--days', '-1'], ['--days', '1.5'], ['--days', '366'], ['--days'], ['--apply'], ['--days', '0', 'extra']])('rejects invalid status options %j', (...args) => {
  expect(() => parseBufferArgs(args)).toThrow('Usage');
});
