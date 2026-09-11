// ============================================================
// Board positions for article diagrams
//
// A position is a 64-character string, row-major from the top of the board
// (black's side, row 0) to the bottom (red's side, row 7):
//   .  empty square      r  red man      R  red king
//                        b  black man    B  black king
// Whitespace and "/" are ignored so authors can write eight rows of eight.
//
// Squares are named with the standard 1-32 checkers numbering. The numbering
// runs from the top-left corner as seen by the side that moves second, and the
// side that moves first sits on squares 1-12. On Pure Checkers red moves first
// and is drawn at the bottom, so square 1 is red's bottom-right dark square
// and square 32 is black's top-left one. See the rules pillar article.
// ============================================================

import { CheckersGame } from '../game.js';
import { squareNumber, squareCoords, moveNotation } from '../../../shared/notation.js';
export { squareNumber, squareCoords, moveNotation };

export const PIECE_CHARS = {
  '.': null,
  r: { color: 'red', queen: false },
  R: { color: 'red', queen: true },
  b: { color: 'black', queen: false },
  B: { color: 'black', queen: true }
};

export const START_POSITION =
  '.b.b.b.b' +
  'b.b.b.b.' +
  '.b.b.b.b' +
  '........' +
  '........' +
  'r.r.r.r.' +
  '.r.r.r.r' +
  'r.r.r.r.';

export function isDark(r, c) {
  return (r + c) % 2 === 1;
}

export function normalizePosition(str) {
  return String(str).replace(/[\s/]/g, '');
}

/** Parse a position string into an 8x8 board array. Throws on bad input. */
export function parsePosition(str) {
  const s = normalizePosition(str);
  if (s.length !== 64) throw new Error(`Position must have 64 squares, got ${s.length}`);
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let i = 0; i < 64; i++) {
    const ch = s[i];
    if (!(ch in PIECE_CHARS)) throw new Error(`Bad character "${ch}" at index ${i}`);
    const r = Math.floor(i / 8), c = i % 8;
    const piece = PIECE_CHARS[ch];
    if (piece && !isDark(r, c)) throw new Error(`Piece on a light square at row ${r}, col ${c}`);
    board[r][c] = piece ? { ...piece } : null;
  }
  return board;
}

export function serializePosition(board) {
  let out = '';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) out += '.';
      else if (p.color === 'red') out += p.queen ? 'R' : 'r';
      else out += p.queen ? 'B' : 'b';
    }
  return out;
}

/** Build a CheckersGame from a position string, the way the engine tests do. */
export function gameFromPosition(str, toMove = 'red', turnTime = 0) {
  if (toMove !== 'red' && toMove !== 'black') throw new Error(`toMove must be red or black, got ${toMove}`);
  const game = new CheckersGame(turnTime);
  game.board = parsePosition(str);
  game.currentPlayer = toMove;
  game.chainPiece = null;
  game.moveHistory = [];
  game.movesWithoutCapture = 0;
  game.positionHistory = [game._boardHash()];
  return game;
}

/** "11-15", "15x22" or "22x15x8" -> [{ fromRow, fromCol, toRow, toCol }, ...] */
export function parseMove(notation) {
  const squares = String(notation).trim().split(/\s*[-x×]\s*/).map(Number);
  if (squares.length < 2 || squares.some(n => !Number.isInteger(n) || n < 1 || n > 32)) {
    throw new Error(`Bad move notation: ${notation}`);
  }
  const steps = [];
  for (let i = 1; i < squares.length; i++) {
    const from = squareCoords(squares[i - 1]);
    const to = squareCoords(squares[i]);
    steps.push({ fromRow: from.row, fromCol: from.col, toRow: to.row, toCol: to.col });
  }
  return steps;
}

/** One visible step per hop, so a chain never animates across its corner. */
export function diagramSteps(moves = []) {
  return moves.flatMap(entry => {
    const { move, note = '' } = typeof entry === 'string' ? { move: entry } : entry;
    const hops = parseMove(move);
    const separator = /[x×]/.test(move) ? 'x' : '-';
    return hops.map((hop, index) => ({
      move: `${squareNumber(hop.fromRow, hop.fromCol)}${separator}${squareNumber(hop.toRow, hop.toCol)}`,
      note: index === hops.length - 1 ? note : `Jump ${index + 1} of ${hops.length} in ${move}. The same piece continues.`
    }));
  });
}

function pieceName(p) {
  return `${p.color} ${p.queen ? 'king' : 'man'}`;
}

/** Every occupied square, in ascending square order. */
export function listPieces(board) {
  const out = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) out.push({ square: squareNumber(r, c), row: r, col: c, piece: pieceName(p) });
    }
  return out.sort((a, b) => a.square - b.square);
}

/** One-sentence text description of a position for aria-labels. */
export function describePosition(board, toMove) {
  const groups = { 'red king': [], 'red man': [], 'black king': [], 'black man': [] };
  for (const { square, piece } of listPieces(board)) groups[piece].push(square);
  const parts = [];
  for (const [name, squares] of Object.entries(groups)) {
    if (!squares.length) continue;
    const plural = squares.length > 1 ? (name.endsWith('man') ? name.slice(0, -3) + 'men' : name + 's') : name;
    parts.push(`${plural} on ${squares.join(', ')}`);
  }
  const mover = toMove === 'black' ? 'Black' : 'Red';
  return `${mover} to move. ${parts.length ? parts.join('; ') : 'Empty board'}.`;
}
