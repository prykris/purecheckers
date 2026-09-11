import { CheckersGame } from '../../shared/game.js';

export function finalPosition(history) {
  if (!Array.isArray(history) || history.length > 10000) throw new Error('Invalid replay history');
  const game = new CheckersGame(0);
  for (const move of history) {
    if (!game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol)) throw new Error('Replay diverges from the rules');
  }
  return game.board;
}

export function boardSvg(board, { x = 48, y = 48, size = 534 } = {}) {
  if (!Array.isArray(board) || board.length !== 8 || board.some(row => !Array.isArray(row) || row.length !== 8)) throw new Error('Invalid board');
  const cell = size / 8, parts = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const cx = x + c * cell, cy = y + r * cell;
    parts.push(`<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="${(r + c) % 2 ? '#7c5e3c' : '#d4a76a'}"/>`);
    const p = board[r][c];
    if (!p) continue;
    if (!['red', 'black'].includes(p.color)) throw new Error('Invalid piece');
    parts.push(`<circle cx="${cx + cell / 2}" cy="${cy + cell / 2}" r="${cell * .33}" fill="${p.color === 'red' ? '#ef4444' : '#3d3530'}" stroke="${p.color === 'red' ? '#b91c1c' : '#1c1917'}" stroke-width="3"/>`);
    if (p.queen) parts.push(`<path d="M-13 8L-16-7L-6-1L0-12L6-1L16-7L13 8Z" transform="translate(${cx + cell / 2} ${cy + cell / 2}) scale(${cell / 66.75})" fill="#fbbf24"/>`);
  }
  return parts.join('') + `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="#3d3530" stroke-width="2"/>`;
}
