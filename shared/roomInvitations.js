// Public registered profiles accept invitations like profile challenges;
// an accepted friendship also permits invitations to private or guest accounts.
export function canReceiveRoomInvite(player, hostId, friends = false) {
  return !!player && Number.isSafeInteger(player.id) && player.id > 0 && player.id !== hostId &&
    !player.isBot && (friends || (!player.isGuest && player.profilePublic === true));
}
export function canInviteToRoom(room, hostId) {
  return !!room && room.hostId === hostId && ['waiting', 'WAITING'].includes(room.status) &&
    room.players.length === 1 && !room.challenge;
}
