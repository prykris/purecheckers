/** Arrow movement follows the displayed board, including a flipped black view. */
export function nextBoardSquare(row, col, key, flipped = false) {
  const vr = flipped ? 7 - row : row, vc = flipped ? 7 - col : col;
  const delta = { ArrowLeft: [0, -2], ArrowRight: [0, 2], ArrowUp: [-1, vr % 2 ? 1 : -1], ArrowDown: [1, vr % 2 ? 1 : -1] }[key];
  if (!delta) return null;
  const nr = vr + delta[0], nc = vc + delta[1];
  if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return { row, col };
  return { row: flipped ? 7 - nr : nr, col: flipped ? 7 - nc : nc };
}
