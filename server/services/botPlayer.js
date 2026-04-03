/**
 * Server-side bot player.
 *
 * Uses the shared CheckersGame + minimax from shared/game.js.
 * Each difficulty is a different search depth.
 * Bot accounts are real User rows in the database (seeded on startup).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DIFFICULTIES = {
  easy:   { depth: 2, name: 'Bot Easy' },
  medium: { depth: 4, name: 'Bot Medium' },
  hard:   { depth: 6, name: 'Bot Hard' },
};

// Cached bot User IDs (loaded once on first use)
let botUsers = null;

/**
 * Load or return cached bot user records.
 */
export async function getBotUsers() {
  if (botUsers) return botUsers;
  const bots = await prisma.user.findMany({ where: { isBot: true } });
  botUsers = {};
  for (const bot of bots) {
    for (const [diff, config] of Object.entries(DIFFICULTIES)) {
      if (bot.username === config.name) {
        botUsers[diff] = bot;
      }
    }
  }
  return botUsers;
}

/**
 * Get the bot User for a given difficulty.
 */
export async function getBotUser(difficulty) {
  const bots = await getBotUsers();
  return bots[difficulty] || null;
}

/**
 * Check if a userId belongs to a bot.
 */
export async function isBotUser(userId) {
  const bots = await getBotUsers();
  return Object.values(bots).some(b => b.id === userId);
}

/**
 * Choose a move for the bot using minimax.
 * Runs synchronously — the caller should schedule with setTimeout for natural feel.
 */
export function chooseBotMove(game, difficulty) {
  const config = DIFFICULTIES[difficulty];
  if (!config) return null;

  const moves = game.getAllValidMoves();
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const botColor = game.currentPlayer;
  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of moves) {
    const sim = game.clone();
    sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    finishChain(sim);
    const score = minimax(sim, config.depth - 1, -Infinity, Infinity, false, botColor);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function finishChain(game) {
  while (game.chainPiece) {
    const moves = game.getAllValidMoves();
    if (moves.length === 0) break;
    game.makeMove(moves[0].fromRow, moves[0].fromCol, moves[0].toRow, moves[0].toCol);
  }
}

function minimax(game, depth, alpha, beta, maximizing, botColor) {
  if (depth === 0 || game.gameOver) return game.evaluate(botColor);
  const moves = game.getAllValidMoves();
  if (moves.length === 0) return game.evaluate(botColor);

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const sim = game.clone();
      sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      finishChain(sim);
      const ev = minimax(sim, depth - 1, alpha, beta, false, botColor);
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
      finishChain(sim);
      const ev = minimax(sim, depth - 1, alpha, beta, true, botColor);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Get the difficulty key for a bot userId.
 */
export async function getBotDifficulty(userId) {
  const bots = await getBotUsers();
  for (const [diff, bot] of Object.entries(bots)) {
    if (bot.id === userId) return diff;
  }
  return null;
}

export { DIFFICULTIES };
