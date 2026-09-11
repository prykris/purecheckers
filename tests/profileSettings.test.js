import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { updateProfilePrivacy } from '../server/services/profileSettings.js';

let user;
beforeEach(async () => { user = await prisma.user.create({ data: { username: randomUUID(), friendCode: randomUUID() } }); });
afterEach(async () => { await prisma.user.delete({ where: { id: user.id } }); });
const write = (profilePublic, expectedProfileVersion) => updateProfilePrivacy(user.id, { profilePublic, expectedProfileVersion });

it('rejects a delayed choice after a newer privacy decision, including a same-value decision', async () => {
  expect(await write(true, user.profileVersion)).toEqual({ profilePublic: true, profileVersion: user.profileVersion + 1 });
  await expect(write(false, user.profileVersion)).rejects.toMatchObject({ status: 409 });
  expect((await prisma.user.findUnique({ where: { id: user.id } })).profilePublic).toBe(true);
  expect(await write(false, user.profileVersion + 1)).toMatchObject({ profilePublic: false, profileVersion: user.profileVersion + 2 });
  await expect(write(true, user.profileVersion + 1)).rejects.toMatchObject({ status: 409 });
  expect((await prisma.user.findUnique({ where: { id: user.id } })).profilePublic).toBe(false);
});

it('admits only one of two conflicting concurrent writes using the same revision', async () => {
  const outcomes = await Promise.allSettled([write(false, user.profileVersion), write(true, user.profileVersion)]);
  const success = outcomes.find(o => o.status === 'fulfilled');
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.find(o => o.status === 'rejected').reason.status).toBe(409);
  expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject(success.value);
});

it('treats unrelated profile writes as a conflict without losing either update', async () => {
  await prisma.user.update({ where: { id: user.id }, data: { coins: 25 } });
  await expect(write(false, user.profileVersion)).rejects.toMatchObject({ status: 409 });
  const current = await prisma.user.findUnique({ where: { id: user.id } });
  expect(current).toMatchObject({ coins: 25, profilePublic: true });
  await write(false, current.profileVersion);
  expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ coins: 25, profilePublic: false });
});

it('rolls back the setting and revision together and rechecks account retirement', async () => {
  await expect(prisma.$transaction(async tx => {
    await updateProfilePrivacy(user.id, { profilePublic: false, expectedProfileVersion: user.profileVersion }, tx); throw Error('rollback');
  })).rejects.toThrow('rollback');
  expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ profilePublic: true, profileVersion: user.profileVersion });
  const retired = await prisma.user.update({ where: { id: user.id }, data: { guestRetiredAt: new Date() } });
  await expect(write(false, retired.profileVersion)).rejects.toMatchObject({ status: 401 });
});

it('requires an explicit valid revision and returns a non-cacheable versioned confirmation', async () => {
  const authorization = 'Bearer ' + jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
  for (const expectedProfileVersion of [undefined, null, -1, 1.5, '0', 2_147_483_648]) {
    await request(app).patch('/api/auth/profile').set('Authorization', authorization).send({ profilePublic: false, expectedProfileVersion }).expect(400);
  }
  const response = await request(app).patch('/api/auth/profile').set('Authorization', authorization)
    .send({ profilePublic: false, expectedProfileVersion: user.profileVersion }).expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toEqual({ profilePublic: false, profileVersion: user.profileVersion + 1 });
  await request(app).patch('/api/auth/profile').set('Authorization', authorization)
    .send({ profilePublic: true, expectedProfileVersion: user.profileVersion }).expect(409);
});
