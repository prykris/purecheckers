import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { purchaseItem, tipFriend, equipItem } from '../server/services/walletActions.js';
import { calculateShopSplit } from '../server/services/vault.js';
import { readShop } from '../server/services/shop.js';

let alice, bob, item, second;
const purchase = (itemId, requestId = randomUUID()) => ({ itemId, requestId });
const tip = (receiverId, amount = 80, requestId = randomUUID()) => ({ receiverId, amount, requestId });

it('returns a coherent catalogue and inventory when a catalogue/ownership change commits between reads', async () => {
  const before = await readShop(alice.id);
  const concurrentDb = { $transaction: (work, options) => prisma.$transaction(tx => work(new Proxy(tx, {
    get(target, property) {
      if (property !== 'shopItem') return target[property];
      return { findMany: async args => {
        const items = await tx.shopItem.findMany(args);
        await prisma.$transaction([
          prisma.shopItem.update({ where: { id: item.id }, data: { price: 90 } }),
          prisma.inventory.create({ data: { userId: alice.id, itemId: item.id } })
        ]);
        return items;
      } };
    }
  })), options) };
  expect(await readShop(alice.id, concurrentDb)).toEqual(before);
  const after = await readShop(alice.id);
  expect(after.items.find(i => i.id === item.id).price).toBe(90);
  expect(after.inventory).toEqual([expect.objectContaining({ itemId: item.id })]);
});

