import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../server/app.js';

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM "User"').catch(() => {});

  // Create test users with different ELOs
  const users = [
    { username: 'pro', email: 'pro@test.com', passwordHash: 'x', friendCode: 'PRO00001', elo: 1800, gamesPlayed: 50, wins: 40, losses: 10 },
    { username: 'mid', email: 'mid@test.com', passwordHash: 'x', friendCode: 'MID00001', elo: 1200, gamesPlayed: 20, wins: 12, losses: 8 },
    { username: 'new', email: 'new@test.com', passwordHash: 'x', friendCode: 'NEW00001', elo: 1000, gamesPlayed: 2, wins: 1, losses: 1 },
    { username: 'inactive', email: 'inactive@test.com', passwordHash: 'x', friendCode: 'INA00001', elo: 1000, gamesPlayed: 0, wins: 0, losses: 0 }
  ];

  for (const u of users) {
    await prisma.user.create({ data: u });
  }
});

afterAll(async () => {
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
