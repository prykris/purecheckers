import { describe, it, expect } from 'vitest';
import { CheckersGame, ColonelBot } from '../shared/game.js';
import { TURN_TIME } from '../shared/constants.js';

describe('CheckersGame', () => {
  it('initializes with correct board state', () => {
    const game = new CheckersGame();
    expect(game.currentPlayer).toBe('red');
    expect(game.gameOver).toBe(false);
    expect(game.redTime).toBe(TURN_TIME);
    expect(game.blackTime).toBe(TURN_TIME);
    expect(game.countPieces('red')).toBe(12);
    expect(game.countPieces('black')).toBe(12);
  });

  it('places pieces on correct squares', () => {
    const game = new CheckersGame();
    // Black on rows 0-2, dark squares only
    expect(game.at(0, 1)?.color).toBe('black');
    expect(game.at(0, 0)).toBeNull();
    // Red on rows 5-7
    expect(game.at(5, 0)?.color).toBe('red');
    expect(game.at(5, 1)).toBeNull();
    // Middle is empty
    expect(game.at(3, 0)).toBeNull();
    expect(game.at(4, 1)).toBeNull();
  });

  it('returns undefined for out-of-bounds', () => {
    const game = new CheckersGame();
    expect(game.at(-1, 0)).toBeUndefined();
    expect(game.at(8, 0)).toBeUndefined();
    expect(game.at(0, 8)).toBeUndefined();
  });

  it('generates valid opening moves for red', () => {
    const game = new CheckersGame();
    const moves = game.getAllValidMoves();
    // Red pieces on row 5 can move forward (row 4)
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.toRow).toBe(4); // all opening moves go to row 4
      expect(m.captured).toEqual([]);
    }
  });

  it('executes a simple move', () => {
    const game = new CheckersGame();
    const moves = game.getAllValidMoves();
    const move = moves[0];
    const result = game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

    expect(result).not.toBeNull();
    expect(result.captured).toEqual([]);
    expect(result.promoted).toBe(false);
    expect(result.chainContinues).toBe(false);
    expect(game.currentPlayer).toBe('black');
    expect(game.at(move.fromRow, move.fromCol)).toBeNull();
    expect(game.at(move.toRow, move.toCol)?.color).toBe('red');
  });

  it('rejects invalid moves', () => {
    const game = new CheckersGame();
    expect(game.makeMove(0, 0, 1, 1)).toBeNull(); // empty square
    expect(game.makeMove(0, 1, 1, 0)).toBeNull(); // black piece, but red's turn
    expect(game.makeMove(5, 0, 3, 2)).toBeNull(); // too far
  });

  it('resets turn timer on turn switch', () => {
    const game = new CheckersGame();
    game.redTime = 30; // simulate time passing
    const moves = game.getAllValidMoves();
    game.makeMove(moves[0].fromRow, moves[0].fromCol, moves[0].toRow, moves[0].toCol);
    // Turn switched to black, black's timer reset
    expect(game.blackTime).toBe(TURN_TIME);
    // Red's time stays where it was (30)
    expect(game.redTime).toBe(30);
  });

  it('handles captures correctly', () => {
    const game = new CheckersGame();
    // Set up a capture scenario
    game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.board[4][3] = { color: 'black', queen: false };
    game.board[5][2] = { color: 'red', queen: false };
    game.currentPlayer = 'red';
    game.chainPiece = null;

    const moves = game.getValidMovesFor(5, 2);
    expect(moves.length).toBe(1);
    expect(moves[0].toRow).toBe(3);
    expect(moves[0].toCol).toBe(4);
    expect(moves[0].captured.length).toBe(1);

    const result = game.makeMove(5, 2, 3, 4);
    expect(result.captured.length).toBe(1);
    expect(game.at(4, 3)).toBeNull(); // captured piece removed
    expect(game.at(3, 4)?.color).toBe('red');
  });

  it('forces captures when available', () => {
    const game = new CheckersGame();
    game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.board[4][3] = { color: 'black', queen: false };
    game.board[5][2] = { color: 'red', queen: false };
    game.board[5][6] = { color: 'red', queen: false }; // far from the capture
    game.currentPlayer = 'red';

    // Piece at (5,2) must capture, piece at (5,6) has no capture available
    const moves52 = game.getValidMovesFor(5, 2);
    const moves56 = game.getValidMovesFor(5, 6);
    expect(moves52.length).toBe(1);
    expect(moves52[0].captured.length).toBe(1);
    expect(moves56.length).toBe(0); // forced capture means this piece can't simple-move
  });

  it('promotes to queen at the end row', () => {
    const game = new CheckersGame();
    game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.board[1][0] = { color: 'red', queen: false };
    game.currentPlayer = 'red';

    const result = game.makeMove(1, 0, 0, 1);
    expect(result.promoted).toBe(true);
    expect(game.at(0, 1).queen).toBe(true);
  });

  it('handles chain jumps', () => {
    const game = new CheckersGame();
    game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.board[5][0] = { color: 'red', queen: false };
    game.board[4][1] = { color: 'black', queen: false };
    game.board[2][3] = { color: 'black', queen: false };
    game.currentPlayer = 'red';

    const result1 = game.makeMove(5, 0, 3, 2);
    expect(result1.chainContinues).toBe(true);
    expect(game.currentPlayer).toBe('red'); // still red's turn

    const result2 = game.makeMove(3, 2, 1, 4);
    expect(result2.chainContinues).toBe(false);
    expect(game.currentPlayer).toBe('black'); // now black's turn
  });

  it('detects game over when no moves available', () => {
    const game = new CheckersGame();
    game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.board[0][1] = { color: 'red', queen: false };
    // Black has no pieces
    game.currentPlayer = 'red';

    game.makeMove(0, 1, 1, 0); // red moves, turn goes to black
    // Technically this will trigger promotion... let me adjust
    // Actually red at (0,1) is already at row 0, that's the promotion row for red
    // Let me use a better setup
    game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.board[3][0] = { color: 'red', queen: false };
    game.currentPlayer = 'red';
    game.gameOver = false;

    game.makeMove(3, 0, 2, 1); // red moves, black has no pieces
    expect(game.gameOver).toBe(true);
    expect(game.winner).toBe('red');
  });

  it('handles timeout', () => {
    const game = new CheckersGame();
    game.tickTime(59);
    expect(game.gameOver).toBe(false);
    expect(game.redTime).toBe(1);

    game.tickTime(1);
    expect(game.gameOver).toBe(true);
    expect(game.winner).toBe('black');
  });

  it('clones correctly', () => {
    const game = new CheckersGame();
    game.makeMove(5, 0, 4, 1);
    const clone = game.clone();

    expect(clone.currentPlayer).toBe(game.currentPlayer);
    expect(clone.at(4, 1)?.color).toBe('red');
    expect(clone.at(5, 0)).toBeNull();

    // Mutations don't affect original
    clone.board[0][0] = { color: 'red', queen: true };
    expect(game.at(0, 0)).toBeNull();
  });

  it('evaluates position correctly', () => {
    const game = new CheckersGame();
    // Symmetric start — roughly equal
    const redScore = game.evaluate('red');
    const blackScore = game.evaluate('black');
    expect(redScore).toBeCloseTo(-blackScore, 1);

    // Remove a black piece — red should score higher
    game.board[0][1] = null;
    expect(game.evaluate('red')).toBeGreaterThan(redScore);
  });
});

