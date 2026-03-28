// ============================================================
// CheckersGame — pure game logic, no DOM/network dependencies
// 8x8 board, flying queens, forced captures, multi-jumps
// Isomorphic: runs on both client and server
// ============================================================

import { TURN_TIME } from './constants.js';

export class CheckersGame {
  constructor() {
    this.board = [];
    this.currentPlayer = 'red';
    this.chainPiece = null;
    this.gameOver = false;
    this.winner = null;
    this.redTime = TURN_TIME;
    this.blackTime = TURN_TIME;
    this.moveHistory = [];
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) this.board[r][c] = { color: 'black', queen: false };
    for (let r = 5; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) this.board[r][c] = { color: 'red', queen: false };

    this.currentPlayer = 'red';
    this.chainPiece = null;
    this.gameOver = false;
    this.winner = null;
    this.redTime = TURN_TIME;
    this.blackTime = TURN_TIME;
    this.moveHistory = [];
  }

  clone() {
    const g = new CheckersGame();
    g.board = this.board.map(row => row.map(cell => cell ? { ...cell } : null));
    g.currentPlayer = this.currentPlayer;
    g.chainPiece = this.chainPiece ? { ...this.chainPiece } : null;
    g.gameOver = this.gameOver;
    g.winner = this.winner;
    g.redTime = this.redTime;
    g.blackTime = this.blackTime;
    return g;
  }

  at(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return undefined;
    return this.board[r][c];
  }

  _directions() { return [[-1,-1],[-1,1],[1,-1],[1,1]]; }

  getCaptures(r, c) {
    const piece = this.at(r, c);
    if (!piece) return [];
    return piece.queen ? this._queenCaptures(r, c, piece) : this._manCaptures(r, c, piece);
  }

  _manCaptures(r, c, piece) {
    const enemy = piece.color === 'red' ? 'black' : 'red';
    const moves = [];
    for (const [dr, dc] of this._directions()) {
      const mr = r + dr, mc = c + dc;
      const lr = r + 2 * dr, lc = c + 2 * dc;
      if (this.at(mr, mc) && this.at(mr, mc)?.color === enemy && this.at(lr, lc) === null) {
        moves.push({ toRow: lr, toCol: lc, captured: [{ row: mr, col: mc }] });
      }
    }
    return moves;
  }

  _queenCaptures(r, c, piece) {
    const enemy = piece.color === 'red' ? 'black' : 'red';
    const moves = [];
    for (const [dr, dc] of this._directions()) {
      let dist = 1;
      while (this.at(r + dist * dr, c + dist * dc) === null) dist++;
      const mr = r + dist * dr, mc = c + dist * dc;
      if (this.at(mr, mc)?.color !== enemy) continue;
      let ldist = dist + 1;
      while (this.at(r + ldist * dr, c + ldist * dc) === null) {
        moves.push({
          toRow: r + ldist * dr,
          toCol: c + ldist * dc,
          captured: [{ row: mr, col: mc }]
        });
        ldist++;
      }
    }
    return moves;
  }

  getSimpleMoves(r, c) {
    const piece = this.at(r, c);
    if (!piece) return [];
    return piece.queen ? this._queenMoves(r, c) : this._manMoves(r, c, piece);
  }

  _manMoves(r, c, piece) {
    const forward = piece.color === 'red' ? -1 : 1;
    const moves = [];
    for (const dc of [-1, 1]) {
      const nr = r + forward, nc = c + dc;
      if (this.at(nr, nc) === null) {
        moves.push({ toRow: nr, toCol: nc, captured: [] });
      }
    }
    return moves;
  }

  _queenMoves(r, c) {
    const moves = [];
    for (const [dr, dc] of this._directions()) {
      let dist = 1;
      while (this.at(r + dist * dr, c + dist * dc) === null) {
        moves.push({ toRow: r + dist * dr, toCol: c + dist * dc, captured: [] });
        dist++;
      }
    }
    return moves;
  }

  getAllCaptures(color) {
    color = color || this.currentPlayer;
    const all = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.at(r, c)?.color === color) {
          const caps = this.getCaptures(r, c);
          for (const m of caps) all.push({ fromRow: r, fromCol: c, ...m });
        }
    return all;
  }

  getValidMovesFor(r, c) {
    const piece = this.at(r, c);
    if (!piece || piece.color !== this.currentPlayer) return [];
    if (this.chainPiece && (this.chainPiece.row !== r || this.chainPiece.col !== c)) return [];
    const allCaptures = this.getAllCaptures();
    if (allCaptures.length > 0) {
      return this.getCaptures(r, c).map(m => ({ fromRow: r, fromCol: c, ...m }));
    }
    if (this.chainPiece) return [];
    return this.getSimpleMoves(r, c).map(m => ({ fromRow: r, fromCol: c, ...m }));
  }

  getAllValidMoves(color) {
    color = color || this.currentPlayer;
    if (this.chainPiece) {
      return this.getValidMovesFor(this.chainPiece.row, this.chainPiece.col);
    }
    const caps = this.getAllCaptures(color);
    if (caps.length > 0) return caps;
    const moves = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.at(r, c)?.color === color)
          for (const m of this.getSimpleMoves(r, c))
            moves.push({ fromRow: r, fromCol: c, ...m });
    return moves;
  }

  makeMove(fromRow, fromCol, toRow, toCol) {
    const valid = this.getValidMovesFor(fromRow, fromCol);
    const move = valid.find(m => m.toRow === toRow && m.toCol === toCol);
    if (!move) return null;

    const piece = this.board[fromRow][fromCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    for (const cap of move.captured) {
      this.board[cap.row][cap.col] = null;
    }

    let promoted = false;
    if (!piece.queen) {
      if ((piece.color === 'red' && toRow === 0) || (piece.color === 'black' && toRow === 7)) {
        piece.queen = true;
        promoted = true;
      }
    }

    let chainContinues = false;
    if (move.captured.length > 0 && !promoted) {
      const moreCaps = this.getCaptures(toRow, toCol);
      if (moreCaps.length > 0) {
        this.chainPiece = { row: toRow, col: toCol };
        chainContinues = true;
      }
    }

    if (!chainContinues) {
      this.chainPiece = null;
      this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
      if (this.currentPlayer === 'red') this.redTime = TURN_TIME;
      else this.blackTime = TURN_TIME;
      this._checkGameOver();
    }

    this.moveHistory.push({
      fromRow, fromCol, toRow, toCol,
      captured: move.captured, promoted, chainContinues
    });

    return { captured: move.captured, promoted, chainContinues };
  }

  _checkGameOver() {
    const moves = this.getAllValidMoves();
    if (moves.length === 0) {
      this.gameOver = true;
      this.winner = this.currentPlayer === 'red' ? 'black' : 'red';
    }
  }

  tickTime(seconds) {
    if (this.gameOver) return;
    if (this.currentPlayer === 'red') {
      this.redTime = Math.max(0, this.redTime - seconds);
      if (this.redTime <= 0) { this.gameOver = true; this.winner = 'black'; }
    } else {
      this.blackTime = Math.max(0, this.blackTime - seconds);
      if (this.blackTime <= 0) { this.gameOver = true; this.winner = 'red'; }
    }
  }

  evaluate(color) {
    let score = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = this.at(r, c);
        if (!p) continue;
        const val = p.queen ? 5 : 1;
        const posBonus = p.queen ? 0 :
          (p.color === 'red' ? (7 - r) * 0.1 : r * 0.1);
        const centerBonus = (c >= 2 && c <= 5) ? 0.05 : 0;
        if (p.color === color) score += val + posBonus + centerBonus;
        else score -= val + posBonus + centerBonus;
      }
    return score;
  }

  countPieces(color) {
    let n = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.at(r, c)?.color === color) n++;
    return n;
  }
}

