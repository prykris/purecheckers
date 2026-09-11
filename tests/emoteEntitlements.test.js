import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { listAvailableEmotes, resolveEmote } from '../server/services/emotes.js';

let users, items;
beforeEach(async () => {
  users = await Promise.all([0, 1].map(() => prisma.user.create({ data: { username: randomUUID(), friendCode: randomUUID() } })));
  items = await Promise.all([
    { price: 0, data: { emoji: '🤝', label: 'GG' } },
    { price: 10, data: { emoji: '🔥', label: 'Fire' } },
    { price: 10, data: { emoji: '👑', label: 'Crown' } },
    { price: 0, type: 'THEME', data: { emoji: 'x', label: 'not an emote' } },
    { price: 0, data: { emoji: 'x'.repeat(65), label: 'invalid' } }
  ].map(data => prisma.shopItem.create({ data: { slug: randomUUID(), name: 'Test emote', type: 'EMOTE', ...data } })));
  await prisma.inventory.createMany({ data: [{ userId: users[0].id, itemId: items[1].id }, { userId: users[1].id, itemId: items[2].id }] });
});
afterEach(async () => {
  await prisma.inventory.deleteMany({ where: { userId: { in: users.map(u => u.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  await prisma.shopItem.deleteMany({ where: { id: { in: items.map(i => i.id) } } });
});

it('shares free-or-owned eligibility between listing and sending and returns only canonical presentation fields', async () => {
  const ids = new Set(items.map(i => i.id));
  const available = (await listAvailableEmotes(users[0].id)).filter(i => ids.has(i.id));
  expect(available.map(i => i.id)).toEqual([items[0].id, items[1].id].sort((a, b) => a - b));
  expect(available.find(i => i.id === items[1].id)).toEqual({ id: items[1].id, name: 'Test emote', emoji: '🔥', label: 'Fire' });
  for (const item of items) {
    const resolved = await resolveEmote(users[0].id, item.id);
    expect(resolved).toEqual(available.find(i => i.id === item.id) ?? null);
  }
  for (const id of ['1', -1, 0, 1.5, 2_147_483_648]) expect(await resolveEmote(users[0].id, id)).toBeNull();
});

it('rechecks ownership after revocation and free access after a price change', async () => {
  expect(await resolveEmote(users[0].id, items[1].id)).not.toBeNull();
  await prisma.inventory.deleteMany({ where: { userId: users[0].id } });
  expect(await resolveEmote(users[0].id, items[1].id)).toBeNull();
  await prisma.shopItem.update({ where: { id: items[0].id }, data: { price: 15 } });
  expect(await resolveEmote(users[0].id, items[0].id)).toBeNull();
});

it('requires authentication and does not cache or disclose another account’s paid emotes', async () => {
  await request(app).get('/api/shop/emotes').expect(401);
  for (let i = 0; i < users.length; i++) {
    const token = jwt.sign({ userId: users[i].id }, process.env.JWT_SECRET);
    const response = await request(app).get('/api/shop/emotes').set('Authorization', 'Bearer ' + token).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const ids = response.body.emotes.map(item => item.id);
    expect(ids).toContain(items[i + 1].id); expect(ids).not.toContain(items[2 - i].id);
  }
});
