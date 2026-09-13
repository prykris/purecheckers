// Presentation of accepted room readiness; never infers readiness from browsing location.
export function roomActivity(room, userId) {
  const me = room?.players?.find(p => p.userId === userId);
  const opponent = room?.players?.find(p => p.userId !== userId);
  const view = { label: 'Your room is open', action: 'Open room', quickPlay: false, ready: false, opponent };
  if (!room) return view;
  if (room.status === 'starting') return { ...view, label: 'Starting game…' };
  if (room.status === 'updating') return { ...view, label: 'Confirming room change…' };
  if (!me) return { ...view, label: 'Watching a room' };
  if (!opponent) return { ...view, label: 'Waiting for an opponent' };
  if (opponent.online === false) return { ...view, label: 'Opponent disconnected' };
  const ready = opponent.ready === true;
  if (room.status !== 'waiting') return view;
  if (ready) {
    const quickPlay = me.online !== false && room.settings.buyIn === 0;
    return { ...view, ready: true, label: me.ready ? 'Both players ready' : 'Opponent ready',
      action: quickPlay ? 'Play' : 'Review room', quickPlay };
  }
  return { ...view, label: me.ready ? "You're ready · waiting" : 'Opponent joined' };
}
