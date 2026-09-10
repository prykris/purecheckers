import { execFileSync } from 'child_process';
import { closeSync, openSync } from 'node:fs';

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'file:./test.db';
closeSync(openSync('prisma/test.db', 'a'));

// Push schema to test DB
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' }
  });
