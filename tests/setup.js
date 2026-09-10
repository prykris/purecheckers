import { TEST_DATABASE_URL } from './testDatabase.js';

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = TEST_DATABASE_URL;