it('serves non-cacheable shop ownership only to the authenticated account', async () => {
  await prisma.inventory.create({ data: { userId: bob.id, itemId: item.id } });
  await request(app).get('/api/shop').expect(401);
  for (const user of [alice, bob]) {
    const response = await request(app).get('/api/shop').set('Authorization', `Bearer ${jwt.sign({ userId: user.id }, process.env.JWT_SECRET)}`).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.inventory.map(i => i.userId)).toEqual(user.id === bob.id ? [bob.id] : []);
  }
});
beforeEach(async () => {
  [alice, bob] = await Promise.all(['a', 'b'].map(name => prisma.user.create({ data: {
    username: `wallet-${name}-${randomUUID()}`, friendCode: randomUUID(), coins: 100
  } })));
  await prisma.friendship.create({ data: { requesterId: alice.id, receiverId: bob.id, status: 'ACCEPTED' } });
  [item, second] = await Promise.all([1, 2].map(i => prisma.shopItem.create({ data: {
    slug: `wallet-${i}-${randomUUID()}`, name: `Wallet theme ${i}`, type: 'THEME', price: 80, data: {}
  } })));
  await prisma.systemVault.upsert({ where: { id: 1 }, create: { id: 1, balance: 0 }, update: { balance: 0 } });
  await prisma.vaultLog.deleteMany();
});
afterEach(async () => {
  const ids = [alice.id, bob.id];
  await prisma.inventory.deleteMany({ where: { userId: { in: ids } } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: { in: ids } } });
  await prisma.friendship.deleteMany({ where: { requesterId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.shopItem.deleteMany({ where: { id: { in: [item.id, second.id] } } });
  await prisma.vaultLog.deleteMany();
  await prisma.systemVault.update({ where: { id: 1 }, data: { balance: 0 } });
});

it('charges a duplicated purchase once and retains the original receipt despite later price changes', async () => {
  const intent = purchase(item.id);
  const [a, b] = await Promise.all([purchaseItem(alice.id, intent), purchaseItem(alice.id, intent)]);
  expect(b).toEqual(a);
  await prisma.shopItem.update({ where: { id: item.id }, data: { price: 90 } });
  expect(await purchaseItem(alice.id, intent)).toEqual(a);
  expect(await prisma.inventory.count({ where: { userId: alice.id } })).toBe(1);
  expect(await prisma.coinTransaction.findMany({ where: { receiverId: alice.id } })).toEqual([
    expect.objectContaining({ amount: -80, reason: 'PURCHASE' })
  ]);
  const split = calculateShopSplit(80);
  expect((await prisma.systemVault.findUnique({ where: { id: 1 } })).balance).toBe(split.toVault);
  expect((await prisma.walletOperation.aggregate({ where: { userId: alice.id }, _sum: { burned: true } }))._sum.burned).toBe(split.burned);
  await expect(purchaseItem(alice.id, purchase(item.id))).rejects.toThrow('Already owned');
  await expect(purchaseItem(alice.id, purchase(second.id, intent.requestId))).rejects.toThrow('different action');
});

it('allows only one concurrent purchase when the wallet cannot afford both', async () => {
  const results = await Promise.allSettled([purchaseItem(alice.id, purchase(item.id)), purchaseItem(alice.id, purchase(second.id))]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await prisma.user.findUnique({ where: { id: alice.id } })).coins).toBe(20);
  expect(await prisma.inventory.count({ where: { userId: alice.id } })).toBe(1);
});

it('rolls back inventory, wallet, burn, vault and receipt together then accepts the original retry', async () => {
  const intent = purchase(item.id);
  await expect(prisma.$transaction(async tx => { await purchaseItem(alice.id, intent, tx); throw Error('commit failed'); })).rejects.toThrow('commit failed');
  expect((await prisma.user.findUnique({ where: { id: alice.id } })).coins).toBe(100);
  expect(await prisma.inventory.count({ where: { userId: alice.id } })).toBe(0);
  expect(await prisma.coinTransaction.count({ where: { receiverId: alice.id } })).toBe(0);
  expect(await prisma.walletOperation.count({ where: { userId: alice.id } })).toBe(0);
  expect(await prisma.vaultLog.count()).toBe(0);
  expect((await prisma.systemVault.findUnique({ where: { id: 1 } })).balance).toBe(0);
  expect((await purchaseItem(alice.id, intent)).coins).toBe(20);
});

it('does not mint vault coins or create a phantom debit for a free item', async () => {
  await prisma.shopItem.update({ where: { id: item.id }, data: { price: 0 } });
  expect(await purchaseItem(alice.id, purchase(item.id))).toMatchObject({ coins: 100, burned: 0, toVault: 0 });
  expect(await prisma.coinTransaction.count({ where: { receiverId: alice.id } })).toBe(0);
  expect(await prisma.vaultLog.count()).toBe(0);
});

it('confirms duplicate tips once, including after the friendship is removed', async () => {
  const intent = tip(bob.id);
  const [a, b] = await Promise.all([tipFriend(alice.id, intent), tipFriend(alice.id, intent)]);
  expect(b).toEqual(a);
  await prisma.friendship.deleteMany({ where: { requesterId: alice.id } });
  expect(await tipFriend(alice.id, intent)).toEqual(a);
  expect((await prisma.user.findUnique({ where: { id: bob.id } })).coins).toBe(180);
  const ledger = await prisma.coinTransaction.findMany({ where: { receiverId: { in: [alice.id, bob.id] } } });
  expect(ledger).toHaveLength(2);
  expect(ledger.reduce((sum, row) => sum + row.amount, 0)).toBe(0);
  expect(ledger.every(row => row.senderId === alice.id)).toBe(true);
  await expect(tipFriend(alice.id, tip(bob.id, 1, intent.requestId))).rejects.toThrow('different action');
  await expect(tipFriend(alice.id, tip(bob.id, 1))).rejects.toThrow('Must be friends');
});

it('serializes tips against purchases and never overspends a shared wallet', async () => {
  const result = await Promise.allSettled([tipFriend(alice.id, tip(bob.id)), purchaseItem(alice.id, purchase(item.id))]);
  expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await prisma.user.findUnique({ where: { id: alice.id } })).coins).toBe(20);
  expect(await prisma.walletOperation.count({ where: { userId: alice.id } })).toBe(1);
});

it('supports opposite-direction transfers without deadlocks and scopes request IDs to the sender', async () => {
  const key = randomUUID();
  await Promise.all([tipFriend(alice.id, tip(bob.id, 25, key)), tipFriend(bob.id, tip(alice.id, 25, key))]);
  expect((await prisma.user.findMany({ where: { id: { in: [alice.id, bob.id] } } })).map(u => u.coins)).toEqual([100, 100]);
});

it('rolls back both transfer legs and allows retry with the same identity', async () => {
  const intent = tip(bob.id);
  await expect(prisma.$transaction(async tx => { await tipFriend(alice.id, intent, tx); throw Error('commit failed'); })).rejects.toThrow('commit failed');
  expect((await prisma.user.findMany({ where: { id: { in: [alice.id, bob.id] } } })).map(u => u.coins)).toEqual([100, 100]);
  expect(await prisma.coinTransaction.count({ where: { receiverId: { in: [alice.id, bob.id] } } })).toBe(0);
  expect((await tipFriend(alice.id, intent)).coins).toBe(20);
});

