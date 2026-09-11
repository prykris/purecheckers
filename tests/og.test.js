import express from 'express';
import request from 'supertest';
import { CheckersGame } from '../shared/game.js';
import { ImageCache } from '../server/og/cache.js';
import { createCardService } from '../server/og/service.js';
import { createOgRouter } from '../server/routes/og.js';
import { finalPosition } from '../server/og/board.js';
import { gameTemplate } from '../server/og/templates.js';

const services = [];
afterEach(async () => { await Promise.all(services.splice(0).map(s => s.close())); });
function setup(options = {}) {
  const player = { id: 1, username: 'Chris & Dana', profilePublic: true, isGuest: false, isBot: false, gamesPlayed: 4, wins: 3, losses: 1, elo: 1040, peakElo: 1060, createdAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-10') };
  const game = new CheckersGame(0); game.makeMove(5, 2, 4, 3);
  const row = { id: 1, result: 'RED_WIN', mode: 'RANKED', redPlayer: player, blackPlayer: { ...player, id: 2, username: '<Opponent>' }, moveHistory: game.moveHistory,
    redEloChange: 14, blackEloChange: -14, endedAt: new Date('2026-09-10') };
  const db = { user: { findUnique: vi.fn().mockResolvedValue(player) }, game: { findUnique: vi.fn().mockResolvedValue(row), findMany: vi.fn().mockResolvedValue([{ startedAt: new Date('2026-09-10') }]) },
    puzzle: { findUnique: vi.fn().mockResolvedValue({ date: new Date('2026-09-10'), position: { board: game.board, currentPlayer: 'red' }, sideToMove: 'red' }) } };
  const room = { hostName: 'Chris', status: 'waiting', settings: { buyIn: 20, turnTimer: 30 } };
  const findRoom = vi.fn().mockReturnValue(room);
  const service = createCardService({ db, findRoom, now: () => Date.parse('2026-09-10T12:00:00Z'), log: () => {}, ...options });
  services.push(service);
  const app = express().use('/og', createOgRouter({ service }));
  return { service, db, app, player, row, game, room };
}

it('renders real 1200 × 630 PNGs in a worker and serves a conditional cache hit', async () => {
  const { app } = setup();
  const res = await request(app).get('/og/game/1.png');
  expect(res.status).toBe(200); expect(res.headers['content-type']).toBe('image/png');
  expect(res.body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(res.body.readUInt32BE(16)).toBe(1200); expect(res.body.readUInt32BE(20)).toBe(630);
  expect((await request(app).get('/og/game/1.png').set('If-None-Match', res.headers.etag)).status).toBe(304);
  for (const path of ['/og/player/Chris.png', '/og/puzzle/2026-09-10.png', '/og/invite/ABC234.png']) expect((await request(app).get(path)).status).toBe(200);
});

it('checks private profiles and expired invitations before returning cached images or 304', async () => {
  const { app, player, room } = setup({ render: async () => Buffer.from('png') });
  const profile = await request(app).get('/og/player/Chris.png');
  expect(profile.headers['cache-control']).toContain('must-revalidate');
  player.profilePublic = false;
  const hidden = await request(app).get('/og/player/Chris.png').set('If-None-Match', profile.headers.etag);
  expect(hidden.status).toBe(302); expect(hidden.headers.location).toBe('/og-image.png');
  const invite = await request(app).get('/og/invite/ABC234.png');
  room.status = 'playing';
  expect((await request(app).get('/og/invite/ABC234.png').set('If-None-Match', invite.headers.etag)).status).toBe(302);
});

it('hides future puzzles without reading their rows and falls back on invalid or missing data', async () => {
  const { app, db } = setup();
  expect((await request(app).get('/og/puzzle/2026-09-11.png')).status).toBe(302);
  expect(db.puzzle.findUnique).not.toHaveBeenCalled();
  expect((await request(app).get('/og/game/abc.png')).status).toBe(302);
  expect(db.game.findUnique).not.toHaveBeenCalled();
  db.game.findUnique.mockResolvedValue(null);
  expect((await request(app).get('/og/game/9.png')).headers['cache-control']).toBe('no-store');
  await request(app).get('/og/puzzle/2026-09-10.png');
  expect(db.puzzle.findUnique.mock.calls[0][0].select).toEqual({ date: true, position: true, sideToMove: true });
});

it('coalesces concurrent renders and does not retain failed rendering promises', async () => {
  const render = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(Buffer.from('png'));
  const { service } = setup({ render });
  await expect(service.get('game', '1')).rejects.toThrow('unavailable');
  const cards = await Promise.all(Array.from({ length: 5 }, () => service.get('game', '1')));
  expect(render).toHaveBeenCalledTimes(2); expect(new Set(cards.map(c => c.etag)).size).toBe(1);
});

it('replays the actual engine position, escapes names, and includes the ELO changes', () => {
  const { row, game } = setup();
  expect(finalPosition(row.moveHistory)).toEqual(game.board);
  expect(() => finalPosition([{ fromRow: 0, fromCol: 0, toRow: 2, toCol: 2 }])).toThrow();
  const svg = gameTemplate({ board: game.board, game: { ...row, date: row.endedAt, redPlayer: row.redPlayer.username, blackPlayer: row.blackPlayer.username } });
  expect(svg).toContain('Chris &amp; Dana'); expect(svg).toContain('&lt;Opponent&gt;'); expect(svg).toContain('+14 ELO'); expect(svg).toContain('-14 ELO');
  expect(svg).not.toContain('<Opponent>');
});

it('bounds both image count and bytes while evicting the least recently used entry', () => {
  let now = 0; const cache = new ImageCache({ maxEntries: 2, maxBytes: 5, now: () => now });
  const row = key => ({ png: Buffer.from('12'), expires: 100, requestKey: key });
  cache.set('a', row('a')); cache.set('b', row('b')); cache.get('a'); cache.set('c', row('c'));
  expect(cache.get('b')).toBeNull(); expect(cache.bytes).toBe(4);
  now = 100; expect(cache.get('a')).toBeNull(); expect(cache.hasRequest('c')).toBe(false); expect(cache.bytes).toBe(0);
});
