import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';

// Existing deployments use db push rather than migration history. Apply this
// additive upgrade first; db push still refuses any unrelated destructive change.
export async function prepareDatabase(prisma) {
  await prisma.$transaction(async tx => {
    const columns = await tx.$queryRaw`PRAGMA table_info("User")`;
    if (!columns.length) return; // db push creates a fresh database.
    if (!columns.some(column => column.name === 'botKey')) {
      await tx.$executeRaw`ALTER TABLE "User" ADD COLUMN "botKey" TEXT`;
    }
    const indexes = await tx.$queryRaw`PRAGMA index_list("User")`;
    const index = indexes.find(index => index.name === 'User_botKey_key');
    if (index) {
      const fields = await tx.$queryRaw`PRAGMA index_info("User_botKey_key")`;
      if (Number(index.unique) !== 1 || Number(index.partial) !== 0 || fields.length !== 1 || fields[0].name !== 'botKey') {
        throw new Error('Unexpected User_botKey_key index; database upgrade stopped without changing user data.');
      }
    } else {
      // Duplicate existing non-null keys fail here and roll back this transaction.
      await tx.$executeRaw`CREATE UNIQUE INDEX "User_botKey_key" ON "User"("botKey")`;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();
  try { await prepareDatabase(prisma); }
  catch (error) { console.error('Database preparation failed:', error.message); process.exitCode = 1; }
  finally { await prisma.$disconnect(); }
}