it('rejects malformed IDs, fractional amounts and missing request identities before any mutation', async () => {
  for (const amount of [-1, 0, 0.5, '20', NaN, 2_147_483_648]) {
    expect(() => tipFriend(alice.id, tip(bob.id, amount))).toThrow();
  }
  expect(() => purchaseItem(alice.id, { itemId: item.id })).toThrow('requestId');
  expect(() => purchaseItem(alice.id, purchase('1'))).toThrow('Invalid');
  expect(await prisma.walletOperation.count({ where: { userId: alice.id } })).toBe(0);
});

it('serializes concurrent equipment choices so at most one theme is equipped', async () => {
  await prisma.inventory.createMany({ data: [item, second].map(i => ({ userId: alice.id, itemId: i.id })) });
  await Promise.all([equipItem(alice.id, purchase(item.id)), equipItem(alice.id, purchase(second.id))]);
  expect(await prisma.inventory.count({ where: { userId: alice.id, equipped: true } })).toBe(1);
});

it('returns an old equipment receipt without undoing a newer choice or changing coins', async () => {
  await prisma.inventory.createMany({ data: [item, second].map(i => ({ userId: alice.id, itemId: i.id })) });
  const intent = purchase(item.id);
  const receipts = await Promise.all([equipItem(alice.id, intent), equipItem(alice.id, intent)]);
  expect(receipts[0]).toEqual({ equipped: true, itemId: item.id });
  expect(receipts[1]).toEqual(receipts[0]);
  await equipItem(alice.id, purchase(second.id));
  expect(await equipItem(alice.id, intent)).toEqual(receipts[0]);
  expect(await prisma.inventory.findMany({ where: { userId: alice.id, equipped: true } })).toEqual([expect.objectContaining({ itemId: second.id })]);
  expect((await prisma.user.findUnique({ where: { id: alice.id } })).coins).toBe(100);
  expect(await prisma.coinTransaction.count({ where: { receiverId: alice.id } })).toBe(0);
  expect(await prisma.walletOperation.count({ where: { userId: alice.id, kind: 'equip' } })).toBe(2);
  await expect(equipItem(alice.id, { ...intent, itemId: second.id })).rejects.toThrow('different action');
  expect(() => equipItem(alice.id, { itemId: item.id })).toThrow('requestId');
});

it('rolls equipment and its receipt back together and disallows equipping an emote', async () => {
  await prisma.inventory.create({ data: { userId: alice.id, itemId: item.id } });
  const intent = purchase(item.id);
  await expect(prisma.$transaction(async tx => { await equipItem(alice.id, intent, tx); throw Error('rollback'); })).rejects.toThrow('rollback');
  expect(await prisma.inventory.count({ where: { userId: alice.id, equipped: true } })).toBe(0);
  expect(await prisma.walletOperation.count({ where: { userId: alice.id } })).toBe(0);
  await prisma.shopItem.update({ where: { id: item.id }, data: { type: 'EMOTE' } });
  await expect(equipItem(alice.id, intent)).rejects.toThrow('cannot be equipped');
  expect(await prisma.walletOperation.count({ where: { userId: alice.id } })).toBe(0);
});

it('rejects missing API bodies and legacy requests without a durable identity without charging', async () => {
  const authorization = `Bearer ${jwt.sign({ userId: alice.id }, process.env.JWT_SECRET)}`;
  for (const path of ['/api/shop/purchase', '/api/coins/tip']) {
    const response = await request(app).post(path).set('Authorization', authorization);
    expect(response.status).toBe(400);
  }
  const purchaseResponse = await request(app).post('/api/shop/purchase').set('Authorization', authorization).send({ itemId: item.id });
  expect(purchaseResponse.status).toBe(400);
  expect(purchaseResponse.body.error).toMatch(/requestId/);
  expect((await prisma.user.findUnique({ where: { id: alice.id } })).coins).toBe(100);
});

it('includes historical and new burn metadata once in treasury totals', async () => {
  const before = await request(app).get('/api/treasury');
  await prisma.coinTransaction.create({ data: { receiverId: alice.id, reason: 'PURCHASE_BURN', amount: -7 } });
  const receipt = await purchaseItem(alice.id, purchase(item.id));
  const after = await request(app).get('/api/treasury');
  expect(before.status).toBe(200); expect(after.status).toBe(200);
  expect(after.body.burned.total - before.body.burned.total).toBe(7 + receipt.burned);
});
