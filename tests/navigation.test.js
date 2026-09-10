import { NavigationController } from '../src/lib/navigationController.js';
import { parseLocation, projectNavigation } from '../src/lib/navigationPolicy.js';

const idle = { serverId: 'server', phase: 'idle', context: {} };
const room = { ...idle, phase: 'in-room', context: { roomId: 'room-1' }, room: { id: 'room-1' } };
const game = { ...idle, phase: 'in-game', context: { gameId: 'game-1' }, game: { gameId: 'game-1' } };
const search = { ...idle, phase: 'matchmaking' };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function harness(path = '/lobby', authenticated = true) {
  let href = 'http://app.local' + path;
  const writes = [], command = deferred(), replay = deferred();
  const sendCommand = vi.fn(() => command.promise), loadReplay = vi.fn(() => replay.promise);
  const controller = new NavigationController({ publish: vi.fn(), sendCommand, loadReplay });
  if (authenticated) controller.setIdentity(1);
  controller.start({ read: () => href, write: (url, mode) => { href = 'http://app.local' + url; writes.push({ url, mode }); } });
  const accept = (snapshot, extra = {}) => controller.setSession({ snapshot, status: 'ready', pending: null, ...extra });
  const location = path => { href = 'http://app.local' + path; controller.locationChanged(href); };
  return { controller, accept, location, writes, sendCommand, loadReplay, command, replay, url: () => new URL(href).pathname + new URL(href).search };
}

describe('navigation policy', () => {
  it.each(['/game?game=other', '/room-waiting?room=other', '/search?search=1'])(
    'treats stale session URLs as a view request: %s', path => {
      const intent = parseLocation(path);
      expect(projectNavigation(idle, intent).url).toBe('/lobby');
      expect(projectNavigation(game, intent).url).toBe('/game?game=game-1');
    });
  it('forces live player and spectator screens even for browse or replay intents', () => {
    expect(projectNavigation(game, { kind: 'browse', tab: 'shop' }).screen).toBe('game');
    const watching = { ...idle, phase: 'spectating', spectate: { roomId: 'r', gameId: 'g' } };
    expect(projectNavigation(watching, { kind: 'replay', id: 4 }).url).toBe('/game?watch=r&game=g');
    expect(projectNavigation({ ...watching, spectate: { roomId: 'r' } }, { kind: 'session' }).url).toBe('/room-waiting?watch=r');
  });
  it.each(['/replay?id=-1', '/replay?id=1.2', '/replay?id=9007199254740992', '/missing'])(
    'rejects invalid locations: %s', path => expect(parseLocation(path)).toMatchObject({ tab: 'lobby', invalid: true }));
});

