import { boardSvg } from './board.js';
import { CheckersGame } from '../../shared/game.js';
import { TURN_TIME } from '../../shared/constants.js';
import { gameEndReason, gameResultLabel, winningColor } from '../../shared/gameResult.js';

const escape = value => String(value).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
// All meaningful content lives in the centered 630px square. The worker fits
// each bounded text line with the actual shipped font before rasterization.
const text = (value, x, y, size = 26, color = '#fafaf9', weight = 500, width = 574) =>
  `<text x="${x}" y="${y}" font-family="Poppins" font-size="${size}" font-weight="${weight}" fill="${color}" data-fit-width="${width}" data-min-size="${Math.min(size, 22)}">${escape(value)}</text>`;
const date = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const footer = text('Pure Checkers', 28, 553, 32, '#ef4444', 700) + text('purecheckers.com · Free to play', 28, 590, 20, '#a8a29e');
const frame = body => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#1c1917"/><g transform="translate(285 0)" data-card-content="true">${body}<path d="M28 515H602" stroke="#3d3530"/>${footer}</g></svg>`;
const boardPosition = { x: 28, y: 145, size: 330 };
const board = position => boardSvg(position, boardPosition);
const initials = name => Array.from(String(name)).slice(0, 2).join('').toUpperCase();
const avatar = (name, x, y) => {
  const hue = [...String(name)].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
  return `<circle cx="${x}" cy="${y}" r="28" fill="hsl(${hue},45%,35%)"/>`
    + text(initials(name), x - 24, y + 9, 24, '#fafaf9', 600, 48);
};
const deltaChip = (value, y, ranked) => {
  if (!ranked || !Number.isFinite(value) || value === 0) return '';
  const positive = value > 0;
  return `<rect x="380" y="${y - 27}" width="222" height="39" rx="8" fill="${positive ? '#143426' : '#3e2027'}"/>`
    + text(`${positive ? '+' : ''}${value} ELO`, 392, y, 24, positive ? '#86efac' : '#fda4af', 600, 198);
};

export function gameTemplate({ game, board: position }) {
  const winner = winningColor(game.result);
  const headline = winner ? `${winner === 'red' ? game.redPlayer : game.blackPlayer} beat ${winner === 'red' ? game.blackPlayer : game.redPlayer}`
    : game.result === 'DRAW' ? `${game.redPlayer} and ${game.blackPlayer} drew` : gameResultLabel(game.result);
  let body = text(headline, 28, 60, 34, '#fafaf9', 600)
    + text(gameEndReason(game.endReason, game.result), 28, 101, 22, '#a8a29e') + board(position);
  for (const [color, name, change, y] of [
    ['red', game.redPlayer, game.redEloChange, 156], ['black', game.blackPlayer, game.blackEloChange, 267]
  ]) {
    body += `<circle cx="389" cy="${y - 7}" r="8" fill="${color === 'red' ? '#ef4444' : '#3d3530'}" stroke="#a8a29e"/>`
      + text(color === 'red' ? 'Red' : 'Black', 408, y, 20, '#a8a29e', 500, 194)
      + text(name, 380, y + 36, 26, winner === color ? '#86efac' : '#a8a29e', 600, 222)
      + deltaChip(change, y + 73, game.mode === 'RANKED');
  }
  body += text(gameResultLabel(game.result), 380, 380, 22, '#fafaf9', 600, 222)
    + text(game.isBotGame ? 'Against a bot' : game.mode === 'RANKED' ? 'Ranked game' : 'Friendly game', 380, 416, 22, '#a8a29e', 500, 222)
    + text(`${game.moveCount ?? 0} ${game.moveCount === 1 ? 'move' : 'moves'}`, 380, 450, 22, '#a8a29e', 500, 222)
    + text(date(game.date), 28, 499, 20, '#a8a29e');
  return frame(body);
}

export function puzzleTemplate(puzzle) {
  return frame(text('Daily checkers puzzle', 28, 60, 34, '#fafaf9', 600)
    + text(date(puzzle.date), 28, 101, 22, '#a8a29e') + board(puzzle.position.board)
    + text(puzzle.sideToMove === 'red' ? 'Red to move' : 'Black to move', 380, 211, 26, '#fafaf9', 600, 222)
    + text('Find the', 380, 270, 26, '#a8a29e', 500, 222)
    + text('combination', 380, 306, 26, '#a8a29e', 500, 222));
}

// The decorative starting board never depends on room occupancy or a clock.
const startingBoard = board(new CheckersGame(0).board);
export function inviteTemplate(invite) {
  const wager = invite.buyIn > 0;
  let body = avatar(invite.hostName, 56, 53)
    + text(invite.hostName, 100, 63, 34, '#fafaf9', 600, 502)
    + text('wants to play you at checkers', 28, 112, 30, '#fafaf9', 600) + startingBoard;
  body += wager
    ? text('Wager', 380, 183, 26, '#fafaf9', 600, 222) + text(`${invite.buyIn} coins`, 380, 216, 24, '#fafaf9', 600, 222)
    : text('Free game', 380, 199, 26, '#fafaf9', 600, 222);
  body += wager
    ? text('Registered account', 380, 264, 22, '#a8a29e', 500, 222) + text('required', 380, 295, 22, '#a8a29e', 500, 222)
    : text('No account needed', 380, 246, 22, '#a8a29e', 500, 222);
  body += text('Tap to join', 380, 352, 26, '#fafaf9', 600, 222);
  if (invite.turnTimer !== TURN_TIME) {
    body += text(invite.turnTimer ? `${invite.turnTimer} s per move` : 'No move clock', 380, 402, 22, '#a8a29e', 500, 222);
  }
  return frame(body);
}

export function playerTemplate({ player, activity, today }) {
  let body = avatar(player.username, 56, 58) + text(player.username, 100, 68, 34, '#fafaf9', 600, 502)
    + text(`ELO ${player.elo} · Peak ${player.peakElo}`, 28, 153, 32)
    + text(`${player.wins} wins · ${player.losses} losses`, 28, 207, 26, '#a8a29e');
  const rate = player.gamesPlayed ? Math.round(player.wins / player.gamesPlayed * 100) : 0;
  body += text(`${rate}% win rate`, 28, 248, 26, '#a8a29e');
  const max = Math.max(1, ...Object.values(activity));
  for (let i = 0; i < 84; i++) {
    const day = new Date(new Date(today).getTime() - (83 - i) * 86400000).toISOString().slice(0, 10);
    const count = activity[day] ?? 0;
    body += `<rect x="${28 + Math.floor(i / 7) * 27}" y="${294 + i % 7 * 27}" width="22" height="22" rx="3" fill="${count ? '#22c55e' : '#3d3530'}" opacity="${count ? .35 + .65 * count / max : 1}"/>`;
  }
  body += text('Last 12 weeks', 380, 335, 24, '#a8a29e', 500, 222)
    + text('Member since', 380, 402, 22, '#a8a29e', 500, 222)
    + text(date(player.createdAt), 380, 440, 20, '#a8a29e', 500, 222);
  return frame(body);
}
