import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import prisma from '../server/db.js';
import { commitPuzzlePublication, withPuzzlePublishLock } from '../server/services/puzzlePublishing.js';
import { puzzlePositionKeys } from '../server/services/puzzleRejections.js';
import { importPuzzleBatch } from '../scripts/import-puzzles.js';
import { mirror, positionHash } from '../shared/puzzleSearch.js';
import { readPuzzleBuffer } from '../server/services/puzzleBuffer.js';
import { maintainPuzzleBuffer } from '../scripts/maintain-puzzles.js';
import { GENERATOR_VERSION, reverifyUpcoming } from '../scripts/generate-puzzles.js';
import { addDays, todayUtc, isoDate } from '../shared/puzzleDates.js';
const buffer = JSON.parse(readFileSync(new URL('../data/puzzles/launch-buffer.json', import.meta.url)));
const fixture = buffer[0];
const removal = row => ({ row, remove: true, depth: Math.min(row.verifiedDepth + 2, 12), reason: 'gap', verifierVersion: GENERATOR_VERSION });
let today, created, hashes, rejectionKeys;
beforeEach(async () => { const [{ now }] = await prisma.$queryRaw`SELECT clock_timestamp() AS now`; today = todayUtc(now); created = []; hashes = []; rejectionKeys = []; });
afterEach(async () => {
  const owned = { OR: [{ id: { in: created } }, { positionHash: { in: hashes } }] };
  await prisma.puzzleAttempt.deleteMany({ where: { puzzle: owned } });
  await prisma.puzzle.deleteMany({ where: owned });
  await prisma.puzzleRejection.deleteMany({ where: { positionHash: { in: rejectionKeys } } });
});
async function row(days, overrides = {}) {
  const value = await prisma.puzzle.create({ data: { ...fixture, date: addDays(today, days), positionHash: randomUUID(), ...overrides } });
  created.push(value.id); hashes.push(value.positionHash); rejectionKeys.push(...puzzlePositionKeys(value.position)); return value;
}

it('prepares conclusive failures, deepenings and inconclusive results without any writes or transaction', async () => {
  const rows = [0, 1, 2, 3].map((offset, id) => ({ ...fixture, id, date: addDays(today, offset + 1), verifiedDepth: id === 3 ? 12 : 8 }));
  const verify = vi.fn().mockReturnValueOnce({ ok: false, conclusive: true, reason: 'gap' })
    .mockReturnValueOnce({ ok: false, conclusive: false, reason: 'budget' }).mockReturnValue({ ok: true });
  const db = { puzzle: { findMany: vi.fn(async () => rows) }, $transaction: vi.fn() };
  const result = await reverifyUpcoming({ prisma: db, now: today, verify, log: () => {} });
  expect(result).toMatchObject({ checked: 4, proposedDeletions: 1, proposedDeepenings: 1, inconclusive: 1 });
  expect(result.changes).toEqual([removal(rows[0]), { row: rows[2], depth: 10 }]);
  expect(verify.mock.calls.map(args => args[2])).toEqual([10, 10, 10, 12]);
  expect(db.puzzle.findMany).toHaveBeenCalledWith({ where: { date: { gte: addDays(today, 1), lte: addDays(today, 7) } }, orderBy: { date: 'asc' } });
  expect(db.$transaction).not.toHaveBeenCalled();
});

it('preserves a failed puzzle that became published after preparation while committing unrelated work', async () => {
  const published = await row(0), future = await row(2), deeper = await row(3);
  // Preparation selected tomorrow relative to yesterday; commit sees today's database clock.
  const proposal = await reverifyUpcoming({ prisma: { puzzle: { findMany: async () => [published, future] } }, now: addDays(today, -1),
    verify: () => ({ ok: false, conclusive: true, reason: 'gap' }), log: () => {} });
  const result = await commitPuzzlePublication(prisma, { changes: [...proposal.changes, { row: deeper, depth: 12 }], targetBuffer: 0 });
  expect(result).toMatchObject({ deleted: 1, deepened: 1, remaining: 0,
    protectedFailures: [{ id: published.id, date: isoDate(today), reason: 'published-or-protected' }] });
  expect(await prisma.puzzle.findUnique({ where: { id: published.id } })).toEqual(published);
  expect(await prisma.puzzle.findUnique({ where: { id: future.id } })).toBeNull();
  expect((await prisma.puzzle.findUnique({ where: { id: deeper.id } })).verifiedDepth).toBe(12);
});

it('does not deepen a published row or apply evidence to a row changed since verification', async () => {
  const published = await row(0), stale = await row(2);
  await prisma.puzzle.update({ where: { id: stale.id }, data: { commentary: { ...stale.commentary, position: 'Reviewed after preparation' } } });
  const result = await commitPuzzlePublication(prisma, { changes: [{ row: published, depth: 12 }, removal(stale)], targetBuffer: 0 });
  expect(result).toMatchObject({ deleted: 0, deepened: 0 });
  expect(result.retained.map(item => item.reason)).toEqual(['published-or-protected', 'changed-since-verification']);
  expect((await prisma.puzzle.findUnique({ where: { id: published.id } })).verifiedDepth).toBe(published.verifiedDepth);
  expect(await prisma.puzzle.findUnique({ where: { id: stale.id } })).not.toBeNull();
  expect(await prisma.puzzleRejection.count()).toBe(0);
});