describe('ColonelBot', () => {
  it('returns a valid move', () => {
    const game = new CheckersGame();
    const bot = new ColonelBot();
    game.currentPlayer = 'black'; // bot plays black
    // Make a red move first
    game.currentPlayer = 'red';
    game.makeMove(5, 0, 4, 1);

    const move = bot.chooseMove(game);
    expect(move).not.toBeNull();
    expect(move.fromRow).toBeGreaterThanOrEqual(0);
    expect(move.toRow).toBeGreaterThanOrEqual(0);

    // Verify it's actually a valid move
    const valid = game.getAllValidMoves();
    const isValid = valid.some(
      v => v.fromRow === move.fromRow && v.fromCol === move.fromCol &&
           v.toRow === move.toRow && v.toCol === move.toCol
    );
    expect(isValid).toBe(true);
  });

  it('returns null when no moves available', () => {
    const game = new CheckersGame();
    game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.currentPlayer = 'black';
    const bot = new ColonelBot();
    expect(bot.chooseMove(game)).toBeNull();
  });

  it('chooses a capture when available', () => {
    const game = new CheckersGame();
    game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.board[3][2] = { color: 'red', queen: false };
    game.board[2][3] = { color: 'black', queen: false };
    game.currentPlayer = 'black';

    const bot = new ColonelBot();
    const move = bot.chooseMove(game);
    // Forced capture — must jump
    expect(move.captured?.length || move.toRow).toBeDefined();
    expect(move.toRow).toBe(4);
    expect(move.toCol).toBe(1);
  });
});
