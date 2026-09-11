import { CheckersGame } from '../../shared/game.js';
import { TURN_TIME } from '../../shared/constants.js';
import { gameTemplate, inviteTemplate, playerTemplate, puzzleTemplate } from '../../server/og/templates.js';

const board = new CheckersGame(0).board;
board[5][0].queen = true;
const game = { result: 'RED_WIN', redPlayer: 'Chris', blackPlayer: 'Dana', redEloChange: 14, blackEloChange: -14,
  date: '2026-09-11', mode: 'RANKED', endReason: 'resign', moveCount: 34 };
const player = { username: 'Chris', elo: 1250, peakElo: 1280, wins: 42, losses: 31, gamesPlayed: 80, createdAt: '2026-03-01' };
export const previewCards = [
  ['game-win', gameTemplate({ game, board })],
  ['game-draw', gameTemplate({ game: { ...game, result: 'DRAW', endReason: 'draw-agreement', redEloChange: -2, blackEloChange: 2 }, board })],
  ['game-cancelled', gameTemplate({ game: { ...game, result: 'ABORTED', endReason: 'restart-abandoned', redEloChange: 0, blackEloChange: 0 }, board })],
  ['game-long-names', gameTemplate({ game: { ...game, redPlayer: 'W'.repeat(40), blackPlayer: 'M'.repeat(40) }, board })],
  ['game-friendly', gameTemplate({ game: { ...game, mode: 'FRIENDLY', isBotGame: true, blackPlayer: 'Bot Hard' }, board })],
  ['invite-free', inviteTemplate({ hostName: 'Chris', buyIn: 0, turnTimer: TURN_TIME })],
  ['invite-wager', inviteTemplate({ hostName: 'Chris', buyIn: 20, turnTimer: 90 })],
  ['invite-long-name', inviteTemplate({ hostName: '<W&>'.repeat(10), buyIn: 2147483647, turnTimer: 0 })],
  ['player', playerTemplate({ player, activity: { '2026-09-10': 8, '2026-09-11': 3 }, today: '2026-09-11' })],
  ['player-long-name', playerTemplate({ player: { ...player, username: 'W'.repeat(40) }, activity: {}, today: '2026-09-11' })],
  ['puzzle-red', puzzleTemplate({ position: { board }, sideToMove: 'red', date: '2026-09-11' })],
  ['puzzle-black', puzzleTemplate({ position: { board }, sideToMove: 'black', date: '2026-09-11' })]
];
