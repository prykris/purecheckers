import { watchPuzzleDay } from '../src/lib/puzzle/dayChange.js';

const stops = [];
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-10T23:59:59Z')); });
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.useRealTimers(); });
const watch = (change, target = new EventTarget()) => { stops.push(watchPuzzleDay(change, target)); return target; };

it('retries a failed midnight reload when connectivity returns and commits the day only after success', async () => {
  const change = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const target = watch(change);
  await vi.advanceTimersByTimeAsync(1000);
  expect(change).toHaveBeenCalledTimes(1);
  target.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0);
  expect(change).toHaveBeenCalledTimes(2);
  target.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(30000);
  expect(change).toHaveBeenCalledTimes(2);
});

it('coalesces focus/online during a reload and retries failures on its bounded timer', async () => {
  let reject;
  const change = vi.fn().mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail; }))
    .mockResolvedValue(undefined);
  const target = watch(change);
  await vi.advanceTimersByTimeAsync(1000);
  target.dispatchEvent(new Event('focus')); target.dispatchEvent(new Event('online'));
  expect(change).toHaveBeenCalledTimes(1);
  reject(new Error('failed')); await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(29999); expect(change).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); expect(change).toHaveBeenCalledTimes(2);
});

it('handles suspended tabs and disposal while a reload is outstanding', async () => {
  let resolve;
  const change = vi.fn(() => new Promise(done => { resolve = done; }));
  const target = watch(change);
  vi.setSystemTime(new Date('2026-09-13T12:00:00Z'));
  target.dispatchEvent(new Event('focus'));
  expect(change).toHaveBeenCalledTimes(1);
  stops.pop()(); resolve(); await vi.advanceTimersByTimeAsync(0);
  target.dispatchEvent(new Event('online')); target.dispatchEvent(new Event('focus'));
  expect(change).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
