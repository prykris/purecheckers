import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectArticle, verifyDiagram, verifyStrategy } from '../scripts/verify-strategy.js';
import { gameFromPosition, parseMove, moveNotation, squareCoords, diagramSteps } from '../src/lib/content/position.js';

async function diagrams(slug) {
  return (await inspectArticle(await readFile(new URL(`../src/content/strategy/${slug}.md`, import.meta.url), 'utf8'))).diagrams;
}
function move(game, notation) {
  for (const hop of parseMove(notation)) expect(game.makeMove(hop.fromRow, hop.fromCol, hop.toRow, hop.toCol)).toBeTruthy();
}
const options = game => game.getAllValidMoves().map(moveNotation).sort();

it('requires the published opening experiment to match the current engine source', async () => {
  const report = JSON.parse(await readFile(new URL('../src/static/research/opening-search.json', import.meta.url), 'utf8'));
  for (const file of ['shared/game.js', 'shared/botSearch.js', 'shared/constants.js']) {
    const hash = createHash('sha256').update(await readFile(new URL('../' + file, import.meta.url))).digest('hex');
    expect(report.sourceHashes[file], `Regenerate the opening experiment and review its article after changing ${file}`).toBe(hash);
  }
  const [props] = await diagrams('best-first-move-in-checkers');
  expect(report.rows.map(r => r.opening).sort()).toEqual(options(gameFromPosition(props.position)));
  for (const row of report.rows) {
    expect(row.completedDepth).toBe(6);
    const best = Math.max(...row.scores.map(s => s.score));
    expect(row.bestReplies).toEqual(row.scores.filter(s => s.score === best).map(s => s.move));
  }
});

it('independently checks every defensive branch in the published two-kings win certificate', async () => {
  const proof = JSON.parse(await readFile(new URL('../src/static/research/two-kings-proof.json', import.meta.url), 'utf8'));
  for (const [file, expected] of Object.entries(proof.sourceHashes)) {
    expect(createHash('sha256').update(await readFile(new URL('../' + file, import.meta.url))).digest('hex')).toBe(expected);
  }
  const [diagram] = await diagrams('two-kings-vs-one-king-checkers');
  expect(diagram.position).toBe(proof.position);
  const game = gameFromPosition(proof.position, proof.toMove);
  move(game, proof.firstMove);
  let terminalBranches = 0;
  function verify(game, node, remaining) {
    if (node.win) {
      expect(game.gameOver).toBe(true);
      expect(game.winner).toBe('red');
      terminalBranches++;
      return;
    }
    expect(game.gameOver).toBe(false);
    expect(remaining).toBeGreaterThan(0);
    const branches = game.currentPlayer === 'black' ? node.allReplies : [node];
    expect(branches.length).toBeGreaterThan(0);
    if (game.currentPlayer === 'black') expect(branches.map(b => b.move).sort()).toEqual(options(game));
    for (const branch of branches) {
      expect(parseMove(branch.move)).toHaveLength(1);
      const next = game.clone();
      move(next, branch.move);
      verify(next, branch.next, remaining - 1);
    }
  }
  verify(game, proof.tree, proof.maxHopsAfterFirst);
  expect(terminalBranches).toBe(15);
});

it('replays every published scripted diagram and checks its caption, position and notation', async () => {
  const results = await verifyStrategy();
  expect(results.length).toBeGreaterThanOrEqual(6);
  expect(results.flatMap(r => r.diagrams).reduce((n, d) => n + d.hops, 0)).toBeGreaterThan(10);
});

it('checks every breeches defence and the losing king approach in the traps guide', async () => {
  const [, props] = await diagrams('checkers-traps');
  const game = gameFromPosition(props.position); move(game, '15-18');
  expect(options(game)).toEqual(['14-10', '14-9', '23-19']);
  const replies = { '14-10': ['18x27', '18x32'], '14-9': ['18x27', '18x32', '18x5'], '23-19': ['18x5', '18x9'] };
  for (const [reply, captures] of Object.entries(replies)) {
    const next = game.clone(); move(next, reply); expect(options(next)).toEqual(captures);
  }
  const wrong = gameFromPosition(props.position); move(wrong, '15-19');
  expect(options(wrong)).toEqual(['23x16']); move(wrong, '23x16');
  expect(wrong.gameOver).toBe(true); expect(wrong.winner).toBe('black');
});

