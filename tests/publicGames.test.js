import { discoverableGames, isDiscoverableGame } from '../server/services/publicGames.js';

const human = { isGuest: false, isBot: false, username: 'Bot Pretender' };
const guest = { isGuest: true, isBot: false, username: 'Custom name' };
const game = { redPlayer: human, blackPlayer: guest, result: 'RED_WIN', moveHistory: Array(10).fill({}) };

it('uses account facts and the documented discovery thresholds', () => {
  expect(isDiscoverableGame(game)).toBe(true);
  expect(isDiscoverableGame({ ...game, redPlayer: guest })).toBe(false);
  expect(isDiscoverableGame({ ...game, blackPlayer: { ...human, isBot: true } })).toBe(false);
  expect(isDiscoverableGame({ ...game, result: 'ABORTED' })).toBe(false);
  expect(isDiscoverableGame({ ...game, moveHistory: Array(9).fill({}) })).toBe(false);
  expect(isDiscoverableGame({ ...game, moveHistory: null })).toBe(false);
});

it('keeps scanning after a batch of thin games and stops at the end', async () => {
  const findMany = vi.fn().mockResolvedValueOnce([{ ...game, id: 3, moveHistory: [] }, { ...game, id: 2, moveHistory: [] }]).mockResolvedValueOnce([{ ...game, id: 1 }]);
  const rows = [];
  for await (const row of discoverableGames({ game: { findMany } }, { batchSize: 2 })) rows.push(row.id);
  expect(rows).toEqual([1]);
  expect(findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: 2 }, skip: 1 });
});
