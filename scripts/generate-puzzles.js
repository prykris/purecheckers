#!/usr/bin/env node
// ============================================================
// Daily puzzle generator — docs/growth/03-daily-puzzle.md, Phase 1.
//
//   node scripts/generate-puzzles.js [--target-buffer 30] [--max-minutes 20]
//                                    [--seed N] [--dry-run] [--source self-play|games]
//                                    [--reverify 7] [--max-candidates N]
//
// Sources positions (bot self-play, or replayed Game rows), runs the
// selection criterion and the deep verification from the plan, classifies
// difficulty and theme, drafts commentary, assigns publish dates and writes
// Puzzle rows through server/db.js. Prints one summary line per puzzle and
// exits when the buffer is full or the time budget is spent.
//
// Never run this inside the socket server: a verification can take a minute
// of CPU. It is a separate process on purpose.
// ============================================================

import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { CheckersGame } from '../shared/game.js';
import { todayUtc, addDays, isoDate } from '../shared/puzzleDates.js';
export { todayUtc, addDays, isoDate };
import {
  fullMoves, scoreMoves, search, searchClone, fromPosition, toPosition, positionHash, mirror,
  evaluate, material, countPieces, serializeMove, applyFullMove, sameMove, moveKey,
  isWinScore, isLossScore, opponentOf
} from '../shared/puzzleSearch.js';
import { BOT_REGISTRY } from '../server/domain/botRegistry.js';
import { discoverableGames } from '../server/services/publicGames.js';
import { MIN_SOURCE_PLY, replayPuzzlePositions } from '../server/services/puzzleSources.js';
import { commitPuzzlePublication } from '../server/services/puzzlePublishing.js';
import { rejectedPuzzleHashes } from '../server/services/puzzleRejections.js';
import { puzzleBufferExitCode } from '../server/services/puzzleBuffer.js';
import { planDates } from '../shared/puzzleSchedule.js';
export { ROTATION, rotationFor, planDates } from '../shared/puzzleSchedule.js';
import {
  moveNotation, lineNotation, colorName, squareNumber, squaresOf, listSquares
} from '../shared/notation.js';
import { THEME_TEXT } from './lib/puzzleThemes.js';
export { THEME_TEXT };

export const GENERATOR_VERSION = '1.2.3';

// ---- Selection criterion (units are the engine's: man 1, king 5) ----
export const CRITERIA = Object.freeze({
  MIN_LEGAL: 3,          // fewer legal moves = forced or near-forced
  MIN_PIECES: 5,
  MIN_PLY: MIN_SOURCE_PLY,
  PRESCAN_DEPTH: 4,      // cheap filter before the real scan (see doc: cost, not the plan's criterion)
  PRESCAN_GAP: 1.0,
  PRESCAN_GAIN: 1.0,
  SCAN_DEPTH: 6,
  MIN_GAP: 1.5,          // uniqueness margin
  MIN_GAIN: 1.5,         // the move must achieve something
  MIN_BEST: -3,          // "least bad" moves make bad puzzles
  NEAR_EQUAL: 0.5,       // two moves this close = two solutions
  MIN_VERIFY_DEPTH: 8,   // verify at max(L + 2, 8)
  MAX_VERIFY_DEPTH: 12,  // nightly re-verify stops deepening here
  MAX_LINE_PLIES: 7,     // longer lines verify too slowly and read badly
  TIE_EPSILON: 0.05      // opponent replies within this are the same defence
});

export const BUDGETS = Object.freeze({
  prescan: 150_000,
  scan: 600_000,
  verify: 2_500_000,     // per decision point
  commentary: 200_000,
  selfPlay: { 2: 20_000, 4: 60_000, 6: 200_000 }
});

export const THEMES = Object.freeze(['immobilise', 'shot', 'breakthrough', 'king-trap', 'multi-jump', 'quiet-move']);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32) so `--seed` reproduces a run. */
export function makeRng(seed) {
  let s = (Number(seed) >>> 0) || 0x9e3779b9;
  return function rng() {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseArgs(argv) {
  const opts = {
    targetBuffer: 30,
    maxMinutes: 20,
    seed: null,
    dryRun: false,
    source: 'self-play',
    reverify: 0,
    maxCandidates: Infinity
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case '--target-buffer': opts.targetBuffer = Number(next()); break;
      case '--max-minutes': opts.maxMinutes = Number(next()); break;
      case '--seed': opts.seed = Number(next()); break;
      case '--dry-run': opts.dryRun = true; break;
      case '--source': opts.source = next(); break;
      case '--reverify': opts.reverify = Number(next()); break;
      case '--max-candidates': opts.maxCandidates = Number(next()); break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`Unknown argument ${a}`);
    }
  }
  if (!['self-play', 'games'].includes(opts.source)) throw new Error(`--source must be self-play or games`);
  if (!Number.isInteger(opts.targetBuffer) || opts.targetBuffer < 0 || opts.targetBuffer > 365) throw new Error('--target-buffer must be an integer from 0 to 365');
  if (!Number.isInteger(opts.reverify) || opts.reverify < 0 || opts.reverify > 365) throw new Error('--reverify must be an integer from 0 to 365');
  if (opts.seed !== null && !Number.isSafeInteger(opts.seed)) throw new Error('--seed must be a safe integer');
  if (opts.maxCandidates !== Infinity && (!Number.isInteger(opts.maxCandidates) || opts.maxCandidates < 1)) throw new Error('--max-candidates must be a positive integer');
  if (!Number.isFinite(opts.maxMinutes) || opts.maxMinutes <= 0 || opts.maxMinutes > 1440) throw new Error('--max-minutes must be > 0');
  if (opts.seed === null) opts.seed = (Date.now() % 2_147_483_647);
  return opts;
}

