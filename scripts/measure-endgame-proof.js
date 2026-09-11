import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gameFromPosition, moveNotation, parseMove } from '../src/lib/content/position.js';

// A small, bounded proof for one editorial position. A failed search means
// "not proved within this bound", never "draw". Live bots do not use this.
const position = '.B....../......../......../..R.R.../......../......../......../........';
const firstMove = '18-5';
const maxHopsAfterFirst = 6;
let nodes = 0;
function prove(game, remaining) {
  if (++nodes > 50000) throw new Error('Editorial proof exceeded its node budget');
  if (game.gameOver) return game.winner === 'red' ? { win: true } : null;
  if (!remaining) return null;
  const replies = [];
  for (const move of game.getAllValidMoves()) {
    const next = game.clone();
    if (!next.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol)) throw new Error('Illegal generated move');
    const proof = prove(next, remaining - 1);
    if (game.currentPlayer === 'red') {
      if (proof) return { move: moveNotation(move), next: proof };
    } else {
      if (!proof) return null;
      replies.push({ move: moveNotation(move), next: proof });
    }
  }
  return game.currentPlayer === 'black' && replies.length ? { allReplies: replies } : null;
}
const game = gameFromPosition(position);
const first = parseMove(firstMove)[0];
if (!game.makeMove(first.fromRow, first.fromCol, first.toRow, first.toCol)) throw new Error('Illegal first move');
const tree = prove(game, maxHopsAfterFirst);
if (!tree) throw new Error('No forced win was established within the bound');
const sourceHashes = {};
for (const file of ['shared/game.js', 'shared/constants.js', 'shared/notation.js']) {
  sourceHashes[file] = createHash('sha256').update(await readFile(new URL('../' + file, import.meta.url))).digest('hex');
}
const record = { generatedAt: new Date().toISOString(), rules: 'Pure Checkers; flying kings; actual engine repetition and no-capture rules',
  position, toMove: 'red', priorOccurrences: 0, movesWithoutCapture: 0, firstMove, maxHopsAfterFirst, nodes, sourceHashes, tree };
const directory = new URL('../src/static/research/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('two-kings-proof.json', directory), JSON.stringify(record, null, 2) + '\n');
console.log(`Proved a red win after ${firstMove} within ${maxHopsAfterFirst} further hops; ${nodes} proof-search nodes.`);
