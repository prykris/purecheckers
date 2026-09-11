import { todayUtc, addDays, isoDate } from './puzzleDates.js';

export const ROTATION = Object.freeze({ 1: 'EASY', 2: 'MEDIUM', 3: 'MEDIUM', 4: 'HARD', 5: 'EASY', 6: 'MEDIUM', 0: 'HARD' });
export const rotationFor = date => ROTATION[date.getUTCDay()];

// The horizon includes today and N future dates: 30 means 31 dated puzzles.
export function puzzleHorizon(today, days) {
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new Error('Buffer days must be an integer from 0 to 365');
  const start = todayUtc(today);
  if (!Number.isFinite(start.getTime())) throw new Error('Invalid buffer date');
  return Array.from({ length: days + 1 }, (_, index) => addDays(start, index));
}

export function missingPuzzleDates(existingDates, today, days) {
  const occupied = new Set(existingDates.map(isoDate));
  return puzzleHorizon(today, days).filter(date => !occupied.has(isoDate(date)));
}

export function planDates({ existingDates = [], today, targetBuffer }) {
  // Zero is the generator's explicit skip-generation option.
  if (targetBuffer === 0) return [];
  return missingPuzzleDates(existingDates, today, targetBuffer).map(date => ({ date, difficulty: rotationFor(date) }));
}