function playFullMove(game, move) {
  for (const h of move.hops) {
    if (!game.makeMove(h.fromRow, h.fromCol, h.toRow, h.toCol)) throw new Error('Illegal hop while replaying ' + moveKey(move));
  }
}

// ---------------------------------------------------------------------------
// Position sources
// ---------------------------------------------------------------------------

const PAIRINGS = [[2, 4], [4, 6], [2, 6]];

/**
 * Self-play generator: random first 6 plies, then the registry depths play
 * each other with the weaker side making a random move 15% of the time.
 * Yields every position (a clockless snapshot) from ply 8 on.
 */
export function* selfPlayPositions(rng, { maxPlies = 160 } = {}) {
  const depths = Object.values(BOT_REGISTRY).map(b => b.depth);
  let gameIndex = 0;
  for (;;) {
    const pairing = PAIRINGS[gameIndex % PAIRINGS.length];
    const redDepth = rng() < 0.5 ? pairing[0] : pairing[1];
    const blackDepth = redDepth === pairing[0] ? pairing[1] : pairing[0];
    const weaker = redDepth < blackDepth ? 'red' : 'black';
    if (!depths.includes(redDepth) || !depths.includes(blackDepth)) throw new Error('Pairing outside the registry');
    const game = searchClone(null);
    // Start from the real opening position.
    const fresh = new CheckersGame(0);
    game.board = fresh.board;
    game.currentPlayer = 'red';
    const label = `self-play #${gameIndex + 1} ${colorName('red')} d${redDepth} v ${colorName('black')} d${blackDepth}`;
    let ply = 0;
    while (!game.gameOver && ply < maxPlies) {
      if (ply >= CRITERIA.MIN_PLY) {
        yield { game: searchClone(game), ply, source: 'self-play', sourceGameId: null, label };
      }
      const moves = fullMoves(game);
      if (moves.length === 0) break;
      let move;
      const depth = game.currentPlayer === 'red' ? redDepth : blackDepth;
      const randomTurn = ply < 6 || (game.currentPlayer === weaker && rng() < 0.15);
      if (randomTurn || moves.length === 1) {
        move = moves[Math.floor(rng() * moves.length)];
      } else {
        move = pickBotMove(game, depth, rng);
      }
      playFullMove(game, move);
      ply++;
    }
    gameIndex++;
  }
}

function pickBotMove(game, depth, rng) {
  const { scored } = scoreMoves(game, { depth: depth - 1, gapWindow: 0.01, nodeBudget: BUDGETS.selfPlay[depth] || 100_000 });
  const best = scored[0].score;
  const ties = scored.filter(s => s.exact && best - s.score <= 0.001);
  return ties[Math.floor(rng() * ties.length)].move;
}

