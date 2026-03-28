// Test setup — runs before all test files
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'file:./test.db';

import { execSync } from 'child_process';

// Push schema to test DB without migrations
execSync('npx prisma db push --skip-generate --accept-data-loss', {
  stdio: 'pipe',
  env: { ...process.env, DATABASE_URL: 'file:./test.db' }
});
