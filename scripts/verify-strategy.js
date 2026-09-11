import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compile } from 'mdsvex';
import { parse } from 'svelte/compiler';
import { gameFromPosition, parseMove, listPieces } from '../src/lib/content/position.js';

// Inspect author-supplied literals without executing article JavaScript. A new
// expression form must be explicitly supported rather than evaluated as code.
function literal(node) {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'ArrayExpression') return node.elements.map(literal);
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(p => {
    if (p.type !== 'Property' || p.computed || p.method || p.kind !== 'init') throw new Error('Diagram props must be literal data');
    return [p.key.name ?? p.key.value, literal(p.value)];
  }));
  throw new Error(`Unsupported diagram expression: ${node.type}`);
}

function attribute(attribute) {
  if (attribute.type !== 'Attribute') throw new Error('Diagram props cannot contain spreads or directives');
  if (attribute.value === true) return true;
  const parts = Array.isArray(attribute.value) ? attribute.value : [attribute.value];
  if (parts.length === 1 && parts[0].type === 'ExpressionTag') return literal(parts[0].expression);
  if (parts.every(p => p.type === 'Text')) return parts.map(p => p.data).join('');
  throw new Error('Diagram props must be literal data');
}

function components(node, result = []) {
  if (!node || typeof node !== 'object') return result;
  if (node.type === 'Component' && node.name === 'DiagramBoard') result.push(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) components(child, result);
    else if (value && typeof value === 'object') components(value, result);
  }
  return result;
}

export async function inspectArticle(source) {
  const compiled = await compile(source);
  const ast = parse(compiled.code, { modern: true });
  const diagrams = components(ast.fragment).map(node => Object.fromEntries(node.attributes.map(a => [a.name, attribute(a)])));
  return { metadata: compiled.data.fm, diagrams };
}

export function verifyDiagram(props) {
  const game = gameFromPosition(props.position, props.toMove);
  const pieces = listPieces(game.board);
  if (!pieces.some(p => p.piece.startsWith('red')) || !pieces.some(p => p.piece.startsWith('black'))) throw new Error('Diagram needs both sides');
  if (!game.getAllValidMoves().length) throw new Error('Diagram starting side needs a legal move');
  if (!props.caption?.trim()) throw new Error('Diagram needs a descriptive caption');
  if (!['static', 'step', 'try'].includes(props.mode ?? 'static')) throw new Error('Unknown diagram mode');
  if (props.bot && !['easy', 'medium', 'hard'].includes(props.bot)) throw new Error('Unknown bot difficulty');
  for (const marks of [props, ...(props.variants ?? [])]) {
    for (const square of marks.highlight ?? []) if (!Number.isInteger(square) || square < 1 || square > 32) throw new Error('Highlight outside the board');
    // Variant illustrations can deliberately mark English rules. Only check
    // notation here; playable steps below always use the actual app engine.
    for (const arrow of marks.arrows ?? []) parseMove(arrow);
  }
  let hops = 0;
  for (const entry of props.moves ?? []) {
    const move = typeof entry === 'string' ? entry : entry.move;
    for (const step of parseMove(move)) {
      const result = game.makeMove(step.fromRow, step.fromCol, step.toRow, step.toCol);
      if (!result) throw new Error(`Illegal step ${move} after ${hops} hops`);
      const captured = result.captured?.length ?? 0;
      if ((/[x×]/.test(move)) !== (captured > 0)) throw new Error(`Capture notation does not match ${move}`);
      hops++;
    }
  }
  if (game.chainPiece) throw new Error('Scripted sequence stops before its forced capture chain finishes');
  return { hops, pieces: pieces.length, mover: game.currentPlayer, winner: game.winner };
}

export async function verifyStrategy(directory = new URL('../src/content/strategy/', import.meta.url)) {
  const results = [];
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.md')).sort()) {
    const { diagrams } = await inspectArticle(await readFile(new URL(file, directory), 'utf8'));
    if (!diagrams.length && file !== 'play-checkers-online-with-friends.md') throw new Error(`${file}: missing diagram`);
    results.push({ file, diagrams: diagrams.map((props, index) => {
      try { return verifyDiagram(props); }
      catch (error) { throw new Error(`${file}, diagram ${index + 1}: ${error.message}`); }
    }) });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await verifyStrategy(), null, 2));
}