/** Use the same public discovery and replay validation as source attribution. */
export async function* gamePositions(prisma, options) {
  for await (const row of discoverableGames(prisma, options)) {
    for (const { position, ply } of replayPuzzlePositions(row)) {
      yield { game: fromPosition(position), ply, source: 'games', sourceGameId: row.id, label: `game #${row.id}` };
    }
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/** Stop at the first concrete gain after the forced captures have settled. */
export function trimLine(pv, game) {
  const side = game.currentPlayer, baseline = material(game, side);
  for (let i = 0; i < pv.length; i += 2) {
    const move = pv[i], end = move.after;
    if (end.gameOver && end.winner === side) return pv.slice(0, i + 1);
    if (end.gameOver || (!move.captured.length && !move.promoted)) continue;
    if (material(end, side) > baseline && !end.getAllValidMoves().some(m => m.captured.length)) return pv.slice(0, i + 1);
  }
  return null;
}

/**
 * The plan's candidate(P, S). Returns null with a reason on rejection, else
 * the scan result with the trimmed line.
 */
export function candidate(game, ply, { onReject } = {}) {
  const reject = reason => { if (onReject) onReject(reason); return null; };
  if (game.gameOver || game.chainPiece) return reject('over');
  const side = game.currentPlayer;
  const legal = fullMoves(game);
  if (legal.length < CRITERIA.MIN_LEGAL) return reject('forced');
  if (countPieces(game) < CRITERIA.MIN_PIECES) return reject('pieces');
  if (ply < CRITERIA.MIN_PLY) return reject('ply');
  const baseline = evaluate(game, side);

  // Cheap filter: a shot that is invisible at depth 4 with quiescence is rare, and the
  // depth-6 scan is ten times the cost. Thresholds are looser than the real criterion.
  const pre = scoreMoves(game, { depth: CRITERIA.PRESCAN_DEPTH, gapWindow: CRITERIA.PRESCAN_GAP, nodeBudget: BUDGETS.prescan });
  if (!pre.complete) return reject('prescan-budget');
  if (pre.scored[0].score - pre.scored[1].score < CRITERIA.PRESCAN_GAP) return reject('prescan-gap');
  if (pre.scored[0].score - baseline < CRITERIA.PRESCAN_GAIN) return reject('prescan-gain');

  const scan = scoreMoves(game, { depth: CRITERIA.SCAN_DEPTH, gapWindow: CRITERIA.MIN_GAP, nodeBudget: BUDGETS.scan });
  if (!scan.complete) return reject('scan-budget');
  const [best, second] = scan.scored;
  const gap = best.score - second.score;
  const gain = best.score - baseline;
  if (gap < CRITERIA.MIN_GAP) return reject('gap');
  if (gain < CRITERIA.MIN_GAIN) return reject('gain');
  if (best.score < CRITERIA.MIN_BEST) return reject('best');
  if (isWinScore(second.score)) return reject('two-wins');
  const line = trimLine([best.move, ...best.pv], game);
  if (!line) return reject('no-line');
  if (line.length > CRITERIA.MAX_LINE_PLIES) return reject('long');
  return { game, side, ply, line, gap, gain, legal: legal.length, baseline, scanScore: best.score };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Check a fixed line from `game` at `depth` (the depth searched after each
 * candidate move at every decision point). Every player move must be the
 * unique best by MIN_GAP with no alternative within NEAR_EQUAL; every
 * opponent reply must be that side's best defence and must leave the player's
 * score at or above baseline + MIN_GAIN.
 *
 * @returns {{ ok, reason, conclusive, score, rootScores, nodes }}
 *   `conclusive` is false when a failure or pass could not be established
 *   inside the node budget.
 */
export function verifyLine(game, line, depth, { budget = BUDGETS.verify, rootScores = null } = {}) {
  if (!Array.isArray(line) || !line.length || line.length % 2 === 0) return { ok: false, reason: 'invalid-line-length', conclusive: true, nodes: 0 };
  const side = game.currentPlayer;
  const baseline = evaluate(game, side);
  const threshold = baseline + CRITERIA.MIN_GAIN;
  let position = searchClone(game);
  let nodes = 0;
  let rootScored = null;
  let rootScore = null;
  let lastMove;

  for (let i = 0; i < line.length; i++) {
    const expected = line[i];
    const playerToMove = i % 2 === 0;
    if (position.currentPlayer !== (playerToMove ? side : opponentOf(side))) {
      return { ok: false, reason: 'line-out-of-turn', conclusive: true, nodes };
    }
    let res;
    if (i === 0 && rootScores) res = rootScores;
    else res = scoreMoves(position, {
      depth, ply: i, nodeBudget: budget,
      color: position.currentPlayer,
      gapWindow: playerToMove ? CRITERIA.MIN_GAP : CRITERIA.TIE_EPSILON
    });
    nodes += res.nodes;
    if (!res.complete) return { ok: false, reason: 'budget', conclusive: false, nodes, rootScores: rootScored };
    const scored = res.scored; // best-first from the mover's view
    const idx = scored.findIndex(s => sameMove(s.move, expected));
    if (idx < 0) return { ok: false, reason: 'illegal-line-move', conclusive: true, nodes };

    if (playerToMove) {
      if (idx !== 0) return { ok: false, reason: `not-best@${i}`, conclusive: true, nodes };
      const best = scored[0];
      if (i === 0) {
        rootScored = scored;
        rootScore = best.score;
        if (best.score < CRITERIA.MIN_BEST) return { ok: false, reason: 'best', conclusive: true, nodes, rootScores: scored };
        if (best.score - baseline < CRITERIA.MIN_GAIN) return { ok: false, reason: 'gain', conclusive: true, nodes, rootScores: scored };
      } else if (best.score < threshold) {
        return { ok: false, reason: `below-threshold@${i}`, conclusive: true, nodes, rootScores: rootScored };
      }
      if (scored.length > 1) {
        const second = scored[1];
        if (isWinScore(second.score)) return { ok: false, reason: `two-wins@${i}`, conclusive: true, nodes, rootScores: rootScored };
        if (best.score - second.score < CRITERIA.MIN_GAP) return { ok: false, reason: `gap@${i}`, conclusive: true, nodes, rootScores: rootScored };
        if (scored.some((s, k) => k > 0 && best.score - s.score < CRITERIA.NEAR_EQUAL)) {
          return { ok: false, reason: `near-equal@${i}`, conclusive: true, nodes, rootScores: rootScored };
        }
      }
    } else {
      // Opponent: the line's reply must be a best defence; even so the player keeps the gain.
      const bestDefence = scored[0];
      const lineReply = scored[idx];
      if (!lineReply.exact || bestDefence.score - lineReply.score > CRITERIA.TIE_EPSILON) {
        return { ok: false, reason: `not-best-defence@${i}`, conclusive: true, nodes, rootScores: rootScored };
      }
      const playerScore = -bestDefence.score;
      if (playerScore < threshold) return { ok: false, reason: `cooked@${i}`, conclusive: true, nodes, rootScores: rootScored };
    }
    // Advance through the freshly generated legal move, never a caller's cached after-state.
    lastMove = scored[idx].move;
    position = lastMove.after;
    if (!position) return { ok: false, reason: 'illegal-line-move', conclusive: true, nodes };
  }
  const won = position.gameOver && position.winner === side;
  if (!won && (position.gameOver || (!lastMove.captured.length && !lastMove.promoted)
    || material(position, side) <= material(game, side) || position.getAllValidMoves().some(m => m.captured.length))) {
    return { ok: false, reason: 'unrealised-line', conclusive: true, nodes };
  }
  return { ok: true, reason: null, conclusive: true, score: rootScore, rootScores: rootScored, nodes };
}

/**
 * The plan's verify(candidate): deep root scoring at max(L + 2, 8), the
 * line rebuilt from the deep principal variation, then verifyLine over every
 * decision point. Returns null on rejection.
 */
export function verifyCandidate(cand, { onReject } = {}) {
  const reject = reason => { if (onReject) onReject(reason); return null; };
  const { game, side } = cand;
  let line = cand.line;
  let depth = Math.max(line.length + 2, CRITERIA.MIN_VERIFY_DEPTH);
  let root = null;
  let nodes = 0;

  for (let round = 0; round < 2; round++) {
    root = scoreMoves(game, { depth, gapWindow: CRITERIA.MIN_GAP, nodeBudget: BUDGETS.verify });
    nodes += root.nodes;
    if (!root.complete) return reject('verify-budget');
    const best = root.scored[0];
    if (!sameMove(best.move, line[0])) return reject('changed');
    const deepLine = trimLine([best.move, ...best.pv], game);
    if (!deepLine) return reject('no-line');
    if (deepLine.length > CRITERIA.MAX_LINE_PLIES) return reject('long');
    line = deepLine;
    const needed = Math.max(line.length + 2, CRITERIA.MIN_VERIFY_DEPTH);
    if (needed <= depth) break;
    depth = needed;
    root = null;
  }
  if (!root) return reject('unstable');

  const check = verifyLine(game, line, depth, { rootScores: root });
  nodes += check.nodes;
  if (!check.ok) return reject(check.reason);
  const gap = root.scored[0].score - (root.scored[1] ? root.scored[1].score : Infinity);
  return {
    ...cand,
    line,
    verifiedDepth: depth,
    score: check.score,
    gap: Number.isFinite(gap) ? gap : cand.gap,
    gain: check.score - cand.baseline,
    rootScores: root.scored,
    nodes
  };
}

// ---------------------------------------------------------------------------
// Classification: difficulty, themes, commentary
// ---------------------------------------------------------------------------

export function classify(verified) {
  const { game, side, line, legal } = verified;
  const first = line[0];
  const playerMoves = line.filter((_, i) => i % 2 === 0);
  const quietFirst = first.captured.length === 0;
  const matRoot = material(game, side);
  const afterReply = line.length > 1 ? material(line[1].after, side) : matRoot;
  const sacrifice = line.length > 1 && afterReply - matRoot <= -1;
  const promotes = playerMoves.some(m => m.promoted);
  const capturesKing = playerMoves.some(m => m.captured.some(c => c.queen));
  const end = line[line.length - 1].after;
  const opponentLeft = end ? countPieces(end) - countPiecesOf(end, side) : 0;
  const immobilises = !!(end && end.gameOver && end.winner === side && opponentLeft > 0);
  const wipesOut = !!(end && end.gameOver && end.winner === side && opponentLeft === 0);

  let level = Math.min(3, playerMoves.length);
  if (quietFirst) level++;
  if (sacrifice) level++;
  if (legal <= 3) level--;
  level = Math.max(1, Math.min(3, level));
  const difficulty = level === 1 ? 'EASY' : level === 2 ? 'MEDIUM' : 'HARD';

  const tags = [];
  if (immobilises) tags.push('immobilise');
  if (sacrifice) tags.push('shot');
  if (promotes) tags.push('breakthrough');
  if (capturesKing) tags.push('king-trap');
  if (first.hops.length >= 2) tags.push('multi-jump');
  if (quietFirst) tags.push('quiet-move');
  if (tags.length === 0 && playerMoves.some(m => m.hops.length >= 2)) tags.push('multi-jump');
  const ordered = THEMES.filter(t => tags.includes(t));
  if (ordered.length === 0) return null; // nothing to explain; skip rather than publish a themeless page

  // Legibility for the first 30 puzzles: single-move multi-jumps and captures that crown.
  const legibility = (line.length === 1 ? 2 : 0) + (first.hops.length >= 2 ? 1 : 0) + (first.promoted ? 1 : 0);

  return {
    difficulty,
    theme: ordered[0],
    themes: ordered.slice(1),
    flags: { quietFirst, sacrifice, promotes, capturesKing, immobilises, wipesOut, playerMoves: playerMoves.length },
    legibility
  };
}

function countPiecesOf(game, color) {
  let n = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (game.board[r][c] && game.board[r][c].color === color) n++;
  return n;
}

function pieceCounts(game, color) {
  let men = 0, kings = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (!p || p.color !== color) continue;
      if (p.queen) kings++; else men++;
    }
  return { men, kings, total: men + kings };
}

function men(n) {
  return n === 1 ? 'a man' : `${n} men`;
}

function kings(n) {
  return n === 1 ? 'a king' : `${n} kings`;
}

function describeForce(counts) {
  if (counts.total === 0) return 'nothing';
  const parts = [];
  if (counts.men) parts.push(men(counts.men));
  if (counts.kings) parts.push(kings(counts.kings));
  return parts.join(' and ');
}

function describeBalance(game, side) {
  const mine = pieceCounts(game, side);
  const theirs = pieceCounts(game, opponentOf(side));
  const me = colorName(side), them = colorName(opponentOf(side));
  const differences = [['men', 'man'], ['kings', 'king']].flatMap(([plural, singular]) => {
    const difference = mine[plural] - theirs[plural], amount = Math.abs(difference);
    return difference ? [`${amount} ${difference > 0 ? 'more' : 'fewer'} ${amount === 1 ? singular : plural}`] : [];
  });
  return differences.length ? `${me} has ${differences.join(' and ')} than ${them}.` : 'Both sides have the same number of men and kings.';
}

function describePressure(game, side) {
  // Men past the middle of the board, from each side's view.
  let mineAdvanced = 0, theirsAdvanced = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (!p || p.queen) continue;
      const advanced = p.color === 'red' ? r <= 3 : r >= 4;
      if (!advanced) continue;
      if (p.color === side) mineAdvanced++; else theirsAdvanced++;
    }
  const me = colorName(side), them = colorName(opponentOf(side));
  if (mineAdvanced === 0 && theirsAdvanced === 0) return `Neither side has crossed the middle of the board yet.`;
  if (mineAdvanced > theirsAdvanced) return `${me} has ${men(mineAdvanced)} in ${them}'s half of the board against ${theirsAdvanced} coming the other way.`;
  if (theirsAdvanced > mineAdvanced) return `${them} has ${men(theirsAdvanced)} in ${me}'s half against ${mineAdvanced} coming the other way.`;
  return `Both sides have ${mineAdvanced === 1 ? 'a man' : `${mineAdvanced} men`} across the middle.`;
}

export function positionSummary(game, side) {
  const me = colorName(side), them = colorName(opponentOf(side));
  const mine = pieceCounts(game, side), theirs = pieceCounts(game, opponentOf(side));
  const mineSquares = squaresOf(game.board, side);
  const theirSquares = squaresOf(game.board, opponentOf(side));
  const mineKings = squaresOf(game.board, side, { kings: true });
  const theirKings = squaresOf(game.board, opponentOf(side), { kings: true });
  const sentences = [];
  sentences.push(`${me} to move. ${me} has ${describeForce(mine)} on ${listSquares(mineSquares)}${mineKings.length ? ` (king${mineKings.length > 1 ? 's' : ''} on ${listSquares(mineKings)})` : ''}; ${them} has ${describeForce(theirs)} on ${listSquares(theirSquares)}${theirKings.length ? ` (king${theirKings.length > 1 ? 's' : ''} on ${listSquares(theirKings)})` : ''}.`);
  sentences.push(describeBalance(game, side));
  sentences.push(describePressure(game, side));
  const choices = fullMoves(game), captures = choices.filter(move => move.captured.length).length;
  sentences.push(`${me} has ${choices.length} legal full turns to compare: ${captures} capture lines and ${choices.length - captures} quiet choices. A capture chain is one turn, even when the piece changes direction. Look at its final landing square before committing to the first jump.`);
  return sentences.join(' ');
}

function capturedPhrase(captured) {
  const men = captured.filter(c => !c.queen).map(c => squareNumber(c.row, c.col));
  const kings = captured.filter(c => c.queen).map(c => squareNumber(c.row, c.col));
  const parts = [];
  if (men.length) parts.push(`the ${men.length === 1 ? 'man' : 'men'} on ${listSquares(men)}`);
  if (kings.length) parts.push(`the ${kings.length === 1 ? 'king' : 'kings'} on ${listSquares(kings)}`);
  return parts.join(' and ');
}

/** Describe the board actually reached, without turning search scores into piece counts. */
export function outcomePhrase(verified, flags) {
  const { side, line } = verified;
  const me = colorName(side), them = colorName(opponentOf(side));
  if (flags.wipesOut) return me + ' wins the game: ' + them + ' has nothing left on the board.';
  if (flags.immobilises) return me + ' wins the game: ' + them + ' has pieces left but no legal move.';
  const end = line.at(-1).after;
  const mine = pieceCounts(end, side), theirs = pieceCounts(end, opponentOf(side));
  return 'After this combination, ' + me + ' has ' + describeForce(mine) + ' and ' + them + ' has ' + describeForce(theirs) + '. The game continues from this position.';
}

export function solutionNarration(verified, flags) {
  const { side, line, game } = verified;
  const me = colorName(side), them = colorName(opponentOf(side));
  const parts = [];
  let position = game;
  for (let i = 0; i < line.length; i++) {
    const m = line[i];
    const mover = i % 2 === 0 ? me : them;
    const legalHere = fullMoves(position);
    const forced = legalHere.length === 1;
    const capture = m.captured.length > 0;
    let s;
    if (i % 2 === 0) {
      if (capture) {
        s = `${mover} ${m.hops.length > 1 ? 'jumps' : 'takes'} ${moveNotation(m)}, removing ${capturedPhrase(m.captured)}`;
        if (m.promoted) s += ' and crowning on ' + squareNumber(m.toRow, m.toCol);
      } else {
        const next = line[i + 1];
        const offered = next && next.captured.some(c => c.row === m.toRow && c.col === m.toCol);
        s = `${mover} plays ${moveNotation(m)}`;
        if (m.promoted) s += `, crowning on ${squareNumber(m.toRow, m.toCol)}`;
        if (offered) s += `, offering the ${m.after.board[m.toRow][m.toCol].queen ? 'king' : 'man'} on ${squareNumber(m.toRow, m.toCol)}`;
      }
    } else {
      if (capture) {
        s = `${mover} ${forced ? 'must take' : 'has to capture, and the best try is'} ${moveNotation(m)}`;
        if (m.promoted) s += `, crowning on ${squareNumber(m.toRow, m.toCol)}`;
      } else {
        s = `${mover}'s best reply is ${moveNotation(m)}`;
      }
    }
    parts.push(s + '.');
    position = m.after;
  }
  parts.push(outcomePhrase(verified, flags));
  if (verified.continuation && verified.continuation.length > 0) {
    parts.push(`One continuation from the search is ${lineNotation(verified.continuation)}.`);
  }
  return `Solution: ${lineNotation(line)}. ` + parts.join(' ');
}

export function alternativesNarration(verified, commentaryScores) {
  const { side, line, game } = verified;
  const alts = commentaryScores.filter(s => s.complete && s.exact && !sameMove(s.move, line[0])).slice(0, 2);
  if (alts.length === 0) return 'No alternative continuation is shown here. Explore the other legal choices on the board and compare their captures and landing squares with the solution.';
  const bits = alts.map(alt => {
    let position = game;
    const events = [], moves = [];
    for (const expected of [alt.move, ...(alt.pv || []).slice(0, 2)]) {
      // Reconstruct facts from legal turns, not cached capture lists or after-states.
      const move = fullMoves(position).find(candidate => sameMove(candidate, expected));
      if (!move) throw new Error('Illegal commentary continuation');
      const mover = colorName(position.currentPlayer);
      if (move.captured.length) events.push(`${mover}'s ${moveNotation(move)} removes ${capturedPhrase(move.captured)}.`);
      if (move.promoted) events.push(`${mover} crowns on ${squareNumber(move.toRow, move.toCol)}.`);
      moves.push(move);
      position = move.after;
    }
    const mine = describeForce(pieceCounts(position, side));
    const theirs = describeForce(pieceCounts(position, opponentOf(side)));
    let outcome = `The board then has ${mine} for ${colorName(side)} and ${theirs} for ${colorName(opponentOf(side))}.`;
    if (position.gameOver) outcome += position.winner
      ? ` ${colorName(position.winner)} wins: ${countPiecesOf(position, opponentOf(position.winner)) ? 'the opponent has no legal turn' : 'the opponent has no pieces left'}.`
      : ' The game is drawn.';
    return `Alternative ${moveNotation(moves[0])}: one sample line is ${lineNotation(moves)}. ${events.join(' ')} ${outcome}`.replaceAll('  ', ' ');
  });
  return bits.join(' ') + ' Compare these sample lines with the solution and check other legal replies before judging the resulting position.';
}

export function buildCommentary(verified, classification) {
  const commentaryScan = scoreMoves(verified.game, { depth: 5, nodeBudget: BUDGETS.commentary });
  return {
    theme: THEME_TEXT[classification.theme],
    position: positionSummary(verified.game, verified.side),
    solution: solutionNarration(verified, classification.flags),
    alternatives: alternativesNarration(verified, commentaryScan.scored)
  };
}

/** Assemble a Puzzle row (without date) from a verified candidate. */
export function buildPuzzle(verified, classification, { sourceGameId = null } = {}) {
  const position = toPosition(verified.game);
  return {
    positionHash: positionHash(verified.game),
    position,
    solution: verified.line.map(serializeMove),
    sideToMove: verified.side,
    difficulty: classification.difficulty,
    theme: classification.theme,
    themes: classification.themes,
    solutionPlies: verified.line.length,
    legalMoves: verified.legal,
    scoreGap: round2(verified.gap),
    verifiedDepth: verified.verifiedDepth,
    commentary: buildCommentary(verified, classification),
    sourceGameId,
    generatorVersion: GENERATOR_VERSION,
    _meta: { legibility: classification.legibility, gain: verified.gain, score: verified.score, ply: verified.ply, label: verified.label }
  };
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Run selection, verification and classification for one sourced position.
 * Returns a puzzle row (without date) or null. `existing` is a Set of hashes.
 */
export function processPosition(pos, existing, stats) {
  const cand = candidate(pos.game, pos.ply, { onReject: r => count(stats.rejects, r) });
  if (!cand) return null;
  stats.candidates++;
  const hash = positionHash(cand.game);
  const mirrored = positionHash(mirror(cand.game));
  if (existing.has(hash) || existing.has(mirrored)) { count(stats.rejects, 'duplicate'); return null; }
  const verified = verifyCandidate(cand, { onReject: r => count(stats.rejects, 'verify:' + r) });
  if (!verified) return null;
  stats.verifyNodes += verified.nodes;
  verified.label = pos.label;
  // rootScores[0].pv is the variation after the first move; the line covers its first L-1 entries.
  const rootBest = verified.rootScores[0];
  verified.continuation = rootBest.pv.slice(verified.line.length - 1);
  const classification = classify(verified);
  if (!classification) { count(stats.rejects, 'theme'); return null; }
  stats.verified++;
  return buildPuzzle(verified, classification, { sourceGameId: pos.sourceGameId });
}

function count(map, key) {
  map[key] = (map[key] || 0) + 1;
}

const DIFFICULTY_ORDER = ['EASY', 'MEDIUM', 'HARD'];

function difficultyDistance(a, b) {
  return Math.abs(DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b));
}

/** Pick the pool entry for a slot: exact difficulty first, then legibility while the archive is small. */
function pickForSlot(pool, slot, { preferLegible, allowNearest }) {
  let best = -1, bestKey = null;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    const dist = difficultyDistance(p.difficulty, slot.difficulty);
    if (dist > 0 && !allowNearest) continue;
    const key = [dist, preferLegible ? -p._meta.legibility : 0, i];
    if (bestKey === null || compareKeys(key, bestKey) < 0) { best = i; bestKey = key; }
  }
  return best;
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function summaryLine(row, date, { dryRun, note } = {}) {
  const meta = row._meta || {};
  const tags = [row.theme, ...(row.themes || [])].join('+');
  return `${dryRun ? '[dry-run] would write' : '[write]'} ${isoDate(date)} ${row.difficulty.padEnd(6)} ${tags.padEnd(24)} ` +
    `${row.sideToMove.padEnd(5)} ${lineNotation(row.solution).padEnd(28)} gap ${row.scoreGap.toFixed(2)} ` +
    `gain ${(meta.gain ?? 0).toFixed(2)} legal ${row.legalMoves} plies ${row.solutionPlies} depth ${row.verifiedDepth}` +
    (meta.label ? ` (${meta.label} ply ${meta.ply})` : '') + (note ? ` ${note}` : '');
}

/**
 * Prepare a buffer top-up without writing rows. Resolves with proposals/statistics.
 *
 * opts: { prisma, targetBuffer, maxMinutes, seed, dryRun, source, maxCandidates, log, now }
 */
export async function runGenerator(opts) {
  const {
    prisma, targetBuffer = 30, maxMinutes = 20, seed = 1, dryRun = false, source = 'self-play',
    maxCandidates = Infinity, log = console.log, now = new Date(), vacatedIds = new Set()
  } = opts;
  const started = Date.now();
  const deadline = started + maxMinutes * 60_000;
  const today = todayUtc(now);
  const stats = {
    positions: 0, candidates: 0, verified: 0, proposed: 0, rejects: {}, verifyNodes: 0,
    puzzles: [], candidatesFound: [], substitutions: 0, elapsedMs: 0
  };

  const existingRows = await prisma.puzzle.findMany({ select: { id: true, positionHash: true, date: true } });
  const existing = new Set([...existingRows.map(r => r.positionHash), ...await rejectedPuzzleHashes(prisma)]);
  const latest = existingRows.reduce((m, r) => (m === null || r.date > m ? r.date : m), null);
  // Retain failed hashes while planning their vacated dates, so this run cannot
  // immediately reintroduce the same position at a shallower verification depth.
  const slots = planDates({ existingDates: existingRows.filter(r => !vacatedIds.has(r.id)).map(r => r.date), today, targetBuffer });
  const archiveSize = existingRows.length;
  stats.remaining = slots.length;
  log(`[puzzles] ${existingRows.length} existing, latest ${latest ? isoDate(latest) : 'none'}, today ${isoDate(today)}, ` +
    `${slots.length} date(s) to fill through ${isoDate(addDays(today, targetBuffer))}, source ${source}, seed ${seed}` +
    `${dryRun ? ', dry run' : ''}`);
  if (slots.length === 0) {
    stats.elapsedMs = Date.now() - started;
    return stats;
  }

  const rng = makeRng(seed);
  const positions = source === 'games' ? gamePositions(prisma) : selfPlayPositions(rng);
  const pool = [];
  let slotIndex = 0;

  const flush = async ({ allowNearest }) => {
    while (slotIndex < slots.length && pool.length > 0) {
      const slot = slots[slotIndex];
      const i = pickForSlot(pool, slot, { preferLegible: archiveSize + stats.proposed < 30, allowNearest });
      if (i < 0) break;
      const row = pool.splice(i, 1)[0];
      const substituted = row.difficulty !== slot.difficulty;
      if (substituted) stats.substitutions++;
      stats.proposed++;
      stats.puzzles.push({ ...row, date: slot.date });
      log(summaryLine(row, slot.date, { dryRun: true, note: substituted ? `(slot wanted ${slot.difficulty})` : '' }));
      slotIndex++;
    }
  };

  for await (const pos of positions) {
    if (Date.now() >= deadline) { log('[puzzles] time budget spent'); break; }
    if (slotIndex >= slots.length) break;
    if (stats.candidatesFound.length >= maxCandidates) break;
    stats.positions++;
    const row = processPosition(pos, existing, stats);
    if (!row) continue;
    existing.add(row.positionHash);
    stats.candidatesFound.push(row);
    pool.push(row);
    await flush({ allowNearest: false });
  }
  // Out of time or positions: place what is left, nearest difficulty first.
  await flush({ allowNearest: true });

  stats.remaining = slots.length - slotIndex;
  stats.elapsedMs = Date.now() - started;
  const secs = stats.elapsedMs / 1000;
  const nodesPerSec = secs > 0 ? Math.round(stats.verifyNodes / secs) : 0;
  log(`[puzzles] prepared: ${stats.proposed} proposed (${stats.substitutions} off-rotation), ${stats.verified} verified of ` +
    `${stats.candidates} candidates from ${stats.positions} positions in ${secs.toFixed(0)} s; ` +
    `${(stats.verifyNodes / 1e6).toFixed(1)}M verification nodes (~${Math.round(nodesPerSec / 1000)}k nodes/s of wall time); ` +
    `buffer ${slotIndex >= slots.length ? 'full' : `short by ${slots.length - slotIndex} day(s)`}`);
  const rejects = Object.entries(stats.rejects).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
  if (rejects) log(`[puzzles] rejections: ${rejects}`);
  return stats;
}

// ---------------------------------------------------------------------------
// Nightly re-verification
// ---------------------------------------------------------------------------

/**
 * Prepare evidence for the next `days` unpublished puzzles at verifiedDepth + 2
 * (capped). This function never mutates rows. The commit rechecks publication
 * time and the observed record before applying any proposed change.
 */
export async function reverifyUpcoming({ prisma, days = 7, log = console.log, now = new Date(), verify = verifyLine }) {
  const today = todayUtc(now);
  const from = addDays(today, 1);
  const to = addDays(today, days);
  const rows = await prisma.puzzle.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: 'asc' }
  });
  const result = { checked: 0, proposedDeletions: 0, proposedDeepenings: 0, inconclusive: 0, failures: [], changes: [] };
  for (const row of rows) {
    const game = fromPosition(row.position);
    const line = row.solution;
    const depth = Math.min(row.verifiedDepth + 2, CRITERIA.MAX_VERIFY_DEPTH);
    const t0 = Date.now();
    const check = verify(game, line, depth);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    result.checked++;
    if (check.ok) {
      if (depth > row.verifiedDepth) { result.changes.push({ row, depth }); result.proposedDeepenings++; }
      log(`[reverify] ${isoDate(row.date)} ok at depth ${depth} (${secs} s)`);
      continue;
    }
    if (!check.conclusive) {
      result.inconclusive++;
      log(`[reverify] ${isoDate(row.date)} inconclusive at depth ${depth} (${check.reason}, ${secs} s); kept`);
      continue;
    }
    result.failures.push({ id: row.id, date: row.date, reason: check.reason });
    log(`[reverify] ${isoDate(row.date)} FAILED at depth ${depth}: ${check.reason} (${secs} s); proposed removal if still unpublished at commit`);
    result.changes.push({ row, remove: true, depth, reason: check.reason, verifierVersion: GENERATOR_VERSION });
    result.proposedDeletions++;
  }
  log(`[reverify] ${result.checked} checked, ${result.proposedDeletions} proposed deletions, ${result.proposedDeepenings} proposed deepenings, ${result.inconclusive} inconclusive`);
  return result;
}

