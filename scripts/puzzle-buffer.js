import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readPuzzleBuffer, puzzleBufferExitCode } from '../server/services/puzzleBuffer.js';

export function parseBufferArgs(args) {
  if (!args.length) return { days: 30 };
  if (args.length !== 2 || args[0] !== '--days' || !/^\d+$/.test(args[1]) || Number(args[1]) > 365) {
    throw new Error('Usage: npm run puzzles:status -- [--days 0..365]');
  }
  return { days: Number(args[1]) };
}

export async function main(args = process.argv.slice(2)) {
  let options;
  try { options = parseBufferArgs(args); }
  catch (error) { console.error(error.message); return 2; }
  const { default: db } = await import('../server/db.js');
  try {
    const report = await readPuzzleBuffer(db, options);
    console.log(JSON.stringify(report));
    return puzzleBufferExitCode(report);
  } finally { await db.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }, () => { console.error('Puzzle buffer inspection failed; check database connectivity and migrations.'); process.exitCode = 1; });
}
