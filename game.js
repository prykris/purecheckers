// ============================================================
// CheckersGame — pure game logic, no DOM/network dependencies
// 8x8 board, flying queens, forced captures, multi-jumps
// ============================================================

class CheckersGame {
  constructor() {
    this.board = [];        // 8x8: null | { color:'red'|'black', queen:bool }
    this.currentPlayer = 'red';
    this.chainPiece = null; // {row,col} if mid-multijump
    this.gameOver = false;
    this.winner = null;     // 'red' | 'black' | 'draw'
    this.redTime = 60;    // seconds (60 min)
    this.blackTime = 60;
    this.moveHistory = [];
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    // Black pieces on rows 0-2
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) this.board[r][c] = { color: 'black', queen: false };
    // Red pieces on rows 5-7
    for (let r = 5; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) this.board[r][c] = { color: 'red', queen: false };

    this.currentPlayer = 'red';
    this.chainPiece = null;
    this.gameOver = false;
    this.winner = null;
    this.redTime = 60;
    this.blackTime = 60;
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

  // ---- move generation ----

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
      // Slide until we hit something
      while (this.at(r + dist * dr, c + dist * dc) === null) dist++;
      const mr = r + dist * dr, mc = c + dist * dc;
      // Must be an enemy piece
      if (this.at(mr, mc)?.color !== enemy) continue;
      // Landing squares: all empty squares beyond the captured piece
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

  // All captures for the current player
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

  // Get all valid moves for a specific piece at (r,c)
  getValidMovesFor(r, c) {
    const piece = this.at(r, c);
    if (!piece || piece.color !== this.currentPlayer) return [];
    // If mid-chain, only this piece can move
    if (this.chainPiece && (this.chainPiece.row !== r || this.chainPiece.col !== c)) return [];
    // Forced capture check
    const allCaptures = this.getAllCaptures();
    if (allCaptures.length > 0) {
      return this.getCaptures(r, c).map(m => ({ fromRow: r, fromCol: c, ...m }));
    }
    if (this.chainPiece) return []; // chain but no captures = chain ends (shouldn't happen)
    return this.getSimpleMoves(r, c).map(m => ({ fromRow: r, fromCol: c, ...m }));
  }

  // All valid moves for current player
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

  // ---- execute move ----

  makeMove(fromRow, fromCol, toRow, toCol) {
    const valid = this.getValidMovesFor(fromRow, fromCol);
    const move = valid.find(m => m.toRow === toRow && m.toCol === toCol);
    if (!move) return null;

    const piece = this.board[fromRow][fromCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    // Remove captured pieces
    for (const cap of move.captured) {
      this.board[cap.row][cap.col] = null;
    }

    // Promotion
    let promoted = false;
    if (!piece.queen) {
      if ((piece.color === 'red' && toRow === 0) || (piece.color === 'black' && toRow === 7)) {
        piece.queen = true;
        promoted = true;
      }
    }

    // Chain jump?
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
      // Reset turn timer for the new player
      if (this.currentPlayer === 'red') this.redTime = 60;
      else this.blackTime = 60;
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

  // ---- evaluation for AI ----

  evaluate(color) {
    let score = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = this.at(r, c);
        if (!p) continue;
        const val = p.queen ? 5 : 1;
        const posBonus = p.queen ? 0 :
          (p.color === 'red' ? (7 - r) * 0.1 : r * 0.1); // advance bonus
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

class ColonelBot {
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
      // If chain continues, play out the chain greedily
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
      const m = moves[0]; // just pick first for chain
      game.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
    }
  }

  _minimax(game, depth, alpha, beta, maximizing, botColor) {
    if (depth === 0 || game.gameOver) {
      return game.evaluate(botColor);
    }
    const moves = game.getAllValidMoves();
    if (moves.length === 0) {
      return game.evaluate(botColor);
    }

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
