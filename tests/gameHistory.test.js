import { describeHistory } from '../shared/gameHistory.js';
import { CheckersGame } from '../shared/game.js';

// Legal opening with exchanges followed by a two-hop capture and crowning.
const history = [[5,6,4,5], [2,3,3,4], [4,5,2,3], [1,4,3,2],
  [5,2,4,1], [0,5,1,4], [4,1,2,3], [2,3,0,5]]
  .map(([fromRow, fromCol, toRow, toCol]) => ({ fromRow, fromCol, toRow, toCol }));

it('derives numbered turns, captures and promotion from unannotated historical moves', () => {
  const original = structuredClone(history);
  const result = describeHistory(history);
  expect(result.invalidMoveIndex).toBeNull();
  expect(result.moveLog.map(t => t.notation)).toEqual([
    '9-14', '23-18', '14x23', '26x19', '11-16', '30-26', '16x23x30 K'
  ]);
  expect(result.moveLog.map(t => t.color)).toEqual(['red', 'black', 'red', 'black', 'red', 'black', 'red']);
  expect(result.capturedPieces.red).toEqual(Array.from({ length: 3 }, () => ({ color: 'black', queen: false })));
  expect(result.capturedPieces.black).toEqual([{ color: 'red', queen: false }]);
  const replay = new CheckersGame();
  for (const m of result.moves) expect(replay.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol)).toBeTruthy();
  expect(replay.at(0, 5)).toEqual({ color: 'red', queen: true });
  expect(history).toEqual(original);
});

it('extends the same live turn when the next capture snapshot arrives', () => {
  const before = describeHistory(history.slice(0, -1));
  const after = describeHistory(history);
  expect(before.moveLog.at(-1).notation).toBe('16x23');
  expect(after.moveLog).toHaveLength(before.moveLog.length);
  expect(after.moveLog.at(-1).notation).toBe('16x23x30 K');
  expect(before.moveLog.at(-1).notation).toBe('16x23');
});

it('does not trust stale capture, crown or continuation annotations', () => {
  const stale = history.map(m => ({ ...m, captured: [], promoted: true, chainContinues: true }));
  expect(describeHistory(stale)).toEqual(describeHistory(history));
});

it.each([null, {}, { fromRow: 5, fromCol: 0, toRow: 3, toCol: 0 }])('stops at an invalid step instead of skipping it: %j', bad => {
  const result = describeHistory([history[0], bad, ...history.slice(1)]);
  expect(result.invalidMoveIndex).toBe(1);
  expect(result.moves).toHaveLength(1);
  expect(result.moveLog.map(t => t.notation)).toEqual(['9-14']);
  expect(result.capturedPieces).toEqual({ red: [], black: [] });
});

it('distinguishes an empty history from an unavailable record', () => {
  expect(describeHistory([])).toMatchObject({ moves: [], moveLog: [], invalidMoveIndex: null });
  expect(describeHistory(null)).toMatchObject({ moves: [], invalidMoveIndex: 0 });
});
