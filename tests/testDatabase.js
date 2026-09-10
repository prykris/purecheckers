// Shared by tests/globalSetup.js (runs once) and tests/setup.js (runs per file).
// Override with TEST_DATABASE_URL; the default matches docker-compose.yml.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/checkers_test';
