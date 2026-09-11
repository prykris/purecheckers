import { BOT_DIFFICULTIES } from '../../shared/bots.js';

// Derive personal records from settled games, never from bot-wide counters or
// browser storage. Stable bot identities include both direct and room bot games.
export async function readBotStats(database, userId) {
  const bots = await database.user.findMany({
    where: { isBot: true, botKey: { in: BOT_DIFFICULTIES } },
    select: { id: true, botKey: true },
  });
  const records = new Map(BOT_DIFFICULTIES.map(difficulty => [difficulty, { difficulty, wins: 0, draws: 0, losses: 0 }]));
  if (!bots.length) return [...records.values()];
  const ids = bots.map(bot => bot.id), keys = new Map(bots.map(bot => [bot.id, bot.botKey]));
  const groups = await database.game.groupBy({
    by: ['redPlayerId', 'blackPlayerId', 'result'],
    where: {
      endedAt: { not: null }, result: { in: ['RED_WIN', 'BLACK_WIN', 'DRAW'] },
      OR: [
        { redPlayerId: userId, blackPlayerId: { in: ids } },
        { blackPlayerId: userId, redPlayerId: { in: ids } },
      ],
    },
    _count: { _all: true },
  });
  for (const game of groups) {
    const isRed = game.redPlayerId === userId;
    const record = records.get(keys.get(isRed ? game.blackPlayerId : game.redPlayerId));
    const outcome = game.result === 'DRAW' ? 'draws' : game.result === (isRed ? 'RED_WIN' : 'BLACK_WIN') ? 'wins' : 'losses';
    record[outcome] += game._count._all;
  }
  return [...records.values()];
}
