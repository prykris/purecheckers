// Expired guests are tombstoned as "[Expired Guest N]" (see guestCleanup.js). Public
// surfaces render them as a plain "Guest" instead of the bookkeeping name.
const TOMBSTONE = /^\[Expired Guest/;

export function publicUsername(username) {
  if (typeof username !== 'string') return username;
  return TOMBSTONE.test(username) ? 'Guest' : username;
}

export function isPublicProfile(player, now = new Date()) {
  return !!player && !player.guestRetiredAt && player.profilePublic !== false && typeof player.username === 'string'
    && publicUsername(player.username) === player.username
    && (!player.isGuest || !player.guestExpiresAt || new Date(player.guestExpiresAt) > now);
}

export function publicProfilePath(player) {
  return isPublicProfile(player) ? '/player/' + encodeURIComponent(player.username) : null;
}
