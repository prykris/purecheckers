import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../server/app.js';

const prisma = new PrismaClient();
let tokenA, tokenB, userA, userB;

beforeAll(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM "Friendship"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "CoinTransaction"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "Inventory"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "Game"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "User"').catch(() => {});

  const resA = await request(app).post('/api/auth/register')
    .send({ username: 'alice', email: 'alice@f.com', password: 'pass123' });
  tokenA = resA.body.token; userA = resA.body.user;

  const resB = await request(app).post('/api/auth/register')
    .send({ username: 'bob', email: 'bob@f.com', password: 'pass123' });
  tokenB = resB.body.token; userB = resB.body.user;
});

afterAll(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM "Friendship"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "CoinTransaction"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "User"').catch(() => {});
  await prisma.$disconnect();
});

describe('Friends API', () => {
  let friendshipId;

  it('sends a friend request by code', async () => {
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendCode: userB.friendCode });

    expect(res.status).toBe(201);
    expect(res.body.friendship.status).toBe('PENDING');
    friendshipId = res.body.friendship.id;
  });

  it('rejects duplicate request', async () => {
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendCode: userB.friendCode });

    expect(res.status).toBe(409);
  });

  it('rejects self-friending', async () => {
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendCode: userA.friendCode });

    expect(res.status).toBe(400);
  });

  it('lists pending requests for receiver', async () => {
    const res = await request(app)
      .get('/api/friends/pending')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.requests.length).toBe(1);
    expect(res.body.requests[0].requester.username).toBe('alice');
  });

  it('rejects accept from non-receiver', async () => {
    const res = await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendshipId });

    expect(res.status).toBe(403);
  });

  it('accepts a friend request', async () => {
    const res = await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ friendshipId });

    expect(res.status).toBe(200);
    expect(res.body.friendship.status).toBe('ACCEPTED');
  });

  it('lists accepted friends', async () => {
    const res = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.friends.length).toBe(1);
    expect(res.body.friends[0].username).toBe('bob');
    expect(res.body.friends[0].status).toBeDefined(); // presence status
  });

  it('deletes a friendship', async () => {
    const res = await request(app)
      .delete(`/api/friends/${friendshipId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(204);

    const list = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(list.body.friends.length).toBe(0);
  });
});

describe('Tipping', () => {
  let friendshipId;

  beforeAll(async () => {
    // Recreate friendship
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendCode: userB.friendCode });
    friendshipId = res.body.friendship.id;

    await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ friendshipId });

    // Give alice coins
    await prisma.user.update({ where: { id: userA.id }, data: { coins: 100 } });
  });

  it('tips a friend', async () => {
    const res = await request(app)
      .post('/api/coins/tip')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ receiverId: userB.id, amount: 25 });

    expect(res.status).toBe(200);
    expect(res.body.coins).toBe(75);

    const bob = await prisma.user.findUnique({ where: { id: userB.id } });
    expect(bob.coins).toBe(75); // 50 starter + 25 tipped
  });

  it('rejects tip with insufficient coins', async () => {
    const res = await request(app)
      .post('/api/coins/tip')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ receiverId: userB.id, amount: 9999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient/);
  });

  it('rejects self-tip', async () => {
    const res = await request(app)
      .post('/api/coins/tip')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ receiverId: userA.id, amount: 5 });

    expect(res.status).toBe(400);
  });

  it('rejects tip to non-friend', async () => {
    // Create a third user who is not alice's friend
    const resC = await request(app).post('/api/auth/register')
      .send({ username: 'charlie', email: 'charlie@f.com', password: 'pass123' });

    const res = await request(app)
      .post('/api/coins/tip')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ receiverId: resC.body.user.id, amount: 5 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/friends/i);
  });
});