it('proves why the extra flying-king landing breaks the shown in-and-out triple jump', async () => {
  const [, , props] = await diagrams('checkers-traps');
  const game = gameFromPosition(props.position, 'black');
  move(game, '30-26'); expect(options(game)).toEqual(['21x30']);
  move(game, '21x30'); expect(game.currentPlayer).toBe('black');
  expect(game.board[squareCoords(30).row][squareCoords(30).col].queen).toBe(true);
  move(game, '7-3'); expect(options(game)).toEqual(['30x19', '30x23']);
  const trap = game.clone(); move(trap, '30x23'); move(trap, '3x12x19x26');
  expect(trap.gameOver).toBe(true); expect(trap.winner).toBe('black');
  const defence = game.clone(); move(defence, '30x19'); expect(options(defence)).toEqual(['3x12']);
  move(defence, '3x12'); expect(defence.currentPlayer).toBe('red');
  expect(defence.gameOver).toBe(false);
  expect(defence.board.flat().filter(p => p?.color === 'red')).toHaveLength(2);
});

it('verifies guard deflection buys a previously blocked promotion, not a material gain', async () => {
  const [, , , props] = await diagrams('checkers-traps');
  const game = gameFromPosition(props.position);
  expect(options(game).some(m => m.startsWith('27-'))).toBe(false);
  move(game, '22-26'); expect(options(game)).toEqual(['31x22']);
  move(game, '31x22'); expect(options(game)).toContain('27-31'); expect(options(game)).not.toContain('27-32');
  move(game, '27-31');
  const red = game.board.flat().filter(p => p?.color === 'red');
  expect(red).toHaveLength(3); expect(red.filter(p => p.queen)).toHaveLength(1);
  expect(game.board.flat().filter(p => p?.color === 'black')).toHaveLength(2);
  expect(game.gameOver).toBe(false);
});

it('checks both dog-hole wins, the guard-release mistake, and the optional entry', async () => {
  const [, , , , props] = await diagrams('checkers-traps');
  for (const winning of ['3-7','3-8']) {
    const game = gameFromPosition(props.position); move(game, winning);
    expect(game.gameOver).toBe(true); expect(game.winner).toBe('red'); expect(options(game)).toEqual([]);
  }
  const wrong = gameFromPosition(props.position); move(wrong, '1-6');
  expect(options(wrong)).toEqual(['5-1']); move(wrong, '5-1');
  expect(wrong.board[squareCoords(1).row][squareCoords(1).col]).toMatchObject({ color: 'black', queen: true });
  const earlier = gameFromPosition(props.position, 'black');
  const at = squareCoords(5), before = squareCoords(9);
  earlier.board[before.row][before.col] = earlier.board[at.row][at.col]; earlier.board[at.row][at.col] = null;
  expect(options(earlier)).toEqual(['9-5','9-6']);
});

it('preserves the described mandatory backward capture and blocks other quiet moves', async () => {
  const [props] = await diagrams('can-you-move-backwards-in-checkers');
  const game = gameFromPosition(props.position);
  expect(options(game)).toEqual(['18x9']);
  move(game, '18x9');
  expect(game.currentPlayer).toBe('black');
  const { row, col } = squareCoords(9);
  expect(game.board[row][col]).toEqual({ color: 'red', queen: false });
});

it('verifies each forced response in the sacrifice, including the supporting guard', async () => {
  const [, props] = await diagrams('double-jump-in-checkers');
  const game = gameFromPosition(props.position);
  move(game, '15-18');
  expect(options(game)).toEqual(['22x15']);
  move(game, '22x15');
  expect(options(game)).toEqual(['10x19']);
  move(game, '10x19');
  expect(game.currentPlayer).toBe('red');
  expect(options(game)).toEqual(['19x26']);
  move(game, '19x26');
  expect(game.currentPlayer).toBe('black');

  const unguarded = gameFromPosition(props.position);
  const { row, col } = squareCoords(6);
  unguarded.board[row][col] = null;
  move(unguarded, '15-18'); move(unguarded, '22x15');
  expect(unguarded.currentPlayer).toBe('black');
  expect(options(unguarded)).toEqual(['15x6']);
});