// ============================================================
// Bot AI — "The Colonel"
// Minimax with alpha-beta pruning
// ============================================================

export class ColonelBot {
  constructor() {
    this.name = 'The Colonel';
    this.depth = 6;
  }

  chooseMove(game) {
    const moves = game.getAllValidMoves();
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of moves) {
      const sim = game.clone();
      sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      this._finishChain(sim);
      const score = this._minimax(sim, this.depth - 1, -Infinity, Infinity, false, game.currentPlayer);
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  _finishChain(game) {
    while (game.chainPiece) {
      const moves = game.getAllValidMoves();
      if (moves.length === 0) break;
      game.makeMove(moves[0].fromRow, moves[0].fromCol, moves[0].toRow, moves[0].toCol);
    }
  }

  _minimax(game, depth, alpha, beta, maximizing, botColor) {
    if (depth === 0 || game.gameOver) return game.evaluate(botColor);
    const moves = game.getAllValidMoves();
    if (moves.length === 0) return game.evaluate(botColor);

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const sim = game.clone();
        sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        this._finishChain(sim);
        const ev = this._minimax(sim, depth - 1, alpha, beta, false, botColor);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const sim = game.clone();
        sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        this._finishChain(sim);
        const ev = this._minimax(sim, depth - 1, alpha, beta, true, botColor);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }
}
