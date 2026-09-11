// Pure room invariants, shared by leave, kick, disconnect expiry and creation.
export function canEditRoomSettings(room) {
  return ['waiting', 'WAITING'].includes(room.status) && !room.challenge &&
    room.players.every(p => !p.ready) && (!room.settings.autoReady || room.players.length === 1);
}

export function resetReadiness(room) {
  for (const player of room.players) player.ready = !!player.isBot;
}

export function removeMember(room, userId) {
  const wasPlayer = room.players.some(p => p.userId === userId);
  room.players = room.players.filter(p => p.userId !== userId);
  room.spectators = room.spectators.filter(p => p.userId !== userId);
  if (room.challenge && wasPlayer) return { closed: true };
  const humans = room.players.filter(p => !p.isBot);
  if (!humans.length) return { closed: true };
  if (!humans.some(p => p.userId === room.hostId)) {
    room.hostId = humans[0].userId;
    room.hostName = humans[0].username;
  }
  if (wasPlayer) resetReadiness(room);
  return { closed: false };
}

// An autoReady room (scan-to-play) treats every connected human as ready, so the
// ready flags that resetReadiness and disconnect clear stop mattering there.
export function canStartRoom(room) {
  return room.status === 'waiting' && room.players.length === 2 &&
    room.players.some(p => !p.isBot) && room.players.every(p => isRoomPlayerReady(room, p));
}

export function isRoomPlayerReady(room, player) {
  return !!(player.isBot || ((room.settings?.autoReady || player.ready) && player.online !== false));
}

export function canAddRoomBot(room) {
  return !room.challenge && room.status === 'waiting' && room.settings.buyIn === 0 && room.players.length === 1;
}

export function roomDepartureNotices(before, after, users, departure = null) {
  // Game completion closes its room while the result view stays open. Its
  // eventual expiry has a game notice, not a missing-human room notice.
  if (before.status === 'PLAYING' && after.status === 'CLOSED') return [];
  const members = after.status === 'CLOSED' ? [] : [...after.players, ...after.spectators];
  return [...before.players, ...before.spectators].flatMap(p => {
    if (users.get(p.userId)?.isBot || members.some(m => m.userId === p.userId)) return [];
    const reason = p.userId === departure?.userId ? departure.reason : after.status === 'CLOSED' ? 'room-closed' : null;
    return reason ? [{ userId: p.userId, reason }] : [];
  });
}
