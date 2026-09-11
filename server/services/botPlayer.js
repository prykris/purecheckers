/**
 * Bot account lookup.
 *
 * Bot accounts are provisioned from the registry when first requested.
 */
import prisma from '../db.js';
import { ensureBotAccount } from './botAccounts.js';
import { getBotDefinition } from '../domain/botRegistry.js';


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
 * Get the difficulty key for a bot userId.
 */
export async function getBotDifficulty(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBot: true, botKey: true } });
  return user?.isBot && getBotDefinition(user.botKey) ? user.botKey : null;
}