describe('navigation coordination', () => {
  it('preserves a deep link through authentication and the first snapshot', () => {
    const h = harness('/shop', false);
    expect(h.url()).toBe('/shop');
    h.controller.setIdentity(1);
    expect(h.writes).toEqual([]);
    h.accept(idle);
    expect(h.controller.state).toMatchObject({ tab: 'shop', screen: 'none', url: '/shop' });
  });
  it('normalizes stale IDs without issuing a membership command', () => {
    const h = harness('/game?game=other'); h.accept(game);
    expect(h.url()).toBe('/game?game=game-1');
    h.location('/shop');
    expect(h.url()).toBe('/game?game=game-1');
    expect(h.sendCommand).not.toHaveBeenCalled();
  });
  it('projects membership into browse URLs and preserves minimized views on reload', () => {
    const h = harness('/shop?room=stale'); h.accept(room);
    expect(h.controller.state).toMatchObject({ screen: 'none', tab: 'shop', url: '/shop?room=room-1' });
    const reloaded = harness(h.url()); reloaded.accept(room);
    expect(reloaded.controller.state.screen).toBe('none');
    h.controller.openSession(); expect(h.url()).toBe('/room-waiting?room=room-1');
    h.controller.browse('friends'); expect(h.url()).toBe('/friends?room=room-1');
    h.accept(search); expect(h.url()).toBe('/search?search=1');
    h.controller.browse('friends'); expect(h.url()).toBe('/friends?search=1');
  });
  it('handles Back/Forward intents without duplicating history on snapshot ticks', () => {
    const h = harness(); h.accept(idle);
    h.controller.browse('shop'); h.controller.browse('profile');
    expect(h.writes.map(w => w.mode)).toEqual(['push', 'push']);
    h.location('/shop'); expect(h.controller.state.tab).toBe('shop');
    h.location('/profile'); expect(h.controller.state.tab).toBe('profile');
    h.accept({ ...idle, sequence: 20 }); h.accept({ ...idle, sequence: 21 });
    expect(h.writes).toHaveLength(2);
  });
  it('lets server transitions replace the current route and cancels stale resources', async () => {
    const h = harness('/replay?id=12'); h.accept(idle);
    expect(h.controller.state.loading).toBe(true);
    h.accept(game);
    h.replay.resolve({ id: 12 }); await flush();
    expect(h.controller.state).toMatchObject({ screen: 'game', replayData: null, replayId: null, loading: false });
    expect(h.url()).toBe('/game?game=game-1');
    h.accept({ ...idle, serverId: 'restarted' }); expect(h.url()).toBe('/lobby');
  });
  it('ignores replay completion after another replay or browsing', async () => {
    const h = harness(); h.accept(idle);
    const next = deferred();
    h.loadReplay.mockReturnValueOnce(h.replay.promise).mockReturnValueOnce(next.promise);
    h.controller.openReplay(1); h.controller.openReplay(2);
    next.resolve({ id: 2 }); await flush();
    h.replay.resolve({ id: 1 }); await flush();
    expect(h.controller.state.replayData).toEqual({ id: 2 });
    h.controller.closeReplay();
    expect(h.controller.state).toMatchObject({ replayData: null, screen: 'none' });
  });
  it('reports replay failure once without retrying on every snapshot', async () => {
    const h = harness('/replay?id=1'); h.accept(idle);
    h.replay.reject(new Error('Replay unavailable')); await flush();
    h.accept(idle); h.accept(idle);
    expect(h.loadReplay).toHaveBeenCalledTimes(1);
    expect(h.controller.state).toMatchObject({ loading: false, error: 'Replay unavailable' });
  });
  it('waits for authentication and recovery before joining an invitation exactly once', async () => {
    const h = harness('/join/abcdef', false);
    h.controller.setIdentity(1); h.accept(idle, { status: 'syncing' });
    expect(h.sendCommand).not.toHaveBeenCalled();
    h.accept(idle); h.accept(idle);
    expect(h.sendCommand).toHaveBeenCalledExactlyOnceWith('room:join', { code: 'ABCDEF' });
    h.accept(room); h.command.resolve({ ok: true }); await flush();
    expect(h.url()).toBe('/room-waiting?room=room-1');
    expect(h.controller.state.loading).toBe(false);
  });
  it('does not join another invitation while already occupied', () => {
    const h = harness('/join/ABCDEF'); h.accept(game);
    expect(h.sendCommand).not.toHaveBeenCalled();
    expect(h.url()).toBe('/game?game=game-1');
    expect(h.controller.state.error).toMatch(/Leave your current session/);
  });
  it.each(['rejected', 'thrown'])('terminates a failed invitation (%s) without looping', async kind => {
    const h = harness('/join/ABCDEF'); h.accept(idle);
    if (kind === 'rejected') h.command.resolve({ ok: false, error: 'Room expired' });
    else h.command.reject(new Error('Network unavailable'));
    await flush(); h.accept(idle);
    expect(h.sendCommand).toHaveBeenCalledTimes(1);
    expect(h.url()).toBe('/lobby'); expect(h.controller.state.error).toBeTruthy();
  });
  it('does not let invitation rejection overwrite newer navigation', async () => {
    const h = harness('/join/ABCDEF'); h.accept(idle); h.controller.browse('shop');
    h.command.resolve({ ok: false, error: 'Room expired' }); await flush();
    expect(h.controller.state).toMatchObject({ tab: 'shop', error: null, url: '/shop' });
  });
  it('clears the old session and replay on identity change', async () => {
    const h = harness('/replay?id=1'); h.accept(idle);
    h.controller.setIdentity(null);
    expect(h.url()).toBe('/auth');
    h.controller.setIdentity(2); h.replay.resolve({ id: 1 }); await flush();
    expect(h.controller.state).toMatchObject({ screen: 'none', replayData: null });
    expect(h.controller.session.snapshot).toBeNull();
    h.accept(room); expect(h.url()).toBe('/lobby?room=room-1');
  });
  it('does not discard location on a same-user credential refresh', () => {
    const h = harness('/shop'); h.accept(room); h.controller.setIdentity(1);
    expect(h.url()).toBe('/shop?room=room-1');
  });
  it('ignores responses after disposal', async () => {
    const h = harness('/replay?id=1'); h.accept(idle); h.controller.stop();
    const state = h.controller.state;
    h.replay.resolve({ id: 1 }); await flush();
    expect(h.controller.state).toBe(state);
  });
});
