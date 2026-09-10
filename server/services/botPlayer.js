/**
 * Server-side bot player.
 *
 * Uses the shared CheckersGame + minimax from shared/game.js.
 * Each difficulty is a different search depth.
 * Bot accounts are provisioned from the registry when first requested.
 */
import { PrismaClient } from '@prisma/client';
import { ensureBotAccount } from './botAccounts.js';
import { getBotDefinition } from '../domain/botRegistry.js';

const prisma = new PrismaClient();

export async function getBotUser(difficulty) {
  return ensureBotAccount(prisma, difficulty);
}

/**
 * Check if a userId belongs to a bot.
 * Uses the isBot flag on the User model — no cache dependency.
 */
export async function isBotUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBot: true } });
  return user?.isBot === true;
}

/**
 * Choose a move for the bot using minimax.
 * Runs synchronously — the caller should schedule with setTimeout for natural feel.
 */
export function chooseBotMove(game, difficulty) {
  const config = getBotDefinition(difficulty);
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
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBot: true, botKey: true } });
  return user?.isBot && getBotDefinition(user.botKey) ? user.botKey : null;
}
