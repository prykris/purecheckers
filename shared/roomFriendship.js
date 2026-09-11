// Joining by invitation suggests a connection to both seated humans, independent
// of the room's current visibility. It never grants friendship automatically.
export function suggestRoomFriendship(room) {
  return room.players.length === 2 && room.players.every(player => !player.isBot) &&
    room.players.some(player => player.joinedViaInvite === true);
}

export function friendshipWith(data, userId) {
  if (!data) return { kind: 'unknown' };
  const friend = data.friends.find(friend => friend.id === userId);
  if (friend) return { kind: 'friends', id: friend.friendshipId };
  const incoming = data.requests.find(request => request.requester.id === userId);
  if (incoming) return { kind: 'incoming', id: incoming.id };
  const outgoing = data.outgoing.find(request => request.receiver.id === userId);
  return outgoing ? { kind: 'outgoing', id: outgoing.id } : { kind: 'none' };
}
