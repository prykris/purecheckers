// ============================================================
// Puzzle search — generator-only search that wraps CheckersGame.
//
// This generator-only search verifies tactical choices to a bounded depth.
// Live bots and optional move grading use shared/botSearch.js in workers.
// This module checks which move is best, its continuation and terminal wins.
// It differs from the bot
// search in four ways described in docs/growth/03-daily-puzzle.md:
//
//   - fullMoves() branches at every capture-chain continuation instead of
//     finishing chains with moves[0]. A "move" here is a whole turn.
//   - Terminal positions score +(1000 - ply) / 0 / -(1000 - ply) so that a
//     win by immobilisation outranks winning a man and short wins outrank
//     long ones.
//   - Quiescence: at depth 0 a side that has captures keeps searching them
//     (captures are compulsory, so the extension is cheap and bounded).
//   - Search clones blank moveHistory and positionHistory.
//
// Isomorphic: no Node or DOM APIs. Puzzle play uses puzzleProgress.js to
// replay the stored line through the actual game engine without searching.
// ============================================================

import { CheckersGame } from './game.js';

export const WIN_SCORE = 1000;
export const DEFAULT_NODE_BUDGET = 2_000_000;

/**
 * Search clones use this prototype. Draw by repetition and the 50-half-move
 * rule are irrelevant inside a short tactical line, and the engine's check
 * for them builds a 64-character hash string on every move, so search clones
 * skip it. Everything else (move generation, captures, chains, promotion,
 * game-over detection, evaluate) is the engine's own code.
 */
class SearchGame extends CheckersGame {
  _checkForcedDraw() {}
}

// ---------------------------------------------------------------------------
// Positions and clones
// ---------------------------------------------------------------------------

/** Plain `{ board, currentPlayer }` snapshot of a game (what Puzzle.position stores). */
export function toPosition(game) {
  return {
    board: game.board.map(row => row.map(cell => (cell ? { color: cell.color, queen: cell.queen } : null))),
    currentPlayer: game.currentPlayer
  };
}

/** Build a clockless CheckersGame from a `{ board, currentPlayer }` snapshot. */
export function fromPosition(position) {
  const game = searchClone(null);
  game.board = position.board.map(row => row.map(cell => (cell ? { color: cell.color, queen: !!cell.queen } : null)));
  game.currentPlayer = position.currentPlayer;
  game.gameOver = false;
  game.winner = null;
  // A position whose side to move has nothing to play is already lost; mirror makeMove's bookkeeping.
  if (game.getAllValidMoves().length === 0) {
    game.gameOver = true;
    game.winner = game.currentPlayer === 'red' ? 'black' : 'red';
  }
  return game;
}

/**
 * Light clone for search: copies the board and turn state, blanks the move
 * and position histories, and never touches clocks. Pass null for an empty
 * clockless game. Measured 2-3x faster than CheckersGame.clone() because the
 * engine clone structuredClones moveHistory on every node.
 */
export function searchClone(game) {
  const g = Object.create(SearchGame.prototype);
  g.turnTime = 0;
  g.redTime = 0;
  g.blackTime = 0;
  g.moveHistory = [];
  g.positionHistory = [];
  g.movesWithoutCapture = 0;
  if (game) {
    const src = game.board;
    const board = new Array(8);
    for (let r = 0; r < 8; r++) {
      const srow = src[r];
      const row = new Array(8);
      for (let c = 0; c < 8; c++) {
        const p = srow[c];
        row[c] = p ? { color: p.color, queen: p.queen } : null;
      }
      board[r] = row;
    }
    g.board = board;
    g.currentPlayer = game.currentPlayer;
    g.chainPiece = game.chainPiece ? { row: game.chainPiece.row, col: game.chainPiece.col } : null;
    g.gameOver = game.gameOver;
    g.winner = game.winner;
    g.drawReason = game.drawReason;
  } else {
    g.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    g.currentPlayer = 'red';
    g.chainPiece = null;
    g.gameOver = false;
    g.winner = null;
    g.drawReason = null;
  }
  return g;
}

export function opponentOf(color) {
  return color === 'red' ? 'black' : 'red';
}

