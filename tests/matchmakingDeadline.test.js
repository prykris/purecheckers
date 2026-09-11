import { getOrCreateSession, setPhase, setMatchmakingDeadline, removeSession, getSession } from '../server/domain/sessions.js';

let now, timers, published;
const userId = 873001;
function create() { getOrCreateSession(userId, 'Deadline test', true); setPhase(userId, 'matchmaking'); }
beforeEach(() => {
  now = 1000; timers = []; published = vi.fn();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay) => {
    const timer = { callback, delay, unref: vi.fn() }; timers.push(timer); return timer;
  });
  vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {});
  create();
});
afterEach(() => { removeSession(userId); vi.restoreAllMocks(); });

it('rearms an early wakeup and publishes once when the server deadline actually arrives', () => {
  setMatchmakingDeadline(userId, 1000, 1100, published);
  expect(timers[0].delay).toBe(100);
  now = 1099; timers[0].callback();
  expect(published).not.toHaveBeenCalled();
  expect(timers[1].delay).toBe(1);
  expect(getSession(userId).fallbackTimer).toBe(timers[1]);
  now = 1100; timers[1].callback();
  expect(published).toHaveBeenCalledExactlyOnceWith(userId);
  expect(getSession(userId).fallbackTimer).toBeNull();
  timers[1].callback();
  expect(published).toHaveBeenCalledTimes(1);
});

it('keeps waiting if wall time moved backward and accepts a late wakeup', () => {
  setMatchmakingDeadline(userId, 1000, 1100, published);
  now = 900; timers[0].callback();
  expect(published).not.toHaveBeenCalled();
  expect(timers[1].delay).toBe(200);
  now = 1300; timers[1].callback();
  expect(published).toHaveBeenCalledExactlyOnceWith(userId);
});

it('ignores a replaced search callback even when both deadline timestamps are identical', () => {
  setMatchmakingDeadline(userId, 1000, 1100, published);
  const replacement = vi.fn();
  setMatchmakingDeadline(userId, 1000, 1100, replacement);
  now = 1100; timers[0].callback();
  expect(published).not.toHaveBeenCalled();
  expect(getSession(userId).fallbackTimer).toBe(timers[1]);
  timers[1].callback();
  expect(replacement).toHaveBeenCalledExactlyOnceWith(userId);
});

it('cancels the rearmed timer when matchmaking ends', () => {
  setMatchmakingDeadline(userId, 1000, 1100, published);
  now = 1099; timers[0].callback();
  setPhase(userId, 'idle');
  expect(clearTimeout).toHaveBeenCalledWith(timers[1]);
  now = 1100; timers[1].callback();
  expect(published).not.toHaveBeenCalled();
  expect(getSession(userId).fallbackTimer).toBeNull();
});

it('does not publish into a new session with the same user id', () => {
  setMatchmakingDeadline(userId, 1000, 1100, published);
  removeSession(userId); create();
  now = 1100; timers[0].callback();
  expect(published).not.toHaveBeenCalled();
  expect(getSession(userId).fallbackTimer).toBeNull();
});

it('keeps already-open deadlines available to the caller without an extra timer', () => {
  expect(setMatchmakingDeadline(userId, 999, 1000, published)).toBe(true);
  expect(timers).toHaveLength(0);
  expect(getSession(userId).matchmakingFallbackAt).toBe(1000);
  expect(published).not.toHaveBeenCalled();
});

it('bounds long delays to the timer range and rechecks rather than overflowing', () => {
  const maximum = 2_147_483_647;
  setMatchmakingDeadline(userId, now, now + maximum + 10, published);
  expect(timers[0].delay).toBe(maximum);
  now += maximum; timers[0].callback();
  expect(timers[1].delay).toBe(10);
  expect(published).not.toHaveBeenCalled();
  now += 10; timers[1].callback();
  expect(published).toHaveBeenCalledExactlyOnceWith(userId);
  expect(timers.every(timer => timer.unref.mock.calls.length === 1)).toBe(true);
});
