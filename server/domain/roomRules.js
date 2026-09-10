// Pure room invariants, shared by leave, kick, disconnect expiry and creation.
export function resetReadiness(room) {
  for (const player of room.players) player.ready = !!player.isBot;
}

export function removeMember(room, userId) {
  const wasPlayer = room.players.some(p => p.userId === userId);
  room.players = room.players.filter(p => p.userId !== userId);
  room.spectators = room.spectators.filter(p => p.userId !== userId);
  const humans = room.players.filter(p => !p.isBot);
  if (!humans.length) return { closed: true };
  if (!humans.some(p => p.userId === room.hostId)) {
    room.hostId = humans[0].userId;
    room.hostName = humans[0].username;
  }
  if (wasPlayer) resetReadiness(room);
  return { closed: false };
}

export function canStartRoom(room) {
  return room.status === 'waiting' && room.players.length === 2 &&
    room.players.some(p => !p.isBot) && room.players.every(p => p.isBot || (p.ready && p.online !== false));
}
