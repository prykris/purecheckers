import { withDeadline } from '../src/lib/actions/deadline.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it('settles at the deadline when the transport ignores abort and never resolves', async () => {
  let signal;
  const result = withDeadline(s => { signal = s; return new Promise(() => {}); }, 'Timed out; confirm the outcome.', { timeoutMs: 50 }).catch(error => error);
  await vi.advanceTimersByTimeAsync(50);
  expect(await result).toMatchObject({ name: 'TimeoutError', message: 'Timed out; confirm the outcome.' });
  expect(signal.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
});

it.each(['resolve', 'reject'])('ignores a late transport %s after timeout', async settle => {
  const work = deferred();
  const result = withDeadline(() => work.promise, 'Deadline', { timeoutMs: 10 }).catch(error => error);
  await vi.advanceTimersByTimeAsync(10); const failure = await result;
  work[settle](settle === 'resolve' ? 'late' : Error('late failure'));
  await Promise.resolve(); await Promise.resolve();
  expect(await result).toBe(failure); expect(failure.message).toBe('Deadline');
});

it('cancels immediately without waiting for an uncooperative request', async () => {
  const owner = new AbortController(); let requestSignal;
  const result = withDeadline(signal => { requestSignal = signal; return new Promise(() => {}); }, undefined, { signal: owner.signal }).catch(error => error);
  owner.abort();
  expect((await result).name).toBe('AbortError'); expect(requestSignal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not invoke work for an already-cancelled owner', async () => {
  const owner = new AbortController(); owner.abort(); const work = vi.fn();
  await expect(withDeadline(work, undefined, { signal: owner.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(work).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});

it.each(['success', 'sync failure', 'async failure'])('cleans timers and owner listeners after %s', async mode => {
  const owner = new AbortController(); const remove = vi.spyOn(owner.signal, 'removeEventListener');
  const failure = Error('network failed'); let requestSignal;
  const result = withDeadline(signal => {
    requestSignal = signal;
    if (mode === 'sync failure') throw failure;
    return mode === 'success' ? 42 : Promise.reject(failure);
  }, undefined, { signal: owner.signal });
  if (mode === 'success') expect(await result).toBe(42);
  else await expect(result).rejects.toBe(failure);
  expect(vi.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  owner.abort(); expect(requestSignal.aborted).toBe(false);
});

it('lets cancellation win when work aborts its owner and then throws synchronously', async () => {
  const owner = new AbortController();
  await expect(withDeadline(() => { owner.abort(); throw Error('late throw'); }, undefined, { signal: owner.signal }))
    .rejects.toMatchObject({ name: 'AbortError' });
  expect(vi.getTimerCount()).toBe(0);
});