// CPU work happens before the bounded transaction. Competing preparations are
// harmless: the shared commit rechecks ownership, evidence, dates and symmetry.
export async function runPublishingJob({ prisma, ...options }) {
  const reverification = options.reverify > 0 ? await reverifyUpcoming({ prisma, days: options.reverify, log: options.log }) : null;
  const changes = reverification?.changes ?? [];
  const generated = options.targetBuffer > 0 ? await runGenerator({ prisma, ...options,
    vacatedIds: new Set(changes.filter(change => change.remove).map(change => change.row.id)) }) : { remaining: 0, proposed: 0, puzzles: [] };
  const { changes: _, ...report } = reverification ?? {};
  if (options.dryRun) return { ...generated, written: 0, reverification: reverification ? report : null };
  const committed = await commitPuzzlePublication(prisma, { changes, puzzles: generated.puzzles, targetBuffer: options.targetBuffer ?? 30 });
  if (committed.busy) return committed;
  (options.log ?? console.log)(`[puzzles] committed ${committed.written} puzzles; ${committed.remaining} missing dates, ${committed.protectedFailures.length} protected failures`);
  return { ...generated, ...committed, reverification: reverification ? { ...report, deleted: committed.deleted, deepened: committed.deepened } : null };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  return [
    'Usage: node scripts/generate-puzzles.js [options]',
    '  --target-buffer N   fill every missing date through today + N (default 30; 0 skips generation)',
    '  --max-minutes N     stop sourcing new positions after N minutes (default 20)',
    '  --seed N            PRNG seed for self-play (default: time based)',
    '  --dry-run           search and print, write nothing',
    '  --source S          self-play (default) or games (replay Game.moveHistory rows)',
    '  --reverify N        re-check the next N unpublished days at verifiedDepth + 2 first',
    '  --max-candidates N  stop after N verified candidates (tests)'
  ].join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    console.error(usage());
    return 2;
  }
  if (opts.help) { console.log(usage()); return 0; }
  const { default: prisma } = await import('../server/db.js');
  try {
    const result = await runPublishingJob({ prisma, ...opts });
    if (result.busy) { console.error('Another puzzle publishing run holds the lock'); return 4; }
    if (result.protectedFailures?.length) return 5;
    if (result.buffer) return puzzleBufferExitCode(result.buffer);
    return result.remaining > 0 ? 3 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().then(code => { process.exitCode = code; }, err => { console.error(err); process.exitCode = 1; });
}
