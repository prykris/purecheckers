import { GameLogFeed } from '../src/lib/gameLogFeed.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const game = id => ({ id, redPlayerId: 1, blackPlayerId: 2, result: 'RED_WIN' });
let feed, request, states, identity, listeners, socket;
beforeEach(() => {
  identity = { id: 1, generation: 1, token: 'token-1' }; states = []; listeners = new Map();
  socket = { on: vi.fn((name, fn) => listeners.set(name, fn)), off: vi.fn((name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); }) };
  request = vi.fn().mockResolvedValue({ games: [game(1)] });
  feed = new GameLogFeed({ request, isCurrent: scope => scope.generation === identity.generation, publish: value => states.push(value) });
  feed.setQuery(false, { ...identity });
});
afterEach(() => { feed.dispose(); vi.useRealTimers(); });
const settled = async () => { await vi.waitFor(() => expect(feed.reading).toBe(false), { interval: 1 }); };

it('subscribes before reading, then coalesces hints into one newer read', async () => {
  const first = deferred(); request.mockReturnValueOnce(first.promise);
  feed.start(socket);
  expect(socket.on.mock.invocationCallOrder.at(-1)).toBeLessThan(request.mock.invocationCallOrder[0]);
  listeners.get('global:game-ended')(); listeners.get('global:game-ended')(); listeners.get('connect')();
  expect(request).toHaveBeenCalledTimes(1);
  request.mockResolvedValue({ games: [game(2), game(1)] }); first.resolve({ games: [game(1)] });
  await settled(); expect(request).toHaveBeenCalledTimes(2);
  expect(states.at(-1).data.map(g => g.id)).toEqual([2, 1]);
});

it('uses the existing private endpoint and preserves the canonical result separately from the account result', async () => {
  feed.setQuery(true, { ...identity });
  request.mockResolvedValue({ games: [{ ...game(1), result: 'win', resultCode: 'RED_WIN' }] });
  feed.start(socket); await settled();
  expect(request).toHaveBeenCalledWith('/auth/history', expect.objectContaining({ authToken: 'token-1' }));
  expect(states.at(-1).data[0].result).toBe('RED_WIN');
});

it('drops an old response immediately when the view or account changes', async () => {
  const old = deferred(); request.mockReturnValueOnce(old.promise); feed.start(socket);
  identity = { id: 3, generation: 2, token: 'token-3' };
  request.mockResolvedValue({ games: [{ ...game(3), redPlayerId: 3 }] });
  feed.setQuery(true, { ...identity }); await settled();
  old.resolve({ games: [game(1)] }); await Promise.resolve(); await Promise.resolve();
  expect(states.at(-1).data.map(g => g.id)).toEqual([3]);
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
});

it('does not reuse private data for the public filter and does not send a bearer token publicly', async () => {
  feed.setQuery(true, { ...identity }); feed.start(socket); await settled();
  const next = deferred(); request.mockReturnValueOnce(next.promise); feed.setQuery(false, { ...identity });
  expect(states.at(-1)).toMatchObject({ data: null, status: 'loading' });
  expect(request).toHaveBeenLastCalledWith('/leaderboard/games', expect.objectContaining({ authToken: null }));
  next.resolve({ games: [] }); await settled();
  expect(states.at(-1)).toMatchObject({ data: [], status: 'ready' });
});

it('retains confirmed rows on failed refresh and recovers through Retry', async () => {
  feed.start(socket); await settled(); request.mockRejectedValueOnce(Error('offline'));
  await feed.refresh(); expect(states.at(-1)).toMatchObject({ data: [game(1)], status: 'error' });
  request.mockResolvedValue({ games: [game(2)] }); await feed.refresh();
  expect(states.at(-1)).toMatchObject({ data: [game(2)], status: 'ready', error: null });
});

it('removes listeners and rejects completion after unmount, even when abort is ignored', async () => {
  const old = deferred(); request.mockReturnValueOnce(old.promise); feed.start(socket);
  feed.dispose(); const count = states.length;
  expect(listeners.size).toBe(0); expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  old.resolve({ games: [game(9)] }); await Promise.resolve(); await Promise.resolve();
  expect(states).toHaveLength(count);
});

it('uses a renewed token on the next private refresh without discarding visible data', async () => {
  feed.setQuery(true, { ...identity }); feed.start(socket); await settled();
  feed.setQuery(true, { ...identity, token: 'renewed' }); expect(request).toHaveBeenCalledTimes(1);
  await feed.refresh(); expect(request.mock.calls[1][1].authToken).toBe('renewed');
});

it.each([null, {}, { games: [null] }, { games: [{ id: 1 }] }])('exposes malformed responses as errors rather than empty history: %j', async data => {
  request.mockResolvedValue(data); feed.start(socket); await settled();
  expect(states.at(-1)).toMatchObject({ data: null, status: 'error' });
});
