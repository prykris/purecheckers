import express from 'express';
import request from 'supertest';
import { CheckersGame } from '../shared/game.js';
import { fullMoves, toPosition } from '../shared/puzzleSearch.js';
import { gamePositions, positionSummary } from '../scripts/generate-puzzles.js';
import { replayPuzzlePositions, puzzleSource } from '../server/services/puzzleSources.js';
import { createPuzzleRouter } from '../server/routes/puzzle.js';

function sourceGame(id = 1) {
  const game = new CheckersGame(0);
  for (let turn = 0; turn < 12 && !game.gameOver; turn++) {
    for (const hop of fullMoves(game)[0].hops) game.makeMove(hop.fromRow, hop.fromCol, hop.toRow, hop.toCol);
  }
  return { id, result: 'RED_WIN', moveHistory: game.moveHistory,
    redPlayer: { username: 'Red player', isGuest: false, isBot: false },
    blackPlayer: { username: '[Expired Guest 42]', isGuest: true, isBot: false } };
}

it('accepts complete-turn positions only after validating the whole discoverable replay', () => {
  const row = sourceGame();
  expect(replayPuzzlePositions(row).map(p => p.ply)).toEqual([8, 9, 10, 11, 12]);
  for (const bad of [null, { fromRow: 8, fromCol: 0, toRow: 9, toCol: 1 },
    { fromRow: 0, fromCol: 0, toRow: 0, toCol: 0 }]) {
    expect(replayPuzzlePositions({ ...row, moveHistory: [...row.moveHistory, bad] })).toEqual([]);
  }
  const chain = row.moveHistory.findIndex((hop, index) => index >= 8 && hop.chainContinues);
  expect(chain).toBeGreaterThanOrEqual(8);
  expect(replayPuzzlePositions({ ...row, moveHistory: row.moveHistory.slice(0, chain + 1) })).toEqual([]);
});

it('scans older batches and excludes bot, aborted and guest-only sources', async () => {
  const first = sourceGame(4), second = sourceGame(3), third = sourceGame(2), eligible = sourceGame(1);
  first.redPlayer.isBot = true; second.result = 'ABORTED'; third.redPlayer.isGuest = true;
  const findMany = vi.fn().mockResolvedValueOnce([first, second]).mockResolvedValueOnce([third, eligible]).mockResolvedValueOnce([]);
  const positions = [];
  for await (const position of gamePositions({ game: { findMany } }, { batchSize: 2 })) positions.push(position);
  expect(positions).toHaveLength(5);
  expect(positions.every(p => p.sourceGameId === 1)).toBe(true);
  expect(findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: 3 }, skip: 1 });
  expect(findMany.mock.calls[2][0]).toMatchObject({ cursor: { id: 1 }, skip: 1 });
});

it('attributes only a matching board and mover, sanitizes guest names and rechecks eligibility', async () => {
  const row = sourceGame(), position = replayPuzzlePositions(row)[0].position;
  const db = { game: { findUnique: vi.fn(async () => row) } };
  const puzzle = { sourceGameId: 1, position, sideToMove: position.currentPlayer };
  expect(await puzzleSource(db, puzzle)).toEqual({ id: 1, url: '/game/1', redPlayer: 'Red player', blackPlayer: 'Guest', redProfileUrl: '/player/Red%20player', blackProfileUrl: null });
  expect(await puzzleSource(db, { ...puzzle, position: toPosition(new CheckersGame(0)) })).toBeNull();
  expect(await puzzleSource(db, { ...puzzle, sideToMove: position.currentPlayer === 'red' ? 'black' : 'red' })).toBeNull();
  row.redPlayer.isBot = true;
  expect(await puzzleSource(db, puzzle)).toBeNull();
  db.game.findUnique.mockResolvedValue(null);
  expect(await puzzleSource(db, puzzle)).toBeNull();
  db.game.findUnique.mockClear();
  expect(await puzzleSource(db, { ...puzzle, sourceGameId: null })).toBeNull();
  expect(db.game.findUnique).not.toHaveBeenCalled();
});

it('serves verified attribution without caching mutable names or exposing an unverified source ID', async () => {
  const row = sourceGame(), position = replayPuzzlePositions(row)[0].position;
  const puzzle = { id: 1, date: new Date('2026-09-09'), sourceGameId: 1, position, sideToMove: position.currentPlayer };
  const db = { puzzle: { findUnique: async () => puzzle, findFirst: async () => null },
    puzzleAttempt: { groupBy: async () => [] }, game: { findUnique: async () => row } };
  const app = express().use(createPuzzleRouter({ db, now: () => new Date('2026-09-11') }));
  const response = await request(app).get('/2026-09-09');
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.puzzle.source).toMatchObject({ url: '/game/1', blackPlayer: 'Guest' });
  expect(response.body.puzzle).not.toHaveProperty('sourceGameId');
  row.result = 'ABORTED';
  const hidden = await request(app).get('/2026-09-09');
  expect(hidden.body.puzzle.source).toBeNull();
  expect(hidden.headers['cache-control']).toBe('no-store');
});

it('describes actual men and kings rather than converting weighted evaluation into pieces', () => {
  const game = new CheckersGame(0);
  game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [row, col] of [[5, 0], [5, 2], [5, 4]]) game.board[row][col] = { color: 'red', queen: false };
  game.board[7][0] = { color: 'red', queen: true };
  for (const [row, col] of [[0, 1], [0, 3], [0, 5], [0, 7], [1, 0], [1, 2]]) game.board[row][col] = { color: 'black', queen: false };
  expect(positionSummary(game, 'red')).toContain('Red has 3 fewer men and 1 more king than Black.');
  expect(positionSummary(game, 'black')).toContain('Black has 3 more men and 1 fewer king than Red.');
});
