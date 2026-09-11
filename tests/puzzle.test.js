import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../server/db.js';
import { createPuzzleRouter } from '../server/routes/puzzle.js';
import { mirror, positionHash } from '../shared/puzzleSearch.js';
import { runPublishingJob } from '../scripts/generate-puzzles.js';
import { importPuzzleBatch } from '../scripts/import-puzzles.js';
import { readPuzzleBuffer } from '../server/services/puzzleBuffer.js';
import { recordPuzzleAttempt } from '../server/services/puzzles.js';
import { lockEconomyUsers } from '../server/services/economy.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/puzzle.json', import.meta.url)));
const now = new Date('2026-09-10T12:00:00Z');
const app = express().use(express.json()).use('/api/puzzle', createPuzzleRouter({ now: () => now }));
let user, guest;
const token = user => jwt.sign({ userId: user.id, isGuest: user.isGuest }, process.env.JWT_SECRET);
const solved = () => ({ solved: true, revealed: false, hintUsed: false, attempts: 1, timeMs: 1234,
  turns: fixture.solution.filter((_, i) => i % 2 === 0).map(m => m.hops) });
const post = (body, account = user, date = '2026-09-10') => {
  let req = request(app).post(`/api/puzzle/${date}/attempt`);
  if (account) req = req.set('Authorization', `Bearer ${token(account)}`);
  return req.send(body);
};

beforeEach(async () => {
  await prisma.puzzleAttempt.deleteMany(); await prisma.puzzle.deleteMany();
  await prisma.coinTransaction.deleteMany({ where: { reason: 'PUZZLE_SOLVE' } });
  await prisma.user.deleteMany({ where: { friendCode: { startsWith: 'PUZZLE-' } } });
  user = await prisma.user.create({ data: { username: 'Puzzle Player', friendCode: 'PUZZLE-USER' } });
  guest = await prisma.user.create({ data: { username: 'Puzzle Guest', friendCode: 'PUZZLE-GUEST', isGuest: true } });
  for (const [date, hash] of [['2026-09-09', 'past'], ['2026-09-10', fixture.positionHash], ['2026-09-11', 'future']]) {
    await prisma.puzzle.create({ data: { ...fixture, date: new Date(date), positionHash: hash } });
  }
});
afterEach(async () => {
  await prisma.puzzleAttempt.deleteMany(); await prisma.puzzle.deleteMany();
  await prisma.coinTransaction.deleteMany({ where: { reason: 'PUZZLE_SOLVE' } });
  await prisma.user.deleteMany({ where: { friendCode: { startsWith: 'PUZZLE-' } } });
});

it('inspects calendar coverage without writing puzzles or attempts', async () => {
  expect(await readPuzzleBuffer(prisma, { now, days: 3 })).toMatchObject({ availableDays: 2, consecutiveDays: 2,
    firstMissingDate: '2026-09-12', missingDates: ['2026-09-12', '2026-09-13'], healthy: false });
  expect(await prisma.puzzle.count()).toBe(3);
  expect(await prisma.puzzleAttempt.count()).toBe(0);
});

it('serves published puzzles and navigation while hiding every future surface', async () => {
  const today = await request(app).get('/api/puzzle/today');
  expect(today.status).toBe(200);
  expect(today.body).toMatchObject({ puzzle: { date: '2026-09-10' }, prev: '2026-09-09', next: null, archived: false });
  expect(today.headers['cache-control']).toBe('public, max-age=300');
  const past = await request(app).get('/api/puzzle/2026-09-09');
  expect(past.body.archived).toBe(true);
  expect(past.headers['cache-control']).toContain('86400');
  expect((await request(app).get('/api/puzzle/2026-09-11')).status).toBe(404);
  expect((await post(solved(), user, '2026-09-11')).status).toBe(404);
  const archive = await request(app).get('/api/puzzle?before=2027-01-01');
  expect(archive.body.puzzles.map(p => p.date)).toEqual(['2026-09-10', '2026-09-09']);
  expect((await request(app).get('/api/puzzle/2026-02-30')).status).toBe(400);
  expect((await request(app).get('/api/puzzle?limit=0')).status).toBe(400);
});

it('awards exactly one coin despite simultaneous retries, with one ledger entry', async () => {
  const responses = await Promise.all(Array.from({ length: 10 }, () => post(solved())));
  expect(responses.every(r => r.status === 200)).toBe(true);
  expect(responses.reduce((n, r) => n + r.body.coinsAwarded, 0)).toBe(1);
  expect(await prisma.puzzleAttempt.count({ where: { userId: user.id } })).toBe(1);
  expect(await prisma.coinTransaction.count({ where: { receiverId: user.id, reason: 'PUZZLE_SOLVE' } })).toBe(1);
  expect((await prisma.user.findUnique({ where: { id: user.id } })).coins).toBe(1);
  expect((await post(solved(), user, '2026-09-09')).body.coinsAwarded).toBe(0);
});

