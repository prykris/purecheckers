import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import prisma from '../server/db.js';
import { withPuzzlePublishLock } from '../server/services/puzzlePublishing.js';
import { rejectedPuzzleHashes, puzzlePositionKeys } from '../server/services/puzzleRejections.js';
import { verifyLine, classify, CRITERIA, THEMES } from './generate-puzzles.js';
import { puzzleGame, sameTurn } from '../shared/puzzleProgress.js';
import { positionHash, mirror, fullMoves, serializeMove, countPieces } from '../shared/puzzleSearch.js';
import { addDays, parsePuzzleDate, isoDate } from '../shared/puzzleDates.js';

const columns = ['position', 'positionHash', 'solution', 'sideToMove', 'difficulty', 'theme', 'themes', 'solutionPlies', 'legalMoves', 'scoreGap', 'verifiedDepth', 'commentary', 'sourceGameId', 'generatorVersion'];

// Imported JSON is a publication boundary. Validate its structure before search,
// then compare its move annotations and classification with actual engine turns.
function inspectDefinition(source) {
  const invalid = detail => { throw new Error(`Invalid puzzle ${detail}`); };
  const position = source?.position;
  if (!position || !['red', 'black'].includes(position.currentPlayer)
    || !Array.isArray(position.board) || position.board.length !== 8
    || position.board.some((row, r) => !Array.isArray(row) || row.length !== 8 || row.some((piece, c) =>
      piece !== null && (!piece || (r + c) % 2 !== 1 || !['red', 'black'].includes(piece.color) || typeof piece.queen !== 'boolean')))) invalid('position');
  const game = puzzleGame(position);
  const counts = { red: 0, black: 0 };
  for (const piece of position.board.flat()) if (piece) counts[piece.color]++;
  if (!counts.red || !counts.black || counts.red > 12 || counts.black > 12 || countPieces(game) < CRITERIA.MIN_PIECES) invalid('piece count');
  const legal = fullMoves(game);
  if (legal.length < CRITERIA.MIN_LEGAL || source.legalMoves !== legal.length) invalid('legal move count');
  if (source.sideToMove !== game.currentPlayer || !Array.isArray(source.solution) || !source.solution.length
    || source.solution.length % 2 !== 1 || source.solution.length > CRITERIA.MAX_LINE_PLIES
    || source.solutionPlies !== source.solution.length || !Number.isInteger(source.verifiedDepth)
    || source.verifiedDepth < Math.max(source.solution.length + 2, CRITERIA.MIN_VERIFY_DEPTH)
    || source.verifiedDepth > CRITERIA.MAX_VERIFY_DEPTH
    || !Number.isFinite(source.scoreGap) || source.scoreGap < CRITERIA.MIN_GAP
    || typeof source.generatorVersion !== 'string' || !source.generatorVersion.trim()
    || (source.sourceGameId != null && (!Number.isSafeInteger(source.sourceGameId) || source.sourceGameId <= 0))
    || !['EASY', 'MEDIUM', 'HARD'].includes(source.difficulty) || !THEMES.includes(source.theme)
    || !Array.isArray(source.themes) || source.themes.some(theme => !THEMES.includes(theme))
    || new Set([source.theme, ...source.themes]).size !== source.themes.length + 1
    || !['theme', 'position', 'solution', 'alternatives'].every(key => typeof source.commentary?.[key] === 'string' && source.commentary[key].trim())) invalid('metadata');
  let current = game;
  const line = [];
  for (const stored of source.solution) {
    if (!stored || !Array.isArray(stored.hops) || !stored.hops.length) invalid('solution turn');
    const move = fullMoves(current).find(candidate => sameTurn(stored.hops, candidate));
    if (!move || !isDeepStrictEqual(serializeMove(move), stored)) invalid('solution annotations');
    line.push(move); current = move.after;
  }
  const classification = classify({ game, side: game.currentPlayer, line, legal: legal.length });
  if (!classification || ['difficulty', 'theme', 'themes'].some(key => !isDeepStrictEqual(source[key], classification[key]))) invalid('classification');
  return game;
}

