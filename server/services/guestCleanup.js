/**
 * Periodic cleanup of expired guest accounts.
 *
 * - Guests with 0 games played → deleted entirely
 * - Guests with games played → tombstoned (username changed, kept for FK integrity)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanupExpiredGuests() {
  const now = new Date();

  try {
    // Find expired guests
    const expired = await prisma.user.findMany({
      where: {
        isGuest: true,
        guestExpiresAt: { lt: now }
      },
      select: { id: true, username: true, gamesPlayed: true }
    });

    if (expired.length === 0) return;

    let deleted = 0;
    let tombstoned = 0;

    for (const guest of expired) {
      if (guest.gamesPlayed === 0) {
        // No games — safe to delete entirely
        await prisma.user.delete({ where: { id: guest.id } });
        deleted++;
      } else {
        // Has game history — tombstone to preserve FK references
        await prisma.user.update({
          where: { id: guest.id },
          data: {
            username: `[Expired Guest ${guest.id}]`,
            guestExpiresAt: null, // prevent re-processing
          }
        });
        tombstoned++;
      }
    }

    if (deleted + tombstoned > 0) {
      console.log(`[GuestCleanup] Processed ${expired.length} expired guests: ${deleted} deleted, ${tombstoned} tombstoned`);
    }
  } catch (err) {
    console.error('[GuestCleanup] Error:', err);
  }
}

/**
 * Start the cleanup interval (runs hourly).
 */
export function startGuestCleanup() {
  // Run once on startup
  cleanupExpiredGuests();
  // Then every hour
  setInterval(cleanupExpiredGuests, 60 * 60 * 1000);
}
