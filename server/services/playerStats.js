import { isPublicProfile } from './publicName.js';

export const publicPlayerSelect = { id: true, username: true, elo: true, peakElo: true, wins: true, losses: true,
  gamesPlayed: true, isAdmin: true, isGuest: true, isBot: true, profilePublic: true, guestExpiresAt: true, guestRetiredAt: true, createdAt: true, updatedAt: true };

export async function findPublicPlayer(db, username, now = new Date()) {
  const player = await db.user.findUnique({ where: { username }, select: publicPlayerSelect });
  return isPublicProfile(player, now) ? player : null;
}

export async function playerActivity(db, userId, { days = 365, now = new Date() } = {}) {
  const since = new Date(now.getTime() - days * 86400000);
  const games = await db.game.findMany({ where: { OR: [{ redPlayerId: userId }, { blackPlayerId: userId }], startedAt: { gte: since } },
    select: { startedAt: true }, orderBy: { startedAt: 'asc' } });
  const activity = {};
  for (const game of games) { const day = game.startedAt.toISOString().slice(0, 10); activity[day] = (activity[day] ?? 0) + 1; }
  return activity;
}
