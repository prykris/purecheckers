import { execSync } from 'child_process';

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'file:./test.db';

// Push schema to test DB
try {
  execSync('npx prisma db push --skip-generate --accept-data-loss 2>&1', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' }
  });
} catch (e) {
  console.warn('Prisma db push warning:', e.message);
}
