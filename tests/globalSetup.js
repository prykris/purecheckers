import { execFileSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './testDatabase.js';

// Apply the migration history to the test database once per test run.
// Test files clean the tables they use, so the schema is kept between runs.
export default function setup() {
  try {
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe'
    });
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n');
    throw new Error(
      `Could not prepare the test database at ${TEST_DATABASE_URL}.\n` +
      'Start a local PostgreSQL with `npm run db:up` or point TEST_DATABASE_URL at one.\n\n' + output
    );
  }
}
