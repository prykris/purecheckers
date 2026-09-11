export function filterRooms(rooms, filter = 'all') {
  return (rooms || []).filter(room => !room.closed)
    .filter(room => filter !== 'free' || room.settings.buyIn === 0)
    .filter(room => filter !== 'available' || (!room.settings.isPrivate && room.status === 'waiting' && room.players.length < 2))
    .sort((a, b) => Number(b.status === 'waiting') - Number(a.status === 'waiting') || a.createdAt - b.createdAt);
}
