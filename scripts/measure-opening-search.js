import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { CheckersGame } from '../shared/game.js';
import { scoreBotMoves } from '../shared/botSearch.js';
import { moveNotation } from '../shared/notation.js';

// A repeatable editorial experiment, deliberately independent of wall-clock
// speed. Live games keep their real time limit; this never changes that policy.
const settings = { depth: 6, nodeBudget: 150000 };
const rows = [];
function measure(game, depth = settings.depth) {
  const result = scoreBotMoves(game, { ...settings, depth, timeMs: Infinity, now: () => 0 });
  const best = Math.max(...result.scores.map(s => s.score));
  return { completedDepth: result.completedDepth, nodes: result.nodes,
    bestReplies: result.scores.filter(s => s.score === best).map(s => moveNotation(s.move)),
    scores: result.scores.map(s => ({ move: moveNotation(s.move), score: s.score })) };
}
let levelComparison;
for (const opening of new CheckersGame(0).getAllValidMoves()) {
  const game = new CheckersGame(0);
  game.makeMove(opening.fromRow, opening.fromCol, opening.toRow, opening.toCol);
  const openingName = moveNotation(opening);
  rows.push({ opening: openingName, ...measure(game) });
  if (openingName === '11-15') levelComparison = {
    opening: openingName, levels: [2, 4, 6].map(depth => ({ requestedDepth: depth, ...measure(game, depth) }))
  };
}
const sourceHashes = {};
for (const file of ['shared/game.js', 'shared/botSearch.js', 'shared/constants.js']) {
  sourceHashes[file] = createHash('sha256').update(await readFile(new URL('../' + file, import.meta.url))).digest('hex');
}
const report = { generatedAt: new Date().toISOString(), method: 'Complete iterative search passes; wall clock disabled for repeatability; all tied best replies recorded without random selection.',
  settings, sourceHashes, rows, levelComparison };
const dir = new URL('../src/static/research/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('opening-search.json', dir), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ scores, ...summary }) => summary), null, 2));