it('rechecks retirement after waiting for the shared account lock', async () => {
  let locked, release, entering;
  const held = new Promise(resolve => { locked = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const lockRequested = new Promise(resolve => { entering = resolve; });
  const puzzle = await prisma.puzzle.findUnique({ where: { date: new Date('2026-09-10') } });
  const retirement = prisma.$transaction(async tx => {
    await lockEconomyUsers(tx, [user.id]);
    await tx.user.update({ where: { id: user.id }, data: { guestRetiredAt: now } });
    locked(); await gate;
  });
  await held;
  const db = { $transaction: work => prisma.$transaction(tx => work(new Proxy(tx, { get(target, key) {
    if (key === '$queryRaw') return (...args) => { entering(); return tx.$queryRaw(...args); };
    return target[key];
  } }))) };
  const attempt = recordPuzzleAttempt(db, { puzzle, userId: user.id, body: solved(), now })
    .then(value => ({ value }), error => ({ error }));
  try { await lockRequested; } finally { release(); }
  await retirement;
  expect((await attempt).error).toMatchObject({ status: 401 });
  expect(await prisma.puzzleAttempt.count({ where: { userId: user.id } })).toBe(0);
  expect((await prisma.user.findUnique({ where: { id: user.id } })).coins).toBe(0);
});

it('rolls back the attempt and wallet when writing the reward ledger fails', async () => {
  const puzzle = await prisma.puzzle.findUnique({ where: { date: new Date('2026-09-10') } });
  const db = { $transaction: work => prisma.$transaction(tx => work(new Proxy(tx, { get(target, key) {
    if (key === 'coinTransaction') return { create: async () => { throw Error('ledger unavailable'); } };
    return target[key];
  } }))) };
  await expect(recordPuzzleAttempt(db, { puzzle, userId: user.id, body: solved(), now })).rejects.toThrow('ledger unavailable');
  expect(await prisma.puzzleAttempt.count({ where: { userId: user.id } })).toBe(0);
  expect((await prisma.user.findUnique({ where: { id: user.id } })).coins).toBe(0);
  expect((await post(solved())).body.coinsAwarded).toBe(1);
});

it('keeps anonymous attempts idempotent and gives guests no coins', async () => {
  const body = { ...solved(), visitorId: randomUUID() };
  const results = await Promise.all([post(body, null), post(body, null)]);
  expect(results.every(r => r.status === 200 && r.body.coinsAwarded === 0)).toBe(true);
  expect(await prisma.puzzleAttempt.count({ where: { visitorId: body.visitorId } })).toBe(1);
  expect((await post(solved(), guest)).body.coinsAwarded).toBe(0);
  const attempt = await prisma.puzzleAttempt.findFirst({ where: { userId: guest.id } });
  await prisma.user.delete({ where: { id: guest.id } });
  expect((await prisma.puzzleAttempt.findUnique({ where: { id: attempt.id } })).userId).toBeNull();
});

it('preserves reveal history and rejects invented solves or invalid credentials', async () => {
  expect((await post({ ...solved(), turns: [] })).status).toBe(400);
  expect((await post({ ...solved(), solved: false, revealed: true })).status).toBe(200);
  const retry = await post(solved());
  expect(retry.body).toMatchObject({ coinsAwarded: 0, attempt: { solved: false, revealed: true } });
  expect((await request(app).post('/api/puzzle/2026-09-10/attempt').set('Authorization', 'Bearer stale').send(solved())).status).toBe(401);
  const history = await request(app).get('/api/puzzle/history').set('Authorization', `Bearer ${token(user)}`);
  expect(history.body.streak).toBe(0);
});

it('reads registration from the database so an upgraded guest can earn with an old token', async () => {
  await post(solved(), guest);
  await prisma.user.update({ where: { id: guest.id }, data: { isGuest: false } });
  expect((await post(solved(), guest)).body.coinsAwarded).toBe(1);
});

it('does not let concurrent publishing runs acquire the same advisory lock', async () => {
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73190603)`;
    expect(await runPublishingJob({ prisma, targetBuffer: 0, maxMinutes: 1 })).toEqual({ busy: true });
  });
});

it('imports a verified batch idempotently and rolls back the entire batch on a date conflict', async () => {
  const buffer = JSON.parse(readFileSync(new URL('../data/puzzles/launch-buffer.json', import.meta.url)));
  const first = { ...buffer[1], date: new Date('2026-09-20') };
  const conflicting = { ...buffer[2], date: new Date('2026-09-09') };
  await expect(importPuzzleBatch(prisma, [first, conflicting])).rejects.toThrow('already has a different puzzle');
  expect(await prisma.puzzle.findUnique({ where: { date: first.date } })).toBeNull();
  expect(await importPuzzleBatch(prisma, [first])).toEqual({ written: 1, skipped: 0 });
  expect(await importPuzzleBatch(prisma, [first])).toEqual({ written: 0, skipped: 1 });
  await prisma.puzzle.update({ where: { date: first.date }, data: { verifiedDepth: 12 } });
  expect(await importPuzzleBatch(prisma, [first])).toEqual({ written: 0, skipped: 1 });
  expect((await prisma.puzzle.findUnique({ where: { date: first.date } })).verifiedDepth).toBe(12);
  await expect(importPuzzleBatch(prisma, [{ ...first, commentary: { ...first.commentary, position: 'Changed explanation' } }])).rejects.toThrow('different puzzle or content');
  await expect(importPuzzleBatch(prisma, [{ ...first, date: new Date('2026-09-21') }])).rejects.toThrow('Equivalent puzzle');
});
