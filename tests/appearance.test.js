import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { readAppearance } from '../server/services/appearance.js';
import { equipItem } from '../server/services/walletActions.js';
import { DEFAULT_PIECE_SKIN, normalizePieceSkin } from '../shared/pieceSkins.js';
import { normalizeTheme } from '../shared/themes.js';

let users, items;
beforeEach(async () => {
  users = await Promise.all([0, 1].map(() => prisma.user.create({ data: { username: randomUUID(), friendCode: randomUUID() } })));
  items = await Promise.all([0, 1, 2].map(i => prisma.shopItem.create({ data: { slug: randomUUID(), name: 'Skin ' + i, type: i === 2 ? 'THEME' : 'SKIN', price: 20,
    data: i === 2 ? { '--bg': '#0a1628' } : { ...DEFAULT_PIECE_SKIN, red: { ...DEFAULT_PIECE_SKIN.red, base: i === 0 ? '#ff0055' : '#a0522d' } } } })));
  await prisma.inventory.createMany({ data: [{ userId: users[0].id, itemId: items[0].id, equipped: true }, { userId: users[0].id, itemId: items[1].id },
    { userId: users[0].id, itemId: items[2].id, equipped: true }, { userId: users[1].id, itemId: items[1].id, equipped: true }] });
});
afterEach(async () => {
  await prisma.inventory.deleteMany({ where: { userId: { in: users.map(u => u.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  await prisma.shopItem.deleteMany({ where: { id: { in: items.map(i => i.id) } } });
});

it('returns only the authenticated account’s selected skin and never exposes other inventory', async () => {
  await request(app).get('/api/shop/appearance').expect(401);
  for (const [index, user] of users.entries()) {
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    const res = await request(app).get('/api/shop/appearance').set('Authorization', 'Bearer ' + token).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ skin: { itemId: items[index].id, name: items[index].name, palette: normalizePieceSkin(items[index].data) },
      theme: index === 0 ? { itemId: items[2].id, name: items[2].name, vars: normalizeTheme(items[2].data) } : null });
  }
});

it('reads current equipment after confirmation even when an older equipment receipt is replayed', async () => {
  const first = { itemId: items[0].id, requestId: randomUUID() };
  await equipItem(users[0].id, first);
  await equipItem(users[0].id, { itemId: items[1].id, requestId: randomUUID() });
  await equipItem(users[0].id, first);
  expect((await readAppearance(users[0].id)).skin.itemId).toBe(items[1].id);
  await prisma.inventory.deleteMany({ where: { userId: users[0].id, itemId: items[1].id } });
  expect(await readAppearance(users[0].id)).toMatchObject({ skin: null });
});

it('does not guess between multiple legacy selections or silently accept malformed catalogue data', async () => {
  await prisma.inventory.updateMany({ where: { userId: users[0].id, itemId: items[1].id }, data: { equipped: true } });
  await expect(readAppearance(users[0].id)).rejects.toThrow('Multiple');
  await equipItem(users[0].id, { itemId: items[0].id, requestId: randomUUID() });
  await prisma.shopItem.update({ where: { id: items[0].id }, data: { data: { red: {}, black: {} } } });
  await expect(readAppearance(users[0].id)).rejects.toThrow('unavailable');
});

it('resets only the skin slot, persists the reset receipt and cannot undo a later selection by retrying it', async () => {
  const body = { itemId: null, itemType: 'SKIN', requestId: randomUUID() };
  const coins = users[0].coins;
  const token = jwt.sign({ userId: users[0].id }, process.env.JWT_SECRET);
  const res = await request(app).patch('/api/shop/equip').set('Authorization', 'Bearer ' + token).send(body).expect(200);
  expect(res.body).toEqual({ equipped: false, itemId: null, itemType: 'SKIN' });
  expect(await readAppearance(users[0].id)).toMatchObject({ skin: null });
  expect(await prisma.inventory.findUnique({ where: { userId_itemId: { userId: users[0].id, itemId: items[2].id } } })).toMatchObject({ equipped: true });
  expect((await prisma.user.findUnique({ where: { id: users[0].id } })).coins).toBe(coins);
  await equipItem(users[0].id, { itemId: items[1].id, requestId: randomUUID() });
  expect(await equipItem(users[0].id, body)).toEqual(res.body);
  expect((await readAppearance(users[0].id)).skin.itemId).toBe(items[1].id);
  await expect(equipItem(users[0].id, { ...body, itemId: items[0].id })).rejects.toMatchObject({ status: 409 });
  for (const invalid of [{ itemId: null }, { itemId: null, itemType: 'EMOTE' }, { itemId: 0, itemType: 'SKIN' }]) {
    await request(app).patch('/api/shop/equip').set('Authorization', 'Bearer ' + token).send({ ...invalid, requestId: randomUUID() }).expect(400);
  }
});

it('rolls a standard-piece reset back with its receipt', async () => {
  const body = { itemId: null, itemType: 'SKIN', requestId: randomUUID() };
  await expect(prisma.$transaction(async tx => { await equipItem(users[0].id, body, tx); throw Error('rollback'); })).rejects.toThrow('rollback');
  expect((await readAppearance(users[0].id)).skin.itemId).toBe(items[0].id);
  expect(await prisma.walletOperation.findUnique({ where: { userId_key: { userId: users[0].id, key: body.requestId } } })).toBeNull();
});

it('resets the theme independently and an old reset receipt cannot undo a newer paid selection', async () => {
  const userId = users[0].id, itemId = items[2].id;
  const reset = { itemId: null, itemType: 'THEME', requestId: randomUUID() };
  expect(await equipItem(userId, reset)).toEqual({ equipped: false, itemId: null, itemType: 'THEME' });
  expect(await readAppearance(userId)).toMatchObject({ theme: null, skin: { itemId: items[0].id } });
  await equipItem(userId, { itemId, requestId: randomUUID() });
  await equipItem(userId, reset);
  expect((await readAppearance(userId)).theme.itemId).toBe(itemId);
  await expect(equipItem(users[1].id, { itemId, requestId: randomUUID() })).rejects.toThrow();
  await expect(equipItem(userId, { ...reset, itemType: 'SKIN' })).rejects.toMatchObject({ status: 409 });
});
