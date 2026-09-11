import { ReadResource } from '../src/lib/readResource.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture(load, timeoutMs = 15000) {
  let generation = 0, state;
  const resource = new ReadResource({ load, timeoutMs, readScope: () => ({ generation }), isCurrent: scope => scope.generation === generation, publish: value => { state = value; } });
  return { resource, replace: () => { generation++; resource.reset(); }, state: () => state };
}

it('rejects an older response even when the transport ignores cancellation', async () => {
  const old = deferred(), fresh = deferred(), signals = [];
  const load = vi.fn(({ signal }) => { signals.push(signal); return signals.length === 1 ? old.promise : fresh.promise; });
  const h = fixture(load);
  const first = h.resource.refresh(), second = h.resource.refresh();
  expect(signals[0].aborted).toBe(true);
  fresh.resolve({ pending: [] }); expect(await second).toBe(true);
  old.resolve({ pending: [1] }); expect(await first).toBe(false);
  expect(h.state()).toEqual({ data: { pending: [] }, status: 'ready', error: null });
  h.resource.dispose();
});

it('does not let an obsolete failure replace a successful newer read', async () => {
  const old = deferred(), load = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValueOnce({ value: 2 });
  const h = fixture(load), first = h.resource.refresh();
  await h.resource.refresh(); old.reject(Error('old failure')); await first;
  expect(h.state()).toEqual({ data: { value: 2 }, status: 'ready', error: null }); h.resource.dispose();
});

it.each(['replace', 'dispose'])('discards pending work after %s, including reused credentials', async mode => {
  const pending = deferred(), h = fixture(() => pending.promise), first = h.resource.refresh();
  if (mode === 'replace') h.replace(); else h.resource.dispose();
  const state = h.state(); pending.resolve({ private: 'old account' });
  expect(await first).toBe(false); expect(h.state()).toBe(state);
  if (mode === 'dispose') expect(await h.resource.refresh()).toBe(false);
  h.resource.dispose();
});

it('retains the last successful view on failure and permits a successful retry', async () => {
  const load = vi.fn().mockResolvedValueOnce({ value: 1 }).mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({ value: 3 });
  const h = fixture(load);
  await h.resource.refresh(); expect(await h.resource.refresh()).toBe(false);
  expect(h.state()).toEqual({ data: { value: 1 }, status: 'error', error: 'offline' });
  expect(await h.resource.refresh()).toBe(true); expect(h.state()).toEqual({ data: { value: 3 }, status: 'ready', error: null });
  h.resource.dispose();
});

it('times out a failed fetch with recoverable feedback instead of a permanent loading state', async () => {
  vi.useFakeTimers();
  const h = fixture(({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('aborted')))), 50);
  try {
    const result = h.resource.refresh(); await vi.advanceTimersByTimeAsync(50);
    expect(await result).toBe(false); expect(h.state()).toEqual({ data: null, status: 'error', error: 'Loading timed out. Please retry.' });
  } finally { h.resource.dispose(); vi.useRealTimers(); }
});

it('finishes an ignored-abort timeout and permits Retry before the old response arrives', async () => {
  vi.useFakeTimers();
  const old = deferred(), load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce({ value: 'current' });
  const h = fixture(load, 50);
  try {
    const result = h.resource.refresh(); await vi.advanceTimersByTimeAsync(50);
    expect(await result).toBe(false); expect(h.state().status).toBe('error');
    expect(await h.resource.refresh()).toBe(true);
    old.resolve({ value: 'obsolete' }); await Promise.resolve(); await Promise.resolve();
    expect(h.state()).toEqual({ data: { value: 'current' }, status: 'ready', error: null });
    expect(vi.getTimerCount()).toBe(0);
  } finally { h.resource.dispose(); vi.useRealTimers(); }
});

it('settles disposal without requiring the abandoned load to return', async () => {
  const h = fixture(() => new Promise(() => {}));
  const result = h.resource.refresh(); h.resource.dispose();
  expect(await result).toBe(false);
});

it('handles an empty rejection reason as an ordinary load failure', async () => {
  const h = fixture(() => Promise.reject(null));
  expect(await h.resource.refresh()).toBe(false);
  expect(h.state()).toMatchObject({ status: 'error', error: 'Could not load. Please retry.' });
  h.resource.dispose();
});
