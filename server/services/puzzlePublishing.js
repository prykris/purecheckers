import { isDeepStrictEqual } from 'node:util';
import { positionHash, mirror } from '../../shared/puzzleSearch.js';
import { todayUtc, isoDate } from '../../shared/puzzleDates.js';
import { readPuzzleBuffer } from './puzzleBuffer.js';
import { rejectedPuzzleHashes, recordPuzzleRejection, puzzlePositionKeys } from './puzzleRejections.js';

export const PUBLISH_COMMIT_TIMEOUT_MS = 30_000;

// All publishers share this database lock. It lasts only for the transaction;
// process failure rolls back the writes and releases ownership automatically.
export function withPuzzlePublishLock(db, work, { timeout = PUBLISH_COMMIT_TIMEOUT_MS } = {}) {
  return db.$transaction(async tx => {
    const [lock] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(73190603) AS acquired`;
    if (!lock.acquired) return { busy: true };
    return work(tx);
  }, { timeout, maxWait: 5000 });
}

// Searches prepare evidence without holding a database transaction. Only this
// short commit may apply it, after comparing the rows with the observed source.
export function commitPuzzlePublication(db, { changes = [], puzzles = [], targetBuffer = 30 }) {
  return withPuzzlePublishLock(db, async tx => {
    const existing = await tx.puzzle.findMany({ select: { date: true, positionHash: true } });
    const observed = changes.length ? await tx.puzzle.findMany({ where: { id: { in: changes.map(change => change.row.id) } } }) : [];
    const byId = new Map(observed.map(row => [row.id, row]));
    const dates = new Set(existing.map(row => isoDate(row.date)));
    const hashes = new Set(existing.map(row => row.positionHash));
    const failedHashes = await rejectedPuzzleHashes(tx);
    const result = { written: 0, deleted: 0, deepened: 0, skipped: [], retained: [], protectedFailures: [] };
    for (const change of changes) {
      const { row, depth } = change, current = byId.get(row.id);
      const retain = reason => {
        const item = { id: row.id, date: isoDate(row.date), reason };
        result.retained.push(item);
        if (change.remove) result.protectedFailures.push(item);
      };
      if (!current || !isDeepStrictEqual(current, row)) { retain('changed-since-verification'); continue; }
      if (change.remove) for (const hash of await recordPuzzleRejection(tx, change)) failedHashes.add(hash);
      // Protect rows that could become public during this bounded transaction,
      // using the database clock rather than a process-start or transaction timestamp.
      const affected = change.remove
        ? await tx.$executeRaw`DELETE FROM "Puzzle" WHERE id = ${row.id}
            AND date > ((clock_timestamp() + ${PUBLISH_COMMIT_TIMEOUT_MS} * interval '1 millisecond') AT TIME ZONE 'UTC')::date
            AND NOT EXISTS (SELECT 1 FROM "PuzzleAttempt" WHERE "puzzleId" = ${row.id})`
        : await tx.$executeRaw`UPDATE "Puzzle" SET "verifiedDepth" = ${depth} WHERE id = ${row.id}
            AND date > ((clock_timestamp() + ${PUBLISH_COMMIT_TIMEOUT_MS} * interval '1 millisecond') AT TIME ZONE 'UTC')::date`;
      if (!affected) { retain('published-or-protected'); continue; }
      if (change.remove) { dates.delete(isoDate(row.date)); hashes.delete(row.positionHash); result.deleted++; }
      else result.deepened++;
    }
    const [{ now }] = await tx.$queryRaw`SELECT clock_timestamp() AS now`;
    const today = todayUtc(now);
    for (const row of puzzles) {
      const date = isoDate(row.date);
      let reason;
      if (row.date < today) reason = 'date-passed';
      else if (dates.has(date)) reason = 'date-occupied';
      else if (puzzlePositionKeys(row.position).some(hash => failedHashes.has(hash))) reason = 'failed-verification';
      else if (hashes.has(row.positionHash) || hashes.has(positionHash(mirror(row.position)))) reason = 'equivalent-position';
      if (reason) { result.skipped.push({ date, reason }); continue; }
      const { _meta, ...data } = row;
      await tx.puzzle.create({ data });
      dates.add(date); hashes.add(row.positionHash); result.written++;
    }
    const [{ now: completedAt }] = await tx.$queryRaw`SELECT clock_timestamp() AS now`;
    const buffer = await readPuzzleBuffer(tx, { days: targetBuffer, now: completedAt });
    return { ...result, remaining: buffer.missingDates.length, buffer };
  });
}
