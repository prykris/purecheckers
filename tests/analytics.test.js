import { createAnalyticsTracker, track as browserTrack } from '../src/lib/analytics.js';
import { GameAnalytics } from '../src/lib/gameAnalytics.js';
import { CheckersGame } from '../shared/game.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

let gtag, track, callbacks, transport;
beforeEach(() => {
  vi.useFakeTimers(); callbacks = [];
  gtag = vi.fn((command, target, field, callback) => { if (command === 'get') callbacks.push(callback); });
  transport = { gtag, target: 'G-TEST', location: 'https://purecheckers.com/game' };
  track = createAnalyticsTracker({ readTransport: () => transport });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const events = () => gtag.mock.calls.filter(([command]) => command === 'event');

it.each([1, '1', 2, '12'])('uses GA4 session number %j without retaining a stale cohort', number => {
  track('game_end', { result: 'win' });
  expect(gtag).toHaveBeenCalledWith('get', 'G-TEST', 'session_number', expect.any(Function));
  callbacks[0](number);
  expect(events()[0]).toEqual(['event', 'game_end', {
    page_location: transport.location, result: 'win', cohort_status: 'known', first_session: Number(number) === 1
  }]);
  track('game_start'); callbacks[1](3);
  expect(events()[1][2].first_session).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('preserves invocation order, route and parameter values during an asynchronous lookup', () => {
  const params = { source: 'bot' };
  track('game_start', params); track('first_move'); track('share', { method: 'copy' });
  params.source = 'wrong'; transport.location = 'https://purecheckers.com/profile';
  expect(events()).toHaveLength(0);
  expect(callbacks).toHaveLength(1);
  callbacks[0](1);
  expect(events().map(([, name]) => name)).toEqual(['game_start', 'first_move', 'share']);
  expect(events()[0][2]).toMatchObject({ source: 'bot', page_location: 'https://purecheckers.com/game' });
  expect(events()[2][2]).not.toHaveProperty('first_session');
});

it.each([undefined, null, false, true, 0, -1, 1.5, '', 'bad', '1.5', Infinity])('reports unknown rather than inventing a cohort for %j', value => {
  track('game_end', { first_session: true }); callbacks[0](value);
  expect(events()[0][2]).toMatchObject({ cohort_status: 'unknown' });
  expect(events()[0][2]).not.toHaveProperty('first_session');
});

it('times out once and ignores callbacks from expired lookups without flushing newer work', () => {
  track('game_start'); vi.advanceTimersByTime(250);
  expect(events()).toHaveLength(1);
  expect(events()[0][2].cohort_status).toBe('unknown');
  track('game_end'); callbacks[0](1);
  expect(events()).toHaveLength(1);
  callbacks[1](2); callbacks[1](1); vi.advanceTimersByTime(1000);
  expect(events()).toHaveLength(2);
  expect(events()[1][2].first_session).toBe(false);
});

it('bounds queued events if the installed tag never loads', () => {
  for (let i = 0; i < 64; i++) track('game_start', { order: i });
  expect(events()).toHaveLength(64);
  expect(events().map(([, , p]) => p.order)).toEqual(Array.from({ length: 64 }, (_, i) => i));
  expect(events().every(([, , p]) => p.cohort_status === 'unknown')).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  callbacks[0](1); expect(events()).toHaveLength(64);
});

it('keeps measurement targets separate during pending lookups', () => {
  track('game_start'); transport = { ...transport, target: 'G-OTHER' };
  track('game_end'); callbacks[0](1); callbacks[1](2);
  expect(events().map(([, , p]) => p.cohort_status)).toEqual(['unknown', 'known']);
  expect(events()[1][2].first_session).toBe(false);
});

it('does not delay ordinary events and isolates absent or throwing transports', () => {
  track('share'); expect(events()).toHaveLength(1); expect(callbacks).toHaveLength(0);
  transport = null; expect(() => track('game_start')).not.toThrow();
  const broken = createAnalyticsTracker({ readTransport: () => { throw new Error('Unavailable'); } });
  expect(() => broken('game_end')).not.toThrow();
  transport = { target: 'G-TEST', gtag: vi.fn(() => { throw new Error('Tag failed'); }) };
  expect(() => track('game_start')).not.toThrow(); expect(vi.getTimerCount()).toBe(0);
});

it('adds cohorts to actual accepted lifecycle events without moving authority into analytics', () => {
  const observer = new GameAnalytics({ track, storage: () => null }); observer.bind(1);
  const accept = snapshot => observer.observe({ status: 'ready', snapshot });
  accept({ phase: 'idle' });
  const engine = new CheckersGame();
  const game = { gameId: 'one', origin: 'bot', yourColor: 'red', started: true, moveHistory: [] };
  accept({ phase: 'in-game', game });
  engine.makeMove(5, 2, 4, 3);
  accept({ phase: 'in-game', game: { ...game, moveHistory: engine.moveHistory } });
  accept({ phase: 'in-game', game: { ...game, moveHistory: engine.moveHistory, gameOver: true, winner: 'red' } });
  callbacks[0](1);
  expect(events().map(([, name]) => name)).toEqual(['game_start', 'first_move', 'game_end']);
  expect(events().every(([, , p]) => p.first_session === true)).toBe(true);
  expect(game.moveHistory).toEqual([]);
});

it('reads the configured browser tag target and safely does nothing during SSR', () => {
  browserTrack('share'); // Node has no browser globals.
  vi.stubGlobal('window', { gtag, location: { href: 'https://purecheckers.com/game' } });
  vi.stubGlobal('document', { getElementById: id => id === 'google-tag'
    ? { src: 'https://www.googletagmanager.com/gtag/js?id=G-BROWSER' } : null });
  browserTrack('game_end');
  expect(gtag).toHaveBeenCalledWith('get', 'G-BROWSER', 'session_number', expect.any(Function));
  callbacks[0](1);
  expect(events()[0][2].first_session).toBe(true);
});

it('initializes the tag from the same script URL used by the reporting boundary', () => {
  const html = readFileSync(new URL('../src/app.html', import.meta.url), 'utf8');
  const src = html.match(/<script id="google-tag" async src="([^"]+)"/)[1];
  const init = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const context = { URL, Date, document: { getElementById: id => id === 'google-tag' ? { src } : null } };
  context.window = context;
  runInNewContext(init, context);
  expect(Array.from(context.dataLayer[1])).toEqual(['config', new URL(src).searchParams.get('id')]);
});
