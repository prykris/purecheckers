import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs, runPublishingJob } from './generate-puzzles.js';
import { readPuzzleBuffer, puzzleBufferExitCode } from '../server/services/puzzleBuffer.js';

export async function maintainPuzzleBuffer({ db, options, run = runPublishingJob, now = () => new Date() }) {
  const result = await run({ prisma: db, ...options });
  // Inspect after commit using a fresh date, including when work crosses midnight.
  const buffer = await readPuzzleBuffer(db, { days: options.targetBuffer, now: now() });
  const exitCode = result.busy ? 4 : (result.protectedFailures?.length ? 5 : puzzleBufferExitCode(buffer));
  return {
    exitCode, dryRun: options.dryRun, busy: !!result.busy, seed: options.seed,
    written: options.dryRun ? 0 : (result.written ?? 0),
    proposed: result.proposed ?? 0, remaining: result.remaining ?? null,
    protectedFailures: result.protectedFailures ?? [], skipped: result.skipped ?? [],
    reverification: result.reverification ?? null, buffer
  };
}

export async function main(args = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(['--reverify', '7', ...args]);
    if (options.help) {
      console.log('Usage: npm run puzzles:maintain -- [generator options]. Defaults: --reverify 7 --target-buffer 30 --max-minutes 20. --dry-run never writes; final status reports the actual database buffer.');
      return 0;
    }
  } catch (error) { console.error(error.message); return 2; }
  const { default: db } = await import('../server/db.js');
  try {
    const report = await maintainPuzzleBuffer({ db, options });
    console.log('[puzzles:maintenance]', JSON.stringify(report));
    return report.exitCode;
  } finally { await db.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }, () => { console.error('Puzzle maintenance failed; check database connectivity, migrations and preceding verification logs.'); process.exitCode = 1; });
}
