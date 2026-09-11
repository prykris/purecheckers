import { squareNumber, squareCoords, moveNotation } from '../shared/notation.js';
import { CheckersGame } from '../shared/game.js';
import { parseMove } from '../src/lib/content/position.js';

it('numbers every playable square consistently in both directions', () => {
  for (let n = 1; n <= 32; n++) {
    const { row, col } = squareCoords(n);
    expect(squareNumber(row, col)).toBe(n);
    expect((row + col) % 2).toBe(1);
  }
  expect(squareCoords(0)).toBeNull();
  expect(squareNumber(8, 1)).toBeNull();
  expect(squareNumber(0, 0)).toBeNull();
});

it('uses first-mover notation for a legal 11-15 opening in the engine', () => {
  const game = new CheckersGame();
  const [move] = parseMove('11-15');
  expect(move).toEqual({ fromRow: 5, fromCol: 2, toRow: 4, toCol: 3 });
  expect(game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol)).toBeTruthy();
  expect(moveNotation(move)).toBe('11-15');
});

it('formats a capture chain without dropping its intermediate landing', () => {
  const hops = parseMove('14x21x30');
  expect(moveNotation({ hops, captured: [{ row: 1, col: 0 }] })).toBe('14x21x30');
  expect(() => parseMove('0-12')).toThrow(/Bad move/);
});
