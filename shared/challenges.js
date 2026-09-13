export const CHALLENGE_TTL_MS = 5 * 60_000;
export const MAX_INCOMING_CHALLENGES = 5;

export function pendingChallenge(room, now = Date.now()) {
  return !!room?.challenge && ['waiting', 'WAITING'].includes(room.status) &&
    room.players.length === 1 && room.challenge.expiresAt > now;
}

// Both profile challenges and invitations to existing rooms use the same inbox.
export function pendingRoomInvites(room, now = Date.now()) {
  return ['waiting', 'WAITING'].includes(room.status) && room.players.length === 1
    ? (room.invites ?? []).filter(invite => invite.expiresAt > now) : [];
}

export function challengeInvitations(rooms, userId, now = Date.now()) {
  return [...rooms].flatMap(room => {
    const invitation = room.challenge?.userId === userId && pendingChallenge(room, now)
      ? room.challenge : pendingRoomInvites(room, now).find(invite => invite.userId === userId);
    return invitation ? [{ roomId: room.id, hostName: room.hostName, code: room.joinCode,
      expiresAt: invitation.expiresAt, turnTimer: room.settings.turnTimer,
      buyIn: room.settings.buyIn, kind: room.challenge ? 'challenge' : 'room' }] : [];
  }).sort((a, b) => a.expiresAt - b.expiresAt);
}
