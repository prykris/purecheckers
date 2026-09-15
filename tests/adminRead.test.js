import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import app from '../server/app.js';
import { executeAdminAction } from '../server/services/adminActions.js';
let actor, target;
const auth = player => ({ authorization: 'Bearer ' + jwt.sign({ userId: player.id, isAdmin: true }, process.env.JWT_SECRET) });
beforeEach(async () => {
  actor = await prisma.user.create({ data: { username: 'admin-read-' + randomUUID(), friendCode: randomUUID(), isAdmin: true } });
  target = await prisma.user.create({ data: { username: 'player-read-' + randomUUID(), friendCode: randomUUID(), coins: 40, passwordHash: 'never-return-this', email: randomUUID() + '@example.test' } });
});
afterEach(async () => {
  await prisma.adminOperation.deleteMany({ where: { actorId: actor.id } });
  await prisma.coinTransaction.deleteMany({ where: { receiverId: target.id } });
  await prisma.user.deleteMany({ where: { id: { in: [actor.id, target.id] } } });
});
it('denies every admin read to unauthenticated and ordinary players, ignoring forged role metadata', async () => {
  for (const section of ['overview','players','games','live','rooms','puzzles','economy','activity', 'players/' + target.id]) {
    expect((await request(app).get('/api/admin/' + section)).status).toBe(401);
    expect((await request(app).get('/api/admin/' + section).set(auth(target))).status).toBe(403);
  }
});
it('serves searchable, bounded records and details without credentials', async () => {
  const list = await request(app).get('/api/admin/players').query({q:target.username}).set(auth(actor));
  expect(list.status).toBe(200); expect(list.headers['cache-control']).toBe('no-store');
  expect(list.body.rows).toHaveLength(1); expect(list.body.rows[0].id).toBe(target.id);
  const detail = await request(app).get('/api/admin/players/' + target.id).set(auth(actor));
  expect(detail.status).toBe(200); expect(detail.body.player.email).toBe(target.email);
  for(const body of [list.body, detail.body]) expect(JSON.stringify(body)).not.toMatch(/passwordHash|never-return-this|friendCode/);
  for(const query of [{offset:-1},{offset:0.5},{q:'x'.repeat(101)},{filter:'invalid'},{sort:'invalid'}]) expect((await request(app).get('/api/admin/players').query(query).set(auth(actor))).status).toBe(400);
  expect((await request(app).get('/api/admin/players/not-an-id').set(auth(actor))).status).toBe(400);
});
it('reads current permission on each request and keeps role markers independent of permission claims', async () => {
  const before = await request(app).get('/api/leaderboard/roles').query({names:actor.username+'|'+target.username});
  expect(before.body).toEqual({administrators:[actor.username]});
  await prisma.user.update({where:{id:actor.id},data:{isAdmin:false}});
  expect((await request(app).get('/api/admin/overview').set(auth(actor))).status).toBe(403);
  expect((await request(app).get('/api/leaderboard/roles').query({names:actor.username})).body).toEqual({administrators:[]});
});
it('exposes the same confirmed adjustment in player, ledger and audit views', async () => {
  const receipt = await executeAdminAction(actor.id,'give-coins',{userId:target.id,amount:7,reason:'Support correction',requestId:randomUUID()});
  const ledger = await request(app).get('/api/admin/economy').query({userId:target.id}).set(auth(actor));
  const history = await request(app).get('/api/admin/activity').query({userId:target.id}).set(auth(actor));
  expect(ledger.status).toBe(200); expect(ledger.body.rows[0]).toMatchObject({amount:7,reason:'ADMIN_ADJUSTMENT'});
  expect(history.status).toBe(200); expect(history.body.rows[0].receipt).toEqual(receipt);
  expect(history.body.rows[0].payload.reason).toBe('Support correction');
});
it('loads all operational sections and their empty states', async () => {
  for (const section of ['overview','rooms','live','games','puzzles','economy','activity']) {
    const result=await request(app).get('/api/admin/'+section).set(auth(actor));
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    if(section==='overview') expect(result.body.buffer.requiredDays).toBe(31); else expect(result.body.rows.length).toBeLessThanOrEqual(25);
  }
});

it('sorts the selected player set and validates puzzle dates before lookup', async () => {
  const response=await request(app).get('/api/admin/players').query({q:target.username,sort:'rating'}).set(auth(actor));
  expect(response.status).toBe(200);expect(response.body.rows[0].id).toBe(target.id);
  expect((await request(app).get('/api/admin/puzzles').query({q:'2026-02-30'}).set(auth(actor))).status).toBe(400);
  expect((await request(app).get('/api/admin/puzzles').query({q:'bad date'}).set(auth(actor))).status).toBe(400);
  expect((await request(app).get('/api/admin/puzzles/2026-02-30').set(auth(actor))).status).toBe(400);
  expect((await request(app).get('/api/admin/puzzles/2026-99-01').set(auth(actor))).status).toBe(400);
});