export function verifyPuzzleBatch(input, { startDate, log = console.info } = {}) {
  if (!Array.isArray(input) || !input.length || input.length > 366) throw new Error('Expected 1–366 puzzle rows');
  if (startDate && (!(startDate instanceof Date) || !Number.isFinite(startDate.getTime()) || startDate.getTime() !== parsePuzzleDate(isoDate(startDate))?.getTime())) throw new Error('Invalid puzzle start date');
  const dates = new Set(), hashes = new Set();
  return input.map((source, index) => {
    const date = startDate ? addDays(startDate, index) : (typeof source?.date === 'string' && /^\d{4}-\d{2}-\d{2}(?:T00:00:00\.000Z)?$/.test(source.date) ? parsePuzzleDate(source.date.slice(0, 10)) : null);
    if (!date || dates.has(isoDate(date))) throw new Error('Invalid or repeated puzzle date');
    const game = inspectDefinition(source), hash = positionHash(game), opposite = positionHash(mirror(game));
    if (hash !== source.positionHash || hashes.has(hash) || hashes.has(opposite)) throw new Error('Invalid or duplicate puzzle position');
    const check = verifyLine(game, source.solution, source.verifiedDepth);
    if (!check.ok) throw new Error(`Puzzle ${isoDate(date)} failed verification: ${check.reason}`);
    dates.add(isoDate(date)); hashes.add(hash);
    log('[puzzles] verified', isoDate(date), source.difficulty, source.solutionPlies, 'plies');
    return { ...Object.fromEntries(columns.map(key => [key, source[key]])), date };
  });
}

export function importPuzzleBatch(db, rows) {
  return withPuzzlePublishLock(db, async tx => {
    const existing = await tx.puzzle.findMany({ select: { date: true, ...Object.fromEntries(columns.map(key => [key, true])) } });
    const dates = new Map(existing.map(p => [isoDate(p.date), p]));
    const hashes = new Set(existing.map(p => p.positionHash));
    const rejected = await rejectedPuzzleHashes(tx);
    let written = 0, skipped = 0;
    for (const row of rows) {
      const day = isoDate(row.date), occupied = dates.get(day);
      // Reverification may deepen stored search evidence; an import never lowers
      // it. Same position alone does not prove the solution/content is identical.
      if (occupied && columns.filter(key => key !== 'verifiedDepth').every(key => isDeepStrictEqual(occupied[key] ?? null, row[key] ?? null))) { skipped++; continue; }
      if (occupied) throw new Error(`Date ${day} already has a different puzzle or content; nothing was imported`);
      if (puzzlePositionKeys(row.position).some(hash => rejected.has(hash))) throw new Error(`Puzzle for ${day} has a recorded verification failure; nothing was imported`);
      if (hashes.has(row.positionHash) || hashes.has(positionHash(mirror(row.position)))) throw new Error(`Equivalent puzzle already exists for ${day}; nothing was imported`);
      await tx.puzzle.create({ data: row });
      dates.set(day, row); hashes.add(row.positionHash); written++;
    }
    return { written, skipped };
  });
}

export async function main(args = process.argv.slice(2)) {
  let file, startDate, apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') apply = true;
    else if (args[i] === '--start-date') { startDate = parsePuzzleDate(args[++i]); if (!startDate) throw new Error('Use a valid --start-date YYYY-MM-DD'); }
    else if (!file && !args[i].startsWith('--')) file = args[i];
    else throw new Error('Usage: node scripts/import-puzzles.js FILE [--start-date YYYY-MM-DD] [--apply]');
  }
  if (!file) throw new Error('A verified puzzle JSON file is required');
  const rows = verifyPuzzleBatch(JSON.parse(await readFile(file, 'utf8')), { startDate });
  if (!apply) { console.info('[puzzles] Dry run:', rows.length, 'verified; no rows written'); return; }
  const result = await importPuzzleBatch(prisma, rows);
  if (result.busy) throw new Error('Another publisher owns the puzzle buffer; try later');
  console.info('[puzzles] Imported:', result.written, 'already present:', result.skipped);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(err => { console.error(err.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