/** The engine's own evaluation, re-exported so callers do not reach into the game object. */
export function evaluate(game, color) {
  return game.evaluate(color);
}

export function countPieces(game) {
  let n = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (game.board[r][c]) n++;
  return n;
}

/** Pure material from `color`'s view (man 1, king 5), without the engine's positional bonuses. */
export function material(game, color) {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (!p) continue;
      const val = p.queen ? 5 : 1;
      score += p.color === color ? val : -val;
    }
  return score;
}

// ---------------------------------------------------------------------------
// Full moves (whole turns, every chain branch)
// ---------------------------------------------------------------------------

/**
 * Enumerate every complete turn for the side to move. Each entry is:
 *   { fromRow, fromCol, toRow, toCol, hops: [{fromRow,fromCol,toRow,toCol}],
 *     captured: [{row, col, color, queen}], promoted, after }
 * where `after` is the position once the whole chain is played (a search
 * clone with blanked histories). Chains branch at every continuation, so a
 * piece with two ways to continue a jump yields two entries.
 */
export function fullMoves(game) {
  const out = [];
  if (game.gameOver) return out;
  const first = game.getAllValidMoves();
  for (const m of first) {
    const sim = searchClone(game);
    const capturedPieces = m.captured.map(sq => describeSquare(sim, sq));
    const res = sim.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
    if (!res) continue;
    const hop = { fromRow: m.fromRow, fromCol: m.fromCol, toRow: m.toRow, toCol: m.toCol };
    if (res.chainContinues) {
      extendChain(sim, [hop], capturedPieces, out);
    } else {
      out.push(finishMove([hop], capturedPieces, res.promoted, sim));
    }
  }
  return out;
}

function extendChain(game, hops, captured, out) {
  const conts = game.getAllValidMoves();
  for (const m of conts) {
    const sim = searchClone(game);
    const caps = captured.concat(m.captured.map(sq => describeSquare(sim, sq)));
    const res = sim.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
    if (!res) continue;
    const nextHops = hops.concat([{ fromRow: m.fromRow, fromCol: m.fromCol, toRow: m.toRow, toCol: m.toCol }]);
    if (res.chainContinues) extendChain(sim, nextHops, caps, out);
    else out.push(finishMove(nextHops, caps, res.promoted, sim));
  }
}

function describeSquare(game, sq) {
  const p = game.board[sq.row][sq.col];
  return { row: sq.row, col: sq.col, color: p ? p.color : null, queen: p ? !!p.queen : false };
}

function finishMove(hops, captured, promoted, after) {
  const last = hops[hops.length - 1];
  return {
    fromRow: hops[0].fromRow,
    fromCol: hops[0].fromCol,
    toRow: last.toRow,
    toCol: last.toCol,
    hops,
    captured,
    promoted,
    after
  };
}

/** Compact string key for a full move: "r,c-r,c-r,c". */
export function moveKey(move) {
  const hops = move.hops || [{ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol }];
  let key = `${hops[0].fromRow},${hops[0].fromCol}`;
  for (const h of hops) key += `-${h.toRow},${h.toCol}`;
  return key;
}

export function sameMove(a, b) {
  return moveKey(a) === moveKey(b);
}

/** Strip the `after` game object so a move can be stored as JSON. */
export function serializeMove(move) {
  return {
    fromRow: move.fromRow,
    fromCol: move.fromCol,
    toRow: move.toRow,
    toCol: move.toCol,
    hops: move.hops.map(h => ({ ...h })),
    captured: move.captured.map(c => ({ ...c })),
    promoted: !!move.promoted
  };
}

/** Play a stored full move (all hops) on a game. Returns the game or null if any hop is illegal. */
export function applyFullMove(game, move) {
  const hops = move.hops || [{ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol }];
  for (let i = 0; i < hops.length; i++) {
    const h = hops[i];
    const res = game.makeMove(h.fromRow, h.fromCol, h.toRow, h.toCol);
    if (!res) return null;
    const last = i === hops.length - 1;
    if (last && res.chainContinues) return null;
    if (!last && !res.chainContinues) return null;
  }
  return game;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score of a finished game from `color`'s view, `ply` plies from the root:
 * +(1000 - ply) for a win, 0 for a draw, -(1000 - ply) for a loss.
 */
export function terminalScore(game, color, ply) {
  if (game.winner === null) return 0;
  return game.winner === color ? WIN_SCORE - ply : -(WIN_SCORE - ply);
}

export function isWinScore(score) {
  return score >= WIN_SCORE - 200;
}

export function isLossScore(score) {
  return score <= -(WIN_SCORE - 200);
}

function hasCaptures(game) {
  const color = game.currentPlayer;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (p && p.color === color && game.getCaptures(r, c).length > 0) return true;
    }
  return false;
}

