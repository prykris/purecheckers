export const CHALLENGE_TTL_MS = 5 * 60_000;
export const MAX_INCOMING_CHALLENGES = 5;

export function pendingChallenge(room, now = Date.now()) {
  return !!room?.challenge && ['waiting', 'WAITING'].includes(room.status) &&
    room.players.length === 1 && room.challenge.expiresAt > now;
}

export function challengeInvitations(rooms, userId, now = Date.now()) {
  return [...rooms].filter(room => room.challenge?.userId === userId && pendingChallenge(room, now))
    .sort((a, b) => a.challenge.expiresAt - b.challenge.expiresAt)
    .map(room => ({ roomId: room.id, hostName: room.hostName, code: room.joinCode,
      expiresAt: room.challenge.expiresAt, turnTimer: room.settings.turnTimer }));
}
