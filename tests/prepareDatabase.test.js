import { PrismaClient } from '@prisma/client';
import { prepareDatabase } from '../prisma/prepareDatabase.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let prisma, directory;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'checkers-upgrade-'));
  prisma = new PrismaClient({ datasources: { db: { url: 'file:' + join(directory, 'upgrade.db').replaceAll('\\', '/') } } });
});
afterEach(async () => { await prisma.$disconnect(); await rm(directory, { recursive: true, force: true }); });

it('leaves an empty database for db push to initialize', async () => {
  await prepareDatabase(prisma);
  expect(await prisma.$queryRaw`PRAGMA table_info("User")`).toEqual([]);
});

it('upgrades populated legacy users and is safe to run again', async () => {
  await prisma.$executeRaw`CREATE TABLE "User" (id INTEGER PRIMARY KEY, username TEXT, coins INTEGER)`;
  await prisma.$executeRaw`INSERT INTO "User" VALUES (1, 'Existing human', 750), (2, 'Existing bot', 90)`;
  await prepareDatabase(prisma); await prepareDatabase(prisma);
  expect(await prisma.$queryRaw`SELECT * FROM "User" ORDER BY id`).toEqual([
    { id: 1, username: 'Existing human', coins: 750, botKey: null }, { id: 2, username: 'Existing bot', coins: 90, botKey: null },
  ]);
  await prisma.$executeRaw`UPDATE "User" SET "botKey" = 'easy' WHERE id = 2`;
  await expect(prisma.$executeRaw`UPDATE "User" SET "botKey" = 'easy' WHERE id = 1`).rejects.toThrow();
});

it('fails without modifying users when duplicate keys already exist', async () => {
  await prisma.$executeRaw`CREATE TABLE "User" (id INTEGER PRIMARY KEY, botKey TEXT)`;
  await prisma.$executeRaw`INSERT INTO "User" VALUES (1, 'easy'), (2, 'easy')`;
  await expect(prepareDatabase(prisma)).rejects.toThrow();
  expect(await prisma.$queryRaw`SELECT * FROM "User" ORDER BY id`).toEqual([{ id: 1, botKey: 'easy' }, { id: 2, botKey: 'easy' }]);
});

it('rejects a conflicting index definition and rolls back the added column', async () => {
  await prisma.$executeRaw`CREATE TABLE "User" (id INTEGER PRIMARY KEY)`;
  await prisma.$executeRaw`CREATE INDEX "User_botKey_key" ON "User"("id")`;
  await expect(prepareDatabase(prisma)).rejects.toThrow(/Unexpected/);
  const columns = await prisma.$queryRaw`PRAGMA table_info("User")`;
  expect(columns.map(column => column.name)).toEqual(['id']);
});
