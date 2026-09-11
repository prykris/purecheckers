import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { createProfileReconciliation } from '../server/services/profileReconciliation.js';
let user;
beforeEach(async () => { user = await prisma.user.create({ data: { username: randomUUID(), friendCode: randomUUID() } }); });
afterEach(async () => { await prisma.user.delete({ where: { id: user.id } }); });

it('reconciles committed external changes and repeats a dropped hint without publishing rolled-back state', async () => {
  const emit = vi.fn();
  const server = createProfileReconciliation({ db: prisma, connections: new Map([[user.id, { socket: { connected: true, emit } }]]) });
  try {
    await server.runOnce();
    await prisma.user.update({ where: { id: user.id }, data: { coins: 25 } });
    await expect(prisma.$transaction(async tx => { await tx.user.update({ where: { id: user.id }, data: { coins: 50 } }); throw Error('rollback'); })).rejects.toThrow('rollback');
    await server.runOnce(); await server.runOnce();
    expect(emit.mock.calls.map(([, hint]) => hint)).toEqual([
      { userId: user.id, profileVersion: 0 }, { userId: user.id, profileVersion: 1 }, { userId: user.id, profileVersion: 1 }
    ]);
  } finally { await server.stop(); }
});

it('versions ORM, bulk and raw SQL changes using the same transactional counter', async () => {
  expect(user.profileVersion).toBe(0);
  expect((await prisma.user.update({ where: { id: user.id }, data: { coins: 10 } })).profileVersion).toBe(1);
  await prisma.user.updateMany({ where: { id: user.id }, data: { profilePublic: false } });
  await prisma.$executeRaw`UPDATE "User" SET "coins" = "coins" + 5 WHERE "id" = ${user.id}`;
  expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ profileVersion: 3, coins: 15, profilePublic: false });
});

it('rolls revisions back with the profile and serializes concurrent writers', async () => {
  await expect(prisma.$transaction(async tx => { await tx.user.update({ where: { id: user.id }, data: { coins: 5 } }); throw Error('rollback'); })).rejects.toThrow('rollback');
  expect((await prisma.user.findUnique({ where: { id: user.id } })).profileVersion).toBe(0);
  await Promise.all(Array.from({ length: 4 }, () => prisma.user.update({ where: { id: user.id }, data: { coins: { increment: 1 } } })));
  expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ profileVersion: 4, coins: 4 });
});

it('returns a versioned non-cacheable profile after privacy changes', async () => {
  const token = jwt.sign({ userId: user.id, username: user.username, isGuest: false }, process.env.JWT_SECRET);
  await request(app).patch('/api/auth/profile').set('Authorization', 'Bearer ' + token).send({ profilePublic: false, expectedProfileVersion: user.profileVersion }).expect(200);
  const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + token).expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.user).toMatchObject({ id: user.id, profileVersion: 1, profilePublic: false });
  expect(response.body.user.passwordHash).toBeUndefined();
});
