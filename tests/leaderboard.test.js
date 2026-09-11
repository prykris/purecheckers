import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../server/app.js';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

let ids = {};
let gameIds = {};

beforeAll(async () => {
  await prisma.game.deleteMany();
  await prisma.$executeRawUnsafe('DELETE FROM "User"').catch(() => {});

  // Create test users with different ELOs
  const users = [
    { username: 'pro', email: 'pro@test.com', passwordHash: 'x', friendCode: 'PRO00001', elo: 1800, gamesPlayed: 50, wins: 40, losses: 10 },
    { username: 'mid', email: 'mid@test.com', passwordHash: 'x', friendCode: 'MID00001', elo: 1200, gamesPlayed: 20, wins: 12, losses: 8 },
    { username: 'new', email: 'new@test.com', passwordHash: 'x', friendCode: 'NEW00001', elo: 1000, gamesPlayed: 2, wins: 1, losses: 1 },
    { username: 'inactive', email: 'inactive@test.com', passwordHash: 'x', friendCode: 'INA00001', elo: 1000, gamesPlayed: 0, wins: 0, losses: 0 }
  ];

  for (const u of users) {
    ids[u.username] = (await prisma.user.create({ data: u })).id;
  }
  ids.bot = (await prisma.user.create({ data: { username: 'Bot Easy', botKey: 'easy', isBot: true, friendCode: 'BOT00001', elo: 600 } })).id;
  ids.tombstone = (await prisma.user.create({ data: { username: '[Expired Guest 77]', isGuest: true, friendCode: 'GST00001', gamesPlayed: 1 } })).id;
  const endedAt = new Date('2026-09-10T12:00:00Z');
  gameIds.ranked = (await prisma.game.create({ data: { redPlayerId: ids.pro, blackPlayerId: ids.mid, winnerId: ids.pro, result: 'RED_WIN',
    redEloChange: 14, blackEloChange: -14, moveHistory: [], mode: 'RANKED', endedAt } })).id;
  gameIds.bot = (await prisma.game.create({ data: { redPlayerId: ids.bot, blackPlayerId: ids.tombstone, winnerId: ids.tombstone, result: 'BLACK_WIN',
    moveHistory: [], mode: 'FRIENDLY', endedAt } })).id;
});

afterAll(async () => {
  await prisma.game.deleteMany();
  await prisma.$executeRawUnsafe('DELETE FROM "User"').catch(() => {});
  await prisma.$disconnect();
});

