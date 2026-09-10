export const BROWSE_TABS = Object.freeze(['lobby', 'treasury', 'shop', 'friends', 'profile']);

export function parseLocation(href) {
  const url = new URL(href, 'http://app.local');
  const path = url.pathname.replace(/\/$/, '');
  const tab = path.slice(1);
  if (BROWSE_TABS.includes(tab)) return { kind: 'browse', tab };
  if (['/game', '/room-waiting', '/search'].includes(path)) return { kind: 'session' };
  if (path === '/replay' && /^[1-9]\d*$/.test(url.searchParams.get('id') || '')) {
    const id = Number(url.searchParams.get('id'));
    if (Number.isSafeInteger(id)) return { kind: 'replay', id };
  }
  const invite = path.match(/^\/join\/([A-Za-z2-9]{6})$/);
  if (invite) return { kind: 'invite', code: invite[1].toUpperCase() };
  return { kind: 'browse', tab: 'lobby', invalid: !['', '/auth', '/lobby'].includes(path) };
}

export function sessionContext(snapshot) {
  if (!snapshot) return null;
  return [snapshot.serverId, snapshot.phase, snapshot.context?.roomId, snapshot.context?.gameId,
    snapshot.spectate?.roomId, snapshot.spectate?.gameId].join(':');
}

// One projection produces BOTH the visible screen and canonical URL.
// URL parameters describe current membership; they never grant membership.
export function projectNavigation(snapshot, intent, lastTab = 'lobby') {
  let screen = 'none', tab = intent.kind === 'browse' ? intent.tab : lastTab;
  let replayId = null;
  const query = new URLSearchParams();
  if (snapshot?.phase === 'in-game') {
    screen = 'game'; query.set('game', String(snapshot.game.gameId));
  } else if (snapshot?.phase === 'spectating') {
    screen = snapshot.spectate.gameId ? 'game' : 'room-waiting';
    query.set('watch', String(snapshot.spectate.roomId));
    if (snapshot.spectate.gameId) query.set('game', String(snapshot.spectate.gameId));
  } else {
    if (snapshot?.phase === 'in-room') query.set('room', String(snapshot.room.id));
    if (snapshot?.phase === 'matchmaking') query.set('search', '1');
    if (intent.kind === 'replay') { screen = 'replay'; replayId = intent.id; query.set('id', String(intent.id)); }
    else if (intent.kind !== 'browse') {
      if (snapshot?.phase === 'in-room') screen = 'room-waiting';
      if (snapshot?.phase === 'matchmaking') screen = 'search';
    }
  }
  const path = screen === 'none' ? '/' + tab : '/' + screen;
  return { screen, tab, replayId, url: path + (query.size ? '?' + query : '') };
}
