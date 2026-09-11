import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { ensurePredefinedBots } from '../server/services/botAccounts.js';

it('counts personal results for either color, excludes aborted/unfinished/unrelated games, and scopes the endpoint to its caller', async () => {
  const bots = await ensurePredefinedBots(prisma);
  const users = await Promise.all([false, true].map(isGuest => prisma.user.create({ data: { username: randomUUID(), friendCode: randomUUID(), isGuest } })));
  const [player, other] = users;
  const easy = bots.find(bot => bot.botKey === 'easy'), hard = bots.find(bot => bot.botKey === 'hard');
  const game = (red, black, result, endedAt = new Date(), mode = 'BOT') => ({ redPlayerId: red.id, blackPlayerId: black.id, result, endedAt, mode, moveHistory: [] });
  try {
    await prisma.game.createMany({ data: [
      game(player, easy, 'RED_WIN'), game(easy, player, 'BLACK_WIN'),
      game(player, easy, 'DRAW'), game(easy, player, 'RED_WIN'),
      game(player, easy, 'ABORTED'), game(player, easy, 'RED_WIN', null),
      game(other, easy, 'RED_WIN'), game(player, other, 'RED_WIN', new Date(), 'FRIENDLY'),
      game(hard, player, 'BLACK_WIN', new Date(), 'FRIENDLY'),
    ] });
    await request(app).get('/api/bots/me/stats').expect(401);
    const read = user => request(app).get('/api/bots/me/stats?userId=' + other.id).set('Authorization', 'Bearer ' + jwt.sign({ userId: user.id }, process.env.JWT_SECRET));
    const res = await read(player).expect(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body.stats).toEqual([
      { difficulty: 'easy', wins: 2, draws: 1, losses: 1 },
      { difficulty: 'medium', wins: 0, draws: 0, losses: 0 },
      { difficulty: 'hard', wins: 1, draws: 0, losses: 0 },
    ]);
    expect((await read(other).expect(200)).body.stats[0]).toEqual({ difficulty: 'easy', wins: 1, draws: 0, losses: 0 });
  } finally {
    const ids = users.map(user => user.id);
    await prisma.game.deleteMany({ where: { OR: [{ redPlayerId: { in: ids } }, { blackPlayerId: { in: ids } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});