it('preserves attempts when a legacy future puzzle cannot safely be removed', async () => {
  const future = await row(2);
  const attempt = await prisma.puzzleAttempt.create({ data: { puzzleId: future.id, visitorId: randomUUID(), solved: false, attempts: 1 } });
  const result = await commitPuzzlePublication(prisma, { changes: [removal(future)], targetBuffer: 0 });
  expect(result.deleted).toBe(0); expect(result.protectedFailures).toHaveLength(1);
  expect(await prisma.puzzleAttempt.findUnique({ where: { id: attempt.id } })).not.toBeNull();
});

it('rechecks dates and equivalent positions when competing prepared batches commit', async () => {
  const first = { ...fixture, date: addDays(today, 2), positionHash: randomUUID() };
  const result = await commitPuzzlePublication(prisma, { puzzles: [first], targetBuffer: 0 });
  const stored = await prisma.puzzle.findUnique({ where: { date: first.date } }); created.push(stored.id);
  expect(result.written).toBe(1);
  const retry = await commitPuzzlePublication(prisma, { puzzles: [first, { ...first, date: addDays(today, 3) }, { ...first, date: addDays(today, -1) }], targetBuffer: 0 });
  expect(retry.written).toBe(0);
  expect(retry.skipped.map(item => item.reason)).toEqual(['date-occupied', 'equivalent-position', 'date-passed']);
});

it('rolls back removals if inserting the prepared replacement fails', async () => {
  const future = await row(2);
  const invalid = { ...buffer[1], date: future.date, positionHash: randomUUID(), difficulty: 'INVALID' };
  await expect(commitPuzzlePublication(prisma, { changes: [removal(future)], puzzles: [invalid], targetBuffer: 0 })).rejects.toThrow();
  expect(await prisma.puzzle.findUnique({ where: { id: future.id } })).toEqual(future);
  expect(await prisma.puzzleRejection.findUnique({ where: { positionHash: puzzlePositionKeys(future.position)[0] } })).toBeNull();
  expect(await withPuzzlePublishLock(prisma, async () => ({ released: true }))).toEqual({ released: true });
});

it('keeps rejection evidence after deletion and blocks later and mirrored proposals and imports', async () => {
  const failed = await row(2);
  await commitPuzzlePublication(prisma, { changes: [removal(failed)], targetBuffer: 0 });
  const key = puzzlePositionKeys(failed.position)[0];
  expect(await prisma.puzzleRejection.findUnique({ where: { positionHash: key } })).toMatchObject({
    sourceDate: failed.date, reason: 'gap', verifiedDepth: removal(failed).depth, generatorVersion: failed.generatorVersion, verifierVersion: GENERATOR_VERSION });
  expect(await prisma.puzzle.findUnique({ where: { id: failed.id } })).toBeNull();
  const rotated = mirror(failed.position);
  const proposals = [{ ...fixture, date: addDays(today, 3) },
    { ...fixture, date: addDays(today, 4), position: rotated, positionHash: positionHash(rotated), sideToMove: rotated.currentPlayer }];
  const later = await commitPuzzlePublication(prisma, { puzzles: proposals, targetBuffer: 0 });
  expect(later.written).toBe(0);
  expect(later.skipped.map(item => item.reason)).toEqual(['failed-verification', 'failed-verification']);
  const valid = { ...buffer[1], date: addDays(today, 5) }; hashes.push(valid.positionHash);
  for (const rejected of proposals) {
    await expect(importPuzzleBatch(prisma, [valid, rejected])).rejects.toThrow('recorded verification failure');
    expect(await prisma.puzzle.findUnique({ where: { date: valid.date } })).toBeNull();
  }
});

it('keeps the strongest failure on retries and makes retained published failures visible in later status runs', async () => {
  const published = await row(0, { positionHash: fixture.positionHash });
  await commitPuzzlePublication(prisma, { changes: [{ ...removal(published), depth: 12 }], targetBuffer: 0 });
  const first = await prisma.puzzleRejection.findUnique({ where: { positionHash: puzzlePositionKeys(published.position)[0] } });
  await commitPuzzlePublication(prisma, { changes: [{ ...removal(published), depth: 8, reason: 'weaker retry' }], targetBuffer: 0 });
  expect(await prisma.puzzleRejection.findUnique({ where: { positionHash: first.positionHash } })).toEqual(first);
  expect(await readPuzzleBuffer(prisma, { now: today, days: 0 })).toMatchObject({ availableDays: 1, calendarComplete: true,
    healthy: false, rejectedDates: [isoDate(today)], missingDates: [] });
  const status = await maintainPuzzleBuffer({ db: prisma, options: { targetBuffer: 0 }, now: () => today, run: async () => ({ written: 0 }) });
  expect(status.exitCode).toBe(5);
  expect(status.protectedFailures).toEqual([]);
});

it('cannot reintroduce a failed position through another prepared candidate in the same commit', async () => {
  const failed = await row(2);
  const result = await commitPuzzlePublication(prisma, { changes: [removal(failed)],
    puzzles: [{ ...fixture, date: failed.date, positionHash: failed.positionHash }], targetBuffer: 0 });
  expect(result).toMatchObject({ deleted: 1, written: 0, skipped: [{ date: isoDate(failed.date), reason: 'failed-verification' }] });
});