// Negamax with alpha-beta, quiescence on forced captures, triangular PV.
// Scores are from the side to move's view. ctx.pv[ply] holds the PV below ply.
function negamax(game, depth, ply, alpha, beta, ctx) {
  ctx.nodes++;
  if (ctx.nodes > ctx.budget) {
    ctx.aborted = true;
    return 0;
  }
  ctx.pv[ply] = EMPTY;
  const me = game.currentPlayer;

  if (game.gameOver) return terminalScore(game, me, ply);
  if (depth <= 0 && (-depth >= ctx.maxQuiescence || !hasCaptures(game))) {
    return game.evaluate(me);
  }

  const moves = fullMoves(game);
  if (moves.length === 0) return -(WIN_SCORE - ply);

  orderMoves(moves, game, ply, ctx);

  let best = -Infinity;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const score = -negamax(m.after, depth - 1, ply + 1, -beta, -alpha, ctx);
    if (ctx.aborted) return 0;
    if (score > best) best = score;
    if (score > alpha) {
      alpha = score;
      ctx.pv[ply] = [m].concat(ctx.pv[ply + 1] || EMPTY);
      if (alpha >= beta) break;
    }
  }
  return best;
}

const EMPTY = Object.freeze([]);

function orderMoves(moves, game, ply, ctx) {
  if (moves.length < 2) return;
  // Previous iteration's PV move first, then by the mover's static evaluation after the move.
  const guide = ctx.guide && ctx.guide[ply - ctx.rootPly];
  const me = game.currentPlayer;
  for (const m of moves) {
    m._order = m.after.evaluate(me);
    if (m.after.gameOver && m.after.winner === me) m._order += WIN_SCORE;
    if (guide && sameMove(guide, m)) m._order += 10_000;
  }
  moves.sort((a, b) => b._order - a._order);
}

/**
 * Budgeted iterative-deepening search.
 *
 * @param {CheckersGame} game    position to search (not mutated)
 * @param {object} opts
 * @param {number} opts.depth          target depth in plies
 * @param {string} [opts.color]        whose view the score is from (default: side to move)
 * @param {number} [opts.nodeBudget]   hard node cap across all iterations
 * @param {number} [opts.ply]          ply of `game` relative to the puzzle root (for mate distances)
 * @param {number} [opts.alpha,beta]   aspiration window, from `color`'s view
 * @param {number} [opts.maxQuiescence] cap on quiescence plies beyond depth 0 (default 24)
 * @returns {{ score, pv, depth, nodes, complete, aborted }}
 *   `depth` is the deepest iteration that completed; `complete` is true when
 *   the target depth completed within the budget. `pv` is an array of full
 *   moves (with `after` positions) from `game`.
 */
export function search(game, opts = {}) {
  const target = opts.depth ?? 6;
  const color = opts.color || game.currentPlayer;
  const sign = color === game.currentPlayer ? 1 : -1;
  const rootPly = opts.ply || 0;
  const budget = opts.nodeBudget ?? DEFAULT_NODE_BUDGET;
  const alpha0 = opts.alpha ?? -Infinity;
  const beta0 = opts.beta ?? Infinity;
  const root = searchClone(game);

  const ctx = {
    nodes: 0,
    budget,
    aborted: false,
    pv: [],
    guide: null,
    rootPly,
    maxQuiescence: opts.maxQuiescence ?? 24
  };

  let result = { score: sign * root.evaluate(root.currentPlayer), pv: [], depth: 0, nodes: 0, complete: false, aborted: false };
  if (root.gameOver) {
    return { score: sign * terminalScore(root, root.currentPlayer, rootPly), pv: [], depth: target, nodes: 1, complete: true, aborted: false };
  }

  // Window is given from `color`'s view; negamax wants the side to move's view.
  const a = sign === 1 ? alpha0 : -beta0;
  const b = sign === 1 ? beta0 : -alpha0;

  for (let d = 1; d <= target; d++) {
    ctx.pv = [];
    const score = negamax(root, d, rootPly, a, b, ctx);
    if (ctx.aborted) {
      result.aborted = true;
      result.nodes = ctx.nodes;
      break;
    }
    const pv = ctx.pv[rootPly] || [];
    result = { score: sign * score, pv, depth: d, nodes: ctx.nodes, complete: d === target, aborted: false };
    ctx.guide = pv;
    // No point deepening a proven forced result.
    if (isWinScore(Math.abs(score)) && pv.length <= d) {
      result.complete = true;
      break;
    }
  }
  return result;
}

