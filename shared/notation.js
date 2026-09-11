// ============================================================
// Board notation for puzzle text: the standard 1-32 square numbering.
//
// Isomorphic (no DOM, no Node APIs). The generator, the API and the client
// all import this so commentary, titles and aria-labels agree.
//
// Numbering. The 32 dark squares are numbered 1-32 from the top-left as seen
// by the side that moves second, exactly as in checkers literature, where the
// first mover's men start on 1-12. On this site red moves first and sits at
// the bottom (rows 5-7), black moves second and sits at the top (rows 0-2).
// Seen from black's side the board is rotated 180 degrees, so square 1 is
// board[7][6], 4 is board[7][0] (red's single corner), 12 is board[5][0],
// 29 is board[0][7] and 32 is board[0][1]. Red starts on 1-12, black on 21-32,
// and the classic opening 11-15 is red's man on board[5][2] stepping to
// board[4][3].
//
// Square (r, c) is dark when (r + c) is odd. Its number is
//   (7 - r) * 4 + floor((7 - c) / 2) + 1
// ============================================================

/** Number (1-32) of a dark square, or null for a light square / off-board. */
export function squareNumber(row, col) {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 7 || col < 0 || col > 7) return null;
  if ((row + col) % 2 !== 1) return null;
  return (7 - row) * 4 + Math.floor((7 - col) / 2) + 1;
}

/** Board coordinates of a square number, or null when out of range. */
export function squareCoords(n) {
  if (!Number.isInteger(n) || n < 1 || n > 32) return null;
  const idx = n - 1;
  const row = 7 - Math.floor(idx / 4);
  const slot = idx % 4;               // 0..3 from black's left, i.e. from column 7 downwards
  const parityCol = 7 - slot * 2;     // 7, 5, 3, 1
  // Dark squares in this row have (row + col) odd; shift by one where needed.
  const col = (row + parityCol) % 2 === 1 ? parityCol : parityCol - 1;
  return { row, col };
}

/** "11-15" for a simple move, "14x21x30" for a capture chain (one x per hop). */
export function moveNotation(move) {
  const hops = move.hops || [{ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol }];
  const capture = (move.captured && move.captured.length > 0) || hops.length > 1;
  const sep = capture ? 'x' : '-';
  let text = String(squareNumber(hops[0].fromRow, hops[0].fromCol));
  for (const h of hops) text += sep + squareNumber(h.toRow, h.toCol);
  return text;
}

/** Space-separated notation for a whole line of full moves. */
export function lineNotation(line) {
  return line.map(moveNotation).join(' ');
}

/** "Red" / "Black" with a capital, for prose. */
export function colorName(color) {
  return color === 'red' ? 'Red' : 'Black';
}

/** "red man on 14" / "black king on 27": for aria-labels and prose. */
export function pieceLabel(piece, row, col) {
  if (!piece) return null;
  return `${piece.color} ${piece.queen ? 'king' : 'man'} on ${squareNumber(row, col)}`;
}

/** Square numbers of every piece of a colour, ascending. */
export function squaresOf(board, color, { kings } = {}) {
  const out = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      if (kings === true && !p.queen) continue;
      if (kings === false && p.queen) continue;
      out.push(squareNumber(r, c));
    }
  return out.sort((a, b) => a - b);
}

/** "14, 18 and 22" — English list of square numbers. */
export function listSquares(numbers) {
  const n = numbers.map(String);
  if (n.length === 0) return '';
  if (n.length === 1) return n[0];
  if (n.length === 2) return `${n[0]} and ${n[1]}`;
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}
