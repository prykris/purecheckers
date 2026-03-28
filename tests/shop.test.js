import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../server/app.js';

const prisma = new PrismaClient();
let token;
let userId;
let themeItem;
let skinItem;

beforeAll(async () => {
  // Clean
  await prisma.$executeRawUnsafe('DELETE FROM "Inventory"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "CoinTransaction"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "ShopItem"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "Game"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "User"').catch(() => {});

  // Create a user with coins
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'shopper', email: 'shop@test.com', password: 'password123' });
  token = res.body.token;
  userId = res.body.user.id;

  // Give the user coins
  await prisma.user.update({ where: { id: userId }, data: { coins: 200 } });

  // Seed shop items
  themeItem = await prisma.shopItem.create({
    data: { slug: 'test-theme', name: 'Test Theme', type: 'THEME', price: 50, data: { '--bg': '#000' } }
  });
  skinItem = await prisma.shopItem.create({
    data: { slug: 'test-skin', name: 'Test Skin', type: 'SKIN', price: 80, data: { red: {}, black: {} } }
  });
});

afterAll(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM "Inventory"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "CoinTransaction"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "ShopItem"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "Game"').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "User"').catch(() => {});
  await prisma.$disconnect();
});

describe('GET /api/shop/items', () => {
  it('returns all shop items', async () => {
    const res = await request(app).get('/api/shop/items');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items[0].price).toBeLessThanOrEqual(res.body.items[1].price);
  });
});

describe('POST /api/shop/purchase', () => {
  it('purchases an item and deducts coins', async () => {
    const res = await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: themeItem.id });

    expect(res.status).toBe(200);
    expect(res.body.coins).toBe(150); // 200 - 50
  });

  it('rejects duplicate purchase', async () => {
    const res = await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: themeItem.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Already owned/);
  });

  it('rejects purchase with insufficient coins', async () => {
    // Set coins to 10
    await prisma.user.update({ where: { id: userId }, data: { coins: 10 } });

    const res = await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: skinItem.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient/);

    // Restore coins
    await prisma.user.update({ where: { id: userId }, data: { coins: 150 } });
  });

  it('rejects without auth', async () => {
    const res = await request(app)
      .post('/api/shop/purchase')
      .send({ itemId: skinItem.id });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/shop/inventory', () => {
  it('returns owned items', async () => {
    const res = await request(app)
      .get('/api/shop/inventory')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.inventory.length).toBe(1);
    expect(res.body.inventory[0].item.slug).toBe('test-theme');
  });
});

describe('PATCH /api/shop/equip', () => {
  it('equips an owned item', async () => {
    const res = await request(app)
      .patch('/api/shop/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: themeItem.id });

    expect(res.status).toBe(200);
    expect(res.body.equipped).toBe(true);

    // Verify in DB
    const inv = await prisma.inventory.findUnique({
      where: { userId_itemId: { userId, itemId: themeItem.id } }
    });
    expect(inv.equipped).toBe(true);
  });

  it('rejects equipping unowned item', async () => {
    const res = await request(app)
      .patch('/api/shop/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: skinItem.id }); // not purchased

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not owned/);
  });

  it('unequips previous item of same type when equipping new one', async () => {
    // Buy a second theme
    await prisma.user.update({ where: { id: userId }, data: { coins: 200 } });
    const theme2 = await prisma.shopItem.create({
      data: { slug: 'test-theme-2', name: 'Theme 2', type: 'THEME', price: 30, data: { '--bg': '#111' } }
    });
    await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: theme2.id });

    // Equip theme2
    await request(app)
      .patch('/api/shop/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: theme2.id });

    // Original theme should be unequipped
    const inv1 = await prisma.inventory.findUnique({
      where: { userId_itemId: { userId, itemId: themeItem.id } }
    });
    expect(inv1.equipped).toBe(false);

    const inv2 = await prisma.inventory.findUnique({
      where: { userId_itemId: { userId, itemId: theme2.id } }
    });
    expect(inv2.equipped).toBe(true);
  });
});
