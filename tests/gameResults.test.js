import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import app from '../server/app.js';
import { gameResultLabel, playerGameResult, winningColor } from '../shared/gameResult.js';
import { gameTemplate } from '../server/og/templates.js';
import { CheckersGame } from '../shared/game.js';
import { buildShareText } from '../src/lib/share.js';
import { DEFAULT_PIECE_SKIN, normalizePieceSkin } from '../shared/pieceSkins.js';
import { PROFILE_VIEWER, profileHref } from '../src/lib/profileLinks.js';

const prisma = new PrismaClient();
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const users = [], games = [];
let PlayerPage, ReplayPage, ReplayBoard, PlayerLink;

beforeAll(async () => {
  // Render the real pages and child components, resolving the same source imports
  // as the app. The server-side test runner has no Svelte compiler plugin.
  const output = resolve(root, 'node_modules/.cache/game-results-test');
  mkdirSync(output, { recursive: true });
  for (const name of ['PlayerPage', 'ReplayPage', 'ReplayBoard', 'JsonLd', 'ShareActions', 'PlayerLink', 'GameHistory', 'GameEntryLink']) {
    const source = resolve(root, `src/lib/components/${name}.svelte`);
    const { js } = compile(readFileSync(source, 'utf8'), { generate: 'server', filename: source });
    const code = js.code.replace(/from (['"])([^'"]+)\1/g, (match, quote, specifier) => {
      if (['$lib/stores/user.js', '$lib/stores/session.js', '$lib/stores/locale.js'].includes(specifier)) return `from '${pathToFileURL(resolve(root, 'tests/fixtures/siteState.js')).href}'`;
      if (!specifier.startsWith('.') && !specifier.startsWith('$lib/')) return match;
      const target = specifier.endsWith('.svelte') ? resolve(output, basename(specifier, '.svelte') + '.js')
        : specifier.startsWith('$lib/') ? resolve(root, 'src/lib', specifier.slice(5)) : resolve(dirname(source), specifier);
      return `from ${quote}${pathToFileURL(target).href}${quote}`;
    });
    writeFileSync(resolve(output, `${name}.js`), code);
  }
  PlayerPage = (await import(pathToFileURL(resolve(output, 'PlayerPage.js')).href)).default;
  ReplayPage = (await import(pathToFileURL(resolve(output, 'ReplayPage.js')).href)).default;
  ReplayBoard = (await import(pathToFileURL(resolve(output, 'ReplayBoard.js')).href)).default;
  PlayerLink = (await import(pathToFileURL(resolve(output, 'PlayerLink.js')).href)).default;
  for (const color of ['red', 'black']) users.push(await prisma.user.create({ data: { username: `result-${color}`, friendCode: `RESULT-${color[0]}`, profilePublic: true } }));
  for (const result of ['RED_WIN', 'BLACK_WIN', 'DRAW', 'ABORTED']) games.push(await prisma.game.create({ data: {
    redPlayerId: users[0].id, blackPlayerId: users[1].id, result, moveHistory: [],
    winnerId: result === 'RED_WIN' ? users[0].id : result === 'BLACK_WIN' ? users[1].id : null,
    endReason: result === 'ABORTED' ? 'restart-abandoned' : null
  } }));
});

afterAll(async () => {
  await prisma.game.deleteMany({ where: { id: { in: games.map(g => g.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  await prisma.$disconnect();
});

it('uses safe public links and app dialog semantics without making hidden profiles linkable', () => {
  const username = 'Queen / Crown #1';
  const href = '/player/Queen%20%2F%20Crown%20%231';
  expect(profileHref(username)).toBe(href);
  for (const url of [null, 'https://example.com', '//example.com', '/player/%ZZ']) expect(profileHref(username, url)).toBeNull();
  expect(profileHref(username, undefined, false)).toBeNull();
  expect(profileHref('[Expired Guest 7]')).toBeNull();
  const publicLink = render(PlayerLink, { props: { username } }).body;
  expect(publicLink).toContain(`href="${href}"`);
  expect(publicLink).not.toContain('aria-haspopup');
  const appLink = render(PlayerLink, { props: { username }, context: new Map([[PROFILE_VIEWER, () => {}]]) }).body;
  expect(appLink).toContain('aria-haspopup="dialog"');
  expect(render(PlayerLink, { props: { username, profileUrl: null } }).body).not.toContain('<a ');
});

it('embeds the same profile without replacing page metadata or navigating an active session', () => {
  const data = { player: { username: 'Player', id: 1, gamesPlayed: 0, wins: 0, losses: 0, createdAt: new Date().toISOString() },
    games: [{ id: 3, redPlayerId: 1, blackPlayerId: 2, redPlayer: 'Player', blackPlayer: 'Hidden', blackProfileUrl: null, result: 'DRAW' }], activity: {}, indexable: true };
  const result = render(PlayerPage, { props: { data, embedded: true, allowChallenge: false } });
  expect(result.head).not.toContain('<title>');
  expect(result.head).not.toContain('canonical');
  expect(result.body).not.toContain('application/ld+json');
  expect(result.body).not.toContain('/challenge/');
  expect(result.body).not.toContain('/player/Hidden');
  expect(result.body).toContain('target="_blank"');
});

it('opens post-game review on the final position from the player perspective without an entrance move', () => {
  const game = new CheckersGame();
  expect(game.makeMove(5, 0, 4, 1)).toBeTruthy();
  const gameData = { redPlayer: 'Red', blackPlayer: 'Black', result: 'RED_WIN', moveHistory: game.moveHistory };
  const reviewed = render(ReplayBoard, { props: { gameData, initialPosition: 'end', perspective: 'black', review: true } }).body;
  const archive = render(ReplayBoard, { props: { gameData } }).body;
  expect(reviewed).toContain('1 / 1');
  expect(archive).toContain('0 / 1');
  expect(reviewed.match(/data-row="(\d)" data-col="(\d)"/)?.slice(1)).toEqual(['7', '7']);
  expect(archive.match(/data-row="(\d)" data-col="(\d)"/)?.slice(1)).toEqual(['0', '0']);
  expect(reviewed.replace(/<!--[\s\S]*?-->/g, '')).toMatch(/data-row="4" data-col="1"[^>]*>\s*<div class="piece[^"]* red/);
  expect(reviewed).not.toContain('class="sliding-piece');
  expect(reviewed).not.toContain('outcome-result');
});

it('renders a supplied replay palette without coupling public replays to account services', () => {
  const skin = normalizePieceSkin({ ...DEFAULT_PIECE_SKIN, black: { ...DEFAULT_PIECE_SKIN.black, gradStops: ['#33ffdd', '#00ffcc', '#00ccaa'] } });
  const gameData = { redPlayer: 'Red', blackPlayer: 'Black', result: 'DRAW', moveHistory: [] };
  const standard = render(ReplayBoard, { props: { gameData } }).body;
  const customized = render(ReplayBoard, { props: { gameData, skin } }).body;
  expect(standard).not.toContain('#00ffcc'); expect(customized).toContain('#00ffcc 70%');
  expect(customized).toContain('Game replay'); expect(gameData.moveHistory).toEqual([]);
});

it.each([
  ['RED_WIN', 'win', 'loss', 'red'], ['BLACK_WIN', 'loss', 'win', 'black'],
  ['DRAW', 'draw', 'draw', null], ['ABORTED', 'cancelled', 'cancelled', null],
  ['UNRECOGNIZED', 'unknown', 'unknown', null]
])('interprets %s without treating cancellation or unknown results as a loss', (result, red, black, winner) => {
  expect(playerGameResult(result, 'red')).toBe(red);
  expect(playerGameResult(result, 'black')).toBe(black);
  expect(playerGameResult(result, null)).toBe('unknown');
  expect(winningColor(result)).toBe(winner);
});

it('returns the correct private history for both participants', async () => {
  for (const [index, color] of ['red', 'black'].entries()) {
    const token = jwt.sign({ userId: users[index].id }, process.env.JWT_SECRET);
    const response = await request(app).get('/api/auth/history').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    for (const game of games) expect(response.body.games.find(g => g.id === game.id)).toMatchObject({
      myColor: color, result: playerGameResult(game.result, color), eloChange: 0, coinsEarned: 0
    });
  }
});

it('keeps personal history beyond the global window, through renames and hidden profiles', async () => {
  const outsider = await prisma.user.create({ data: { username: 'history-outsider', email: 'history-outsider@test.com', passwordHash: 'test', friendCode: 'HISTORY-OUTSIDER' } });
  users.push(outsider);
  const firstExtraGame = games.length;
  const now = new Date(Date.now() + 60_000);
  for (let i = 0; i < 51; i++) games.push(await prisma.game.create({ data: {
    redPlayerId: users[1].id, blackPlayerId: outsider.id, result: 'DRAW', moveHistory: [], startedAt: new Date(now.getTime() + i)
  } }));
  const token = jwt.sign({ userId: users[0].id }, process.env.JWT_SECRET);
  const oldName = users[0].username;
  await prisma.user.update({ where: { id: users[0].id }, data: { username: 'history-renamed', profilePublic: false } });
  try {
    expect((await request(app).get('/api/auth/history')).status).toBe(401);
    const global = await request(app).get('/api/leaderboard/games');
    expect(global.body.games).toHaveLength(50);
    expect(global.body.games.some(g => g.redPlayerId === users[0].id || g.blackPlayerId === users[0].id)).toBe(false);
    const own = await request(app).get('/api/auth/history').set('Authorization', `Bearer ${token}`);
    expect(own.status).toBe(200); expect(own.headers['cache-control']).toBe('no-store');
    expect(own.body.games.length).toBeGreaterThan(0);
    for (const g of own.body.games) {
      expect(g.redPlayerId === users[0].id || g.blackPlayerId === users[0].id).toBe(true);
      expect(g.redPlayer).toBe('history-renamed'); expect(g.redProfileUrl).toBeNull();
      expect(g.resultCode).toBeDefined(); expect(g.myColor).toBe('red');
    }
  } finally {
    const extraGames = games.splice(firstExtraGame);
    await prisma.game.deleteMany({ where: { id: { in: extraGames.map(g => g.id) } } });
    await prisma.user.update({ where: { id: users[0].id }, data: { username: oldName, profilePublic: true } });
  }
});

it('renders the API profile history with a neutral, accessible cancellation badge', async () => {
  const response = await request(app).get(`/api/leaderboard/player/${users[0].username}`);
  expect(response.status).toBe(200);
  const { body } = render(PlayerPage, { props: { data: { ...response.body, indexable: true } } });
  // Isolate the containing row (other rows can legitimately be wins/losses).
  const cancelledRow = body.split('<div class="game-row').find(part => part.split('</div>')[0].includes('aria-label="Cancelled"'));
  expect(cancelledRow).toBeDefined();
  expect(cancelledRow.split('>')[0]).not.toMatch(/\b(win|loss)\b/);
  expect(body).toContain('aria-label="Win"');
  expect(body).toContain('aria-label="Loss"');
  expect(body).toContain('aria-label="Draw"');
});

it.each(['RED_WIN', 'BLACK_WIN', 'DRAW', 'ABORTED'])('renders %s consistently in replay metadata, board and preview', async result => {
  const row = games.find(g => g.result === result);
  const response = await request(app).get(`/api/leaderboard/game/${row.id}`);
  expect(response.status).toBe(200);
  const game = response.body.game;
  const { head, body } = render(ReplayPage, { props: { data: { game, indexable: false } } });
  const label = gameResultLabel(result, { red: game.redPlayer, black: game.blackPlayer });
  expect(head).toContain(label);
  const outcomeText = body.split('class="outcome-result')[1].split('<span class="outcome-reason')[0].replace(/^[^>]*>/, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  expect(outcomeText).toBe(label);
  const outcomeClass = body.match(/class="outcome ([^"]*)"/)?.[1] ?? '';
  expect(/\bwin\b/.test(outcomeClass)).toBe(!!winningColor(result));
  const svg = gameTemplate({ game, board: new CheckersGame().board });
  const cardHeadline = result === 'RED_WIN' ? `${game.redPlayer} beat ${game.blackPlayer}`
    : result === 'BLACK_WIN' ? `${game.blackPlayer} beat ${game.redPlayer}`
      : result === 'DRAW' ? `${game.redPlayer} and ${game.blackPlayer} drew` : gameResultLabel(result);
  expect(svg).toContain(`>${cardHeadline}</text>`);
  if (result === 'ABORTED') {
    expect(body).toContain('Cancelled after server restart; wagers refunded');
    expect(buildShareText('replay', game)).toContain('was cancelled');
    expect(game.indexable).toBe(false);
  }
});

it('preserves both rating deltas and the end timestamp across replay, public/global lists and both profiles', async () => {
  const played = new CheckersGame();
  for (let i = 0; i < 10; i++) {
    const move = played.getAllValidMoves()[0];
    played.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
  }
  const endedAt = new Date();
  const row = await prisma.game.create({ data: {
    redPlayerId: users[0].id, blackPlayerId: users[1].id, winnerId: users[0].id,
    result: 'RED_WIN', mode: 'RANKED', moveHistory: played.moveHistory,
    redEloChange: 14, blackEloChange: -14,
    startedAt: new Date(endedAt.getTime() - 60_000), endedAt
  } });
  games.push(row);
  const expected = { id: row.id, result: 'RED_WIN', mode: 'RANKED', redEloChange: 14, blackEloChange: -14, endedAt: endedAt.toISOString() };
  const replay = await request(app).get(`/api/leaderboard/game/${row.id}`);
  expect(replay.status).toBe(200);
  expect(replay.body.game).toMatchObject({ ...expected, indexable: true, moveHistory: played.moveHistory });
  for (const path of ['/api/leaderboard/games', '/api/leaderboard/games?public=1']) {
    const response = await request(app).get(path);
    expect(response.status).toBe(200);
    expect(response.body.games.find(game => game.id === row.id)).toMatchObject({ ...expected, moveCount: played.moveHistory.length, endReason: null });
  }
  for (const [index, color, delta] of [[0, 'red', 14], [1, 'black', -14]]) {
    const response = await request(app).get(`/api/leaderboard/player/${encodeURIComponent(users[index].username)}`);
    expect(response.status).toBe(200);
    expect(response.body.games.find(game => game.id === row.id)).toMatchObject({ ...expected, myColor: color, eloChange: delta, moveCount: played.moveHistory.length, endReason: null, redPlayerId: users[0].id, blackPlayerId: users[1].id });
  }
});
