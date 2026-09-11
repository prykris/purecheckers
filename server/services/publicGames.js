// Discovery policy applies equally to the sitemap, public games list and replay
// metadata. Replays remain accessible even when they are not discoverable.
export const MIN_DISCOVERY_MOVES = 10;
export const publicPlayerWhere = { isGuest: false, isBot: false, gamesPlayed: { gt: 0 } };
export const discoverablePlayerWhere = { ...publicPlayerWhere, profilePublic: true };
export const gameParticipants = {
  redPlayer: { select: { id: true, username: true, isBot: true, isGuest: true, guestExpiresAt: true, guestRetiredAt: true, profilePublic: true } },
  blackPlayer: { select: { id: true, username: true, isBot: true, isGuest: true, guestExpiresAt: true, guestRetiredAt: true, profilePublic: true } },
};

export function isDiscoverableGame(game) {
  const red = game?.redPlayer;
  const black = game?.blackPlayer;
  return !!(red && black && !red.isBot && !black.isBot
    && (!red.isGuest || !black.isGuest)
    && game.result !== 'ABORTED'
    && Array.isArray(game.moveHistory) && game.moveHistory.length >= MIN_DISCOVERY_MOVES);
}

// Keyset scanning avoids silently dropping eligible games behind a run of bot
// or short games. Filtering in JS works with the existing JSON history column.
export async function* discoverableGames(db, { batchSize = 500 } = {}) {
  let cursor;
  while (true) {
    const batch = await db.game.findMany({
      where: {
        result: { not: 'ABORTED' },
        redPlayer: { isBot: false }, blackPlayer: { isBot: false },
        OR: [{ redPlayer: { isGuest: false } }, { blackPlayer: { isGuest: false } }],
      },
      include: gameParticipants,
      orderBy: { id: 'desc' }, take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const game of batch) if (isDiscoverableGame(game)) yield game;
    if (batch.length < batchSize) return;
    cursor = batch.at(-1).id;
  }
}