describe('GET /api/leaderboard', () => {
  it('returns players sorted by ELO descending', async () => {
    const res = await request(app).get('/api/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.players.length).toBe(3); // inactive excluded (0 games)
    expect(res.body.players[0].username).toBe('pro');
    expect(res.body.players[0].elo).toBe(1800);
    expect(res.body.players[1].username).toBe('mid');
    expect(res.body.players[2].username).toBe('new');
  });

  it('does not expose sensitive fields', async () => {
    const res = await request(app).get('/api/leaderboard');
    const player = res.body.players[0];
    expect(player.passwordHash).toBeUndefined();
    expect(player.email).toBeUndefined();
    expect(player.id).toBeDefined();
    expect(player.username).toBeDefined();
    expect(player.elo).toBeDefined();
    expect(player.wins).toBeDefined();
    expect(player.losses).toBeDefined();
  });

  it('excludes players with zero games', async () => {
    const res = await request(app).get('/api/leaderboard');
    const usernames = res.body.players.map(p => p.username);
    expect(usernames).not.toContain('inactive');
  });
});

describe('public game APIs', () => {
  it('enforces profile privacy through the authenticated setting while retaining rankings and game names', async () => {
    const authorization = 'Bearer ' + jwt.sign({ userId: ids.pro }, process.env.JWT_SECRET);
    try {
      expect((await request(app).patch('/api/auth/profile').send({ profilePublic: false })).status).toBe(401);
      expect((await request(app).patch('/api/auth/profile').set('Authorization', authorization).send({ profilePublic: 'false' })).status).toBe(400);
      const current = await prisma.user.findUnique({ where: { id: ids.pro } });
      expect((await request(app).patch('/api/auth/profile').set('Authorization', authorization).send({ profilePublic: false, expectedProfileVersion: current.profileVersion })).status).toBe(200);
      expect((await request(app).get('/api/leaderboard/player/pro')).status).toBe(404);
      expect((await request(app).get('/og/player/pro.png')).status).toBe(302);
      const ranking = (await request(app).get('/api/leaderboard')).body.players.find(p => p.id === ids.pro);
      expect(ranking.username).toBe('pro'); expect(ranking.profileUrl).toBeNull();
      expect((await request(app).get('/api/leaderboard/game/' + gameIds.ranked)).body.game).toMatchObject({ redPlayer: 'pro', redProfileUrl: null });
    } finally { await prisma.user.update({ where: { id: ids.pro }, data: { profilePublic: true } }); }
  });
  it('uses the same database eligibility for public discovery, replay metadata and sitemap', async () => {
    const history = Array.from({ length: 10 }, () => ({ fromRow: 5, fromCol: 2, toRow: 4, toCol: 3 }));
    const human = await prisma.user.create({ data: { username: 'Bot Pretender', friendCode: 'HUMANPRET', gamesPlayed: 1 } });
    const guest = await prisma.user.create({ data: { username: 'Custom guest name', friendCode: 'CUSTOMGST', isGuest: true, gamesPlayed: 1 } });
    const base = { redPlayerId: human.id, blackPlayerId: guest.id, result: 'DRAW', mode: 'FRIENDLY', moveHistory: history };
    const visible = await prisma.game.create({ data: base });
    const bot = await prisma.game.create({ data: { ...base, blackPlayerId: ids.bot } });
    const aborted = await prisma.game.create({ data: { ...base, result: 'ABORTED' } });
    const short = await prisma.game.create({ data: { ...base, moveHistory: history.slice(0, 9) } });
    const guests = await prisma.game.create({ data: { ...base, redPlayerId: ids.tombstone } });
    const hidden = [bot.id, aborted.id, short.id, guests.id];
    try {
      const list = await request(app).get('/api/leaderboard/games?public=1');
      expect(list.body.games.map(g => g.id)).toEqual([visible.id]);
      expect((await request(app).get('/api/leaderboard/game/' + visible.id)).body.game.indexable).toBe(true);
      for (const id of hidden) expect((await request(app).get('/api/leaderboard/game/' + id)).body.game.indexable).toBe(false);
      const sitemap = await request(app).get('/sitemap.xml');
      expect(sitemap.status).toBe(200);
      expect(sitemap.text).toContain('/game/' + visible.id + '</loc>');
      for (const id of hidden) expect(sitemap.text).not.toContain('/game/' + id + '</loc>');
      expect(sitemap.text).toContain('/player/Bot%20Pretender</loc>');
      expect(sitemap.text).not.toContain('/player/Custom%20guest%20name</loc>');
    } finally {
      await prisma.game.deleteMany({ where: { id: { in: [visible.id, ...hidden] } } });
      await prisma.user.deleteMany({ where: { id: { in: [human.id, guest.id] } } });
    }
  });

  it('serves ELO deltas, the end time and the bot flag on a single game', async () => {
    const res = await request(app).get('/api/leaderboard/game/' + gameIds.ranked);
    expect(res.status).toBe(200);
    expect(res.body.game).toMatchObject({ id: gameIds.ranked, redPlayer: 'pro', blackPlayer: 'mid', result: 'RED_WIN', mode: 'RANKED',
      redEloChange: 14, blackEloChange: -14, isBotGame: false, endedAt: '2026-09-10T12:00:00.000Z' });
    expect(res.body.game.moveHistory).toEqual([]);
    expect((await request(app).get('/api/leaderboard/game/abc')).status).toBe(400);
    expect((await request(app).get('/api/leaderboard/game/999999')).status).toBe(404);
  });

  it('tags bot games in the log and renders tombstoned guests as Guest', async () => {
    const res = await request(app).get('/api/leaderboard/games');
    expect(res.status).toBe(200);
    const bot = res.body.games.find(g => g.id === gameIds.bot);
    expect(bot).toMatchObject({ redPlayer: 'Bot Easy', blackPlayer: 'Guest', isBotGame: true, redEloChange: 0, blackEloChange: 0, endedAt: '2026-09-10T12:00:00.000Z' });
    expect(res.body.games.find(g => g.id === gameIds.ranked)).toMatchObject({ isBotGame: false, redEloChange: 14, blackEloChange: -14 });
    const single = await request(app).get('/api/leaderboard/game/' + gameIds.bot);
    expect(single.body.game).toMatchObject({ blackPlayer: 'Guest', isBotGame: true });
  });

  it('extends the player profile history and hides tombstoned profiles', async () => {
    const res = await request(app).get('/api/leaderboard/player/mid');
    expect(res.status).toBe(200);
    expect(res.body.games[0]).toMatchObject({ id: gameIds.ranked, opponent: 'pro', myColor: 'black', redEloChange: 14, blackEloChange: -14,
      eloChange: -14, isBotGame: false, endedAt: '2026-09-10T12:00:00.000Z' });
    const bot = await request(app).get('/api/leaderboard/player/Bot%20Easy');
    expect(bot.body.games[0]).toMatchObject({ opponent: 'Guest', isBotGame: true });
    expect((await request(app).get('/api/leaderboard/player/' + encodeURIComponent('[Expired Guest 77]'))).status).toBe(404);
  });
});
