import { authHref, safeReturnTo, gameEntry } from '../src/lib/siteNavigation.js';

it.each(['https://elsewhere.test', '//elsewhere.test', '/\\elsewhere.test', '/\nelsewhere', '/login', '/register?returnTo=/profile', '/auth', '/forgot-password', null])('rejects unsafe or looping return destination %s', value => {
  expect(safeReturnTo(value)).toBe('/lobby');
});
it('preserves internal invitation, query and fragment destinations through auth switches', () => {
  const destination = '/invite/ABC234?source=qr#join';
  for (const view of ['guest', 'login', 'register']) {
    const url = new URL(authHref(view, destination, 'es'), 'https://purecheckers.com');
    expect(url.searchParams.get('returnTo')).toBe(destination);
    expect(url.searchParams.get('lang')).toBe('es');
  }
});
it.each([
  [{ phase: 'idle' }, '/lobby', 'Play'],
  [{ phase: 'in-room', room: { id: 12 } }, '/room-waiting?room=12', 'Return to room'],
  [{ phase: 'in-game', game: { gameId: 34 } }, '/game?game=34', 'Continue game'],
  [{ phase: 'matchmaking' }, '/search?search=1', 'Resume search'],
  [{ phase: 'spectating', spectate: { roomId: 12, gameId: 34 } }, '/game?watch=12&game=34', 'Continue watching'],
])('projects the authoritative session phase into the public entry link', (snapshot, href, label) => {
  expect(gameEntry({ id: 1 }, { status: 'ready', snapshot })).toEqual({ href, label });
});
it('does not advertise stale membership while restoring or disconnected', () => {
  const stale = { phase: 'in-game', game: { gameId: 34 } };
  expect(gameEntry({ id: 1 }, { status: 'disconnected', snapshot: stale }).href).toBe('/lobby');
  expect(gameEntry(null, { status: 'ready', snapshot: stale }).href).toBe('/auth?returnTo=%2Flobby');
});