it('checks the try-mode triple-jump solution through promotion', async () => {
  const [, , props] = await diagrams('double-jump-in-checkers');
  const game = gameFromPosition(props.position);
  for (const hop of ['6x15', '15x22', '22x31']) {
    expect(options(game)).toEqual([hop]); move(game, hop);
  }
  const { row, col } = squareCoords(31);
  expect(game.board[row][col]).toEqual({ color: 'red', queen: true });
  expect(game.currentPlayer).toBe('black');
  expect(game.gameOver).toBe(false);
});

it('keeps king movement highlights and the claimed flying capture destinations accurate', async () => {
  const [, movement, , capture] = await diagrams('how-do-kings-move-in-checkers');
  const game = gameFromPosition(movement.position);
  const at = squareCoords(18);
  const destinations = game.getValidMovesFor(at.row, at.col).map(m => {
    const notation = moveNotation(m); return Number(notation.split(/[-x]/)[1]);
  }).sort((a, b) => a - b);
  expect(destinations).toEqual([...movement.variants[1].highlight].sort((a, b) => a - b));
  expect(options(gameFromPosition(capture.position))).toEqual(['32x14', '32x5', '32x9']);
});

it('checks the five opening lessons, including optional recaptures and blocked landings', async () => {
  const props = await diagrams('checkers-openings-for-beginners');
  expect(props).toHaveLength(5);
  const final = props.map((p, i) => {
    const game = gameFromPosition(p.position, p.toMove);
    for (const entry of p.moves) move(game, entry.move);
    const men = game.board.flat().filter(Boolean);
    expect(men.filter(p => p.color === 'red')).toHaveLength([11, 12, 11, 12, 12][i]);
    expect(men.filter(p => p.color === 'black')).toHaveLength([11, 12, 11, 12, 12][i]);
    return game;
  });
  const exchange = gameFromPosition(props[0].position);
  for (const step of ['11-15', '24-19', '15x24']) move(exchange, step);
  expect(options(exchange)).toEqual(['27x20', '28x19']);
  const single = gameFromPosition(props[2].position);
  for (const step of ['11-15', '22-18', '15x22']) move(single, step);
  expect(options(single)).toEqual(['25x18', '26x17']);
  expect(options(final[1]).some(m => m.includes('x'))).toBe(false);
  expect(options(final[4])).toContain('20-24');
  const guarded = gameFromPosition(props[3].position), unguarded = guarded.clone();
  for (const game of [guarded, unguarded]) for (const step of ['9-14', '22-18']) move(game, step);
  move(guarded, '5-9'); move(unguarded, '11-16');
  expect(options(guarded)).not.toContain('18x9');
  expect(options(unguarded)).toContain('18x9');
});

it('expands a compound capture into separate visible hops and keeps its final explanation', () => {
  expect(diagramSteps([{ move: '14x23x30', note: 'Complete.' }])).toEqual([
    { move: '14x23', note: 'Jump 1 of 2 in 14x23x30. The same piece continues.' },
    { move: '23x30', note: 'Complete.' }
  ]);
});

it('rejects illegal or unfinished scripted chains and executable prop expressions', async () => {
  const blocked = Array(64).fill('.');
  for (const [square, piece] of [[29, 'r'], [1, 'b']]) {
    const { row, col } = squareCoords(square);
    blocked[row * 8 + col] = piece;
  }
  expect(() => verifyDiagram({ position: blocked.join(''), toMove: 'red', caption: 'Blocked men.' })).toThrow('starting side needs a legal move');
  const [props] = await diagrams('double-jump-in-checkers');
  expect(() => verifyDiagram({ ...props, moves: ['14-23'] })).toThrow('Capture notation');
  expect(() => verifyDiagram({ ...props, moves: ['14x23'] })).toThrow('forced capture chain');
  expect(() => verifyDiagram({ ...props, moves: ['14-15'] })).toThrow('Illegal step');
  await expect(inspectArticle('<DiagramBoard position={readSecret()} />')).rejects.toThrow('Unsupported diagram expression');
});