/** The principal variation of a search result as stored moves (no game objects). */
export function principalVariation(result) {
  return (result.pv || []).map(serializeMove);
}

/**
 * Score every full move of the side to move by searching the position after
 * it. Scores are from `color`'s view (default: side to move). `depth` is the
 * depth searched after each move. When `gapWindow` is given, moves after the
 * first are searched with a lower bound of (best - gapWindow): a move that
 * fails low is known to be worse than that bound but its score is then only an
 * upper bound (`exact: false`).
 *
 * @returns {{ scored: [{ move, score, pv, exact, complete }], complete, nodes }}
 *   sorted best-first from `color`'s view.
 */
export function scoreMoves(game, opts = {}) {
  const color = opts.color || game.currentPlayer;
  const mover = game.currentPlayer;
  const depth = opts.depth ?? 6;
  const rootPly = opts.ply || 0;
  const budget = opts.nodeBudget ?? DEFAULT_NODE_BUDGET;
  const gapWindow = opts.gapWindow ?? null;
  const moves = fullMoves(game);
  const sign = color === mover ? 1 : -1;

  const scored = [];
  let nodes = 0;
  let complete = true;
  let bestMover = -Infinity; // best from the mover's view so far

  for (const m of moves) {
    let alpha = -Infinity;
    if (gapWindow !== null && bestMover > -Infinity) alpha = bestMover - gapWindow;
    const remaining = budget - nodes;
    if (remaining <= 0) {
      complete = false;
      scored.push({ move: m, score: sign * -Infinity, pv: [], exact: false, complete: false });
      continue;
    }
    const res = search(m.after, {
      depth,
      color: mover,
      ply: rootPly + 1,
      nodeBudget: remaining,
      alpha,
      beta: Infinity,
      maxQuiescence: opts.maxQuiescence
    });
    nodes += res.nodes;
    if (!res.complete) complete = false;
    const exact = res.score > alpha;
    if (res.score > bestMover) bestMover = res.score;
    scored.push({ move: m, score: sign * res.score, pv: res.pv, exact, complete: res.complete, nodes: res.nodes, depth: res.depth });
  }
  scored.sort((x, y) => (sign === 1 ? y.score - x.score : x.score - y.score));
  return { scored, complete, nodes, moves };
}

// ---------------------------------------------------------------------------
// Hashing and symmetry
// ---------------------------------------------------------------------------

/** CheckersGame._boardHash(): 64 characters of board plus the side to move. */
export function positionHash(positionOrGame) {
  const game = positionOrGame instanceof CheckersGame ? positionOrGame : fromPosition(positionOrGame);
  return game._boardHash();
}

/**
 * The equivalent position for the other side: rotate the board 180 degrees,
 * swap colours and swap the side to move. This is the only exact symmetry of
 * the 8x8 board (a left-right flip maps dark squares onto light ones), so it
 * is the "mirror" used for de-duplication: a puzzle for red and its mirror
 * for black are the same puzzle.
 */
export function mirror(position) {
  const src = position instanceof CheckersGame ? toPosition(position) : position;
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = src.board[r][c];
      if (p) board[7 - r][7 - c] = { color: opponentOf(p.color), queen: !!p.queen };
    }
  return { board, currentPlayer: opponentOf(src.currentPlayer) };
}
