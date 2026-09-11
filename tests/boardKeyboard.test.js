import { nextBoardSquare } from '../src/lib/boardKeyboard.js';
import { squareNumber } from '../shared/notation.js';

it('keeps arrow navigation on playable squares in both orientations', () => {
  for (const flipped of [false, true]) for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    if (!squareNumber(row, col)) continue;
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      const next = nextBoardSquare(row, col, key, flipped);
      expect(squareNumber(next.row, next.col)).toBeGreaterThan(0);
      const beforeRow = flipped ? 7 - row : row, afterRow = flipped ? 7 - next.row : next.row;
      const beforeCol = flipped ? 7 - col : col, afterCol = flipped ? 7 - next.col : next.col;
      if (key === 'ArrowUp') expect(afterRow).toBeLessThanOrEqual(beforeRow);
      if (key === 'ArrowDown') expect(afterRow).toBeGreaterThanOrEqual(beforeRow);
      if (key === 'ArrowLeft') expect(afterCol).toBeLessThanOrEqual(beforeCol);
      if (key === 'ArrowRight') expect(afterCol).toBeGreaterThanOrEqual(beforeCol);
    }
  }
});
it('leaves activation, Escape and Tab to the owning view and native button', () => {
  for (const key of ['Enter', ' ', 'Escape', 'Tab']) expect(nextBoardSquare(5, 2, key)).toBeNull();
});
