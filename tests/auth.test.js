import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import app from '../server/app.js';

const prisma = new PrismaClient();

async function cleanDb() {
  // Delete in dependency order
  const tables = ['ChatMessage', 'CoinTransaction', 'Inventory', 'Friendship', 'PendingPayout', 'GameSettlementJob', 'GameRun', 'Game', 'User'];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}

beforeAll(async () => {
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it('creates a new user and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.email).toBe('alice@test.com');
    expect(res.body.user.elo).toBe(1000);
    expect(res.body.user.coins).toBe(5);
    expect(res.body.user.friendCode).toHaveLength(8);
    expect(res.body.user.passwordHash).toBeUndefined();

    // Token is valid
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.userId).toBe(res.body.user.id);
    expect(payload.username).toBe('alice');
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('rejects short username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'x', email: 'x@test.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2-16/);
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', email: 'bob@test.com', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/);
  });

  it('rejects duplicate username', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice2@test.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Username taken/);
  });

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Email already/);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await cleanDb();
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid credentials/);
  });

  it('rejects unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    await cleanDb();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });
    token = res.body.token;
  });

  it('returns current user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects request with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
  });
});

describe('guest lifetime', () => {
  const DAY = 24 * 60 * 60;
  beforeEach(cleanDb);

  it('issues a seven-day guest token and account', async () => {
    const before = Math.floor(Date.now() / 1000);
    const res = await request(app).post('/api/guest').send({ username: 'Swift Fox 42' });
    expect(res.status).toBe(201);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.isGuest).toBe(true);
    expect(payload.exp - before).toBeGreaterThanOrEqual(7 * DAY - 5);
    expect(payload.exp - before).toBeLessThanOrEqual(7 * DAY + 5);
    const expiresAt = new Date(res.body.user.guestExpiresAt).getTime();
    expect(expiresAt - Date.now()).toBeGreaterThan(7 * DAY * 1000 - 60000);
  });

  it('re-issues the token from /me only when under three days remain, extending the guest row with it', async () => {
    const created = await request(app).post('/api/guest').send({ username: 'Bold Owl 7' });
    const fresh = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${created.body.token}`);
    expect(fresh.status).toBe(200);
    expect(fresh.body.token).toBeUndefined();

    const user = created.body.user;
    await prisma.user.update({ where: { id: user.id }, data: { guestExpiresAt: new Date(Date.now() + DAY * 1000) } });
    const aging = jwt.sign({ userId: user.id, username: user.username, isGuest: true }, process.env.JWT_SECRET, { expiresIn: 2 * DAY });
    const renewed = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${aging}`);
    expect(renewed.status).toBe(200);
    expect(renewed.body.token).toBeDefined();
    const payload = jwt.verify(renewed.body.token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ userId: user.id, username: user.username, isGuest: true });
    expect(payload.exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(7 * DAY - 60);
    expect(new Date(renewed.body.user.guestExpiresAt).getTime() - Date.now()).toBeGreaterThan(7 * DAY * 1000 - 60000);
  });

  it('renews an aging registered token too', async () => {
    const registered = await request(app).post('/api/auth/register').send({ username: 'renewer', email: 'renewer@test.com', password: 'password123' });
    const aging = jwt.sign({ userId: registered.body.user.id, username: 'renewer', isGuest: false }, process.env.JWT_SECRET, { expiresIn: DAY });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${aging}`);
    expect(res.status).toBe(200);
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).isGuest).toBe(false);
  });
});

describe('POST /api/auth/upgrade', () => {
  beforeEach(cleanDb);

  it('awards one starter grant when simultaneous requests and an old guest token repeat the upgrade', async () => {
    const created = await request(app).post('/api/guest').send({ username: 'Upgrade Race' });
    const payload = { email: 'race@test.com', password: 'password123', username: 'Upgrade Race' };
    const upgrade = () => request(app).post('/api/auth/upgrade').set('Authorization', `Bearer ${created.body.token}`).send(payload);
    const results = await Promise.all([upgrade(), upgrade()]);
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
    const successful = results.find(result => result.status === 200);
    expect((await upgrade()).status).toBe(400);
    expect((await prisma.user.findUnique({ where: { id: created.body.user.id } })).coins).toBe(successful.body.user.coins);
    expect(await prisma.coinTransaction.count({ where: { receiverId: created.body.user.id, reason: 'STARTER_GRANT' } })).toBe(1);
    const current = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${created.body.token}`);
    expect(current.status).toBe(200);
    expect(current.body.user.isGuest).toBe(false);
    expect(jwt.verify(current.body.token, process.env.JWT_SECRET)).toMatchObject({ userId: created.body.user.id, username: payload.username, isGuest: false });
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${current.body.token}`)).body.token).toBeUndefined();
  });

  it('repairs live identity when an upgrade committed before publication or the response arrived', async () => {
    const { upgradeGuest } = await import('../server/services/accounts.js');
    const { getOrCreateSession, getSession, removeSession } = await import('../server/domain/sessions.js');
    const { configureEvents } = await import('../server/domain/events.js');
    const created = await request(app).post('/api/guest').send({ username: 'Pending Save' });
    const id = created.body.user.id;
    getOrCreateSession(id, 'Pending Save', true).connectionId = 'unchanged';
    const published = [];
    configureEvents({ publishUser: id => published.push(id), publishGame() {}, broadcast() {}, notifyChannel() {}, notifyUser() {} });
    try {
      await upgradeGuest(id, { username: 'Recovered Save', email: 'recovered@test.com', passwordHash: 'test-hash' });
      expect(getSession(id).isGuest).toBe(true);
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${created.body.token}`);
      expect(res.status).toBe(200);
      expect(getSession(id)).toMatchObject({ username: 'Recovered Save', isGuest: false, connectionId: 'unchanged' });
      expect(published).toContain(id);
      expect(jwt.verify(res.body.token, process.env.JWT_SECRET)).toMatchObject({ username: 'Recovered Save', isGuest: false });
      expect(await prisma.coinTransaction.count({ where: { receiverId: id, reason: 'STARTER_GRANT' } })).toBe(1);
    } finally { removeSession(id); }
  });

  it('updates the live session identity in place and republishes the snapshot', async () => {
    const { getOrCreateSession, getSession, removeSession } = await import('../server/domain/sessions.js');
    const { configureEvents } = await import('../server/domain/events.js');
    const created = await request(app).post('/api/guest').send({ username: 'Bold Owl 7' });
    const user = created.body.user;
    const session = getOrCreateSession(user.id, user.username, true);
    session.connectionId = 'live';
    const published = [];
    configureEvents({ publishUser: id => published.push(id), publishGame() {}, broadcast() {}, notifyChannel() {}, notifyUser() {} });
    try {
      const res = await request(app).post('/api/auth/upgrade').set('Authorization', `Bearer ${created.body.token}`)
        .send({ email: 'owl@test.com', password: 'password123', username: 'Bold Owl' });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: user.id, username: 'Bold Owl', isGuest: false, guestExpiresAt: null });
      expect(jwt.verify(res.body.token, process.env.JWT_SECRET)).toMatchObject({ userId: user.id, username: 'Bold Owl', isGuest: false });
      expect(getSession(user.id)).toMatchObject({ username: 'Bold Owl', isGuest: false, connectionId: 'live' });
      expect(published).toEqual([user.id]);
      expect((await request(app).post('/api/auth/upgrade').set('Authorization', `Bearer ${res.body.token}`).send({ email: 'x@test.com', password: 'password123' })).status).toBe(400);
    } finally {
      configureEvents({ publishUser() {}, publishGame() {}, broadcast() {}, notifyChannel() {}, notifyUser() {} });
      removeSession(user.id);
    }
  });
});
