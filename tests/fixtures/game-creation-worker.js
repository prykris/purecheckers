import { createGameRun } from '../../server/services/gameRuns.js';

const { input, owner } = JSON.parse(process.argv[2]);
await createGameRun(input, null, owner);
process.exit(25); // reservation committed, no in-memory room was installed
