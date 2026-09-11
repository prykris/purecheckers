import { historyDetails, historyPerspective, historyTime } from '../src/lib/gameHistoryPresentation.js';

const game = {
  redPlayerId: 1, blackPlayerId: 2, result: 'RED_WIN', mode: 'RANKED',
  redEloChange: 14, blackEloChange: -14, endReason: 'resign', moveCount: 7,
  date: '2026-09-11T10:00:00Z', endedAt: '2026-09-11T10:02:03Z'
};

it('uses participant IDs for perspective and preserves both rating changes for observers', () => {
  expect(historyPerspective(game, 2)).toEqual({ color: 'black', result: 'loss' });
  expect(historyPerspective(game, 3)).toEqual({ color: null, result: 'unknown' });
  const own = historyDetails(game, 2);
  expect(own).toContainEqual({ label: 'Rating change', value: '-14' });
  expect(own.find(d => d.label === 'Duration').value).toBe('2m 3s');
  expect(own.find(d => d.label === 'Recorded moves').value).toBe('7');
  expect(historyDetails(game, 3).filter(d => d.label.endsWith('rating'))).toEqual([
    { label: 'Red rating', value: '+14' }, { label: 'Black rating', value: '-14' }
  ]);
});

it('does not invent missing statistics or rating rewards for friendly/cancelled games', () => {
  const details = historyDetails({ ...game, mode: 'FRIENDLY', result: 'ABORTED', endReason: 'restart-abandoned', moveCount: null, endedAt: null }, 1);
  expect(historyPerspective({ ...game, result: 'ABORTED' }, 1).result).toBe('cancelled');
  expect(details.some(d => /rating|Duration|Recorded moves/i.test(d.label))).toBe(false);
  expect(historyDetails({ ...game, endedAt: 'invalid' }, 1).some(d => d.label === 'Duration')).toBe(false);
  expect(historyDetails({ ...game, endedAt: '2026-09-10' }, 1).some(d => d.label === 'Duration')).toBe(false);
  expect(historyDetails({ ...game, moveCount: 0, redEloChange: 0 }, 1)).toContainEqual({ label: 'Rating change', value: '0' });
});

it('formats relative time without negative or fabricated timestamps', () => {
  const now = Date.parse('2026-09-11T10:05:00Z');
  expect(historyTime(game.date, now)).toBe('5m ago');
  expect(historyTime('2026-09-11T11:00:00Z', now)).toBe('just now');
  for (const date of [null, undefined, 'invalid']) expect(historyTime(date, now)).toBe('Date unavailable');
});
