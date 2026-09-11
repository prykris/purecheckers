import { isoDate } from '../../shared/puzzleDates.js';
import { puzzleHorizon, missingPuzzleDates } from '../../shared/puzzleSchedule.js';
import { rejectedPuzzleHashes } from './puzzleRejections.js';

export const puzzleBufferExitCode = report => report.rejectedDates.length ? 5 : (report.missingDates.length ? 3 : 0);

// Read-only availability evidence, not a fresh search/quality certification.
export async function readPuzzleBuffer(db, { days = 30, now = new Date() } = {}) {
  const horizon = puzzleHorizon(now, days);
  const rows = await db.puzzle.findMany({
    where: { date: { gte: horizon[0], lte: horizon.at(-1) } }, select: { date: true, positionHash: true }
  });
  const rejected = await rejectedPuzzleHashes(db);
  const rejectedDates = rows.filter(row => rejected.has(row.positionHash)).map(row => isoDate(row.date)).sort();
  const missing = missingPuzzleDates(rows.map(row => row.date), now, days);
  const firstMissingDate = missing[0] ? isoDate(missing[0]) : null;
  return {
    asOf: now.toISOString(), today: isoDate(horizon[0]), through: isoDate(horizon.at(-1)),
    requiredDays: horizon.length, availableDays: horizon.length - missing.length,
    consecutiveDays: firstMissingDate ? horizon.findIndex(date => isoDate(date) === firstMissingDate) : horizon.length,
    firstMissingDate, missingDates: missing.map(isoDate), rejectedDates,
    calendarComplete: missing.length === 0, healthy: missing.length === 0 && rejectedDates.length === 0
  };
}
