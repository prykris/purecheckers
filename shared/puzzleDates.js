const DAY_MS = 86_400_000;
export function todayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
export const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
export const isoDate = date => date.toISOString().slice(0, 10);

export function parsePuzzleDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && isoDate(date) === value ? date : null;
}

export function puzzleCacheSeconds(date, now = new Date()) {
  if (date < todayUtc(now)) return 86400;
  return Math.max(0, Math.min(300, Math.floor((addDays(todayUtc(now), 1) - now) / 1000)));
}
