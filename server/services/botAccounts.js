import { randomUUID } from 'node:crypto';
import { BOT_REGISTRY, getBotDefinition } from '../domain/botRegistry.js';

export class BotAccountConflict extends Error {}
function verifyBot(user, key) {
  if (!user.isBot || user.isGuest || user.isAdmin || user.email !== null || user.passwordHash !== null) {
    throw new BotAccountConflict('The account reserved for bot "' + key + '" is not a service account');
  }
  return user;
}

// Database uniqueness, rather than an in-memory cache, coordinates callers and processes.
// Existing accounts keep their ID, name, ELO, balance and game history.
export async function ensureBotAccount(database, key) {
  const definition = getBotDefinition(key);
  if (!definition) return null;
  for (let attempt = 0; ; attempt++) {
    try {
      return await database.$transaction(async tx => {
        const existing = await tx.user.findUnique({ where: { botKey: key } });
        if (existing) return verifyBot(existing, key);

        // Adopt a previously seeded service account without replacing its history.
        const named = await tx.user.findUnique({ where: { username: definition.username } });
        if (named) {
          verifyBot(named, key);
          if (named.botKey !== null) throw new BotAccountConflict('Bot name belongs to a different registered bot');
          return tx.user.update({ where: { id: named.id }, data: { botKey: key } });
        }
        return tx.user.create({ data: {
          botKey: key, username: definition.username, isBot: true,
          elo: definition.initialElo, peakElo: definition.initialElo,
          friendCode: 'BOT-' + randomUUID(),
        } });
      });
    } catch (error) {
      // A concurrent creator can win between read and insert. Re-read and validate
      // the winner in a fresh transaction. Never swallow other database failures.
      if (attempt >= 2 || !['P2002', 'P2034'].includes(error.code)) throw error;
    }
  }
}

export async function ensurePredefinedBots(database) {
  const accounts = [];
  for (const key of Object.keys(BOT_REGISTRY)) accounts.push(await ensureBotAccount(database, key));
  return accounts;
}
