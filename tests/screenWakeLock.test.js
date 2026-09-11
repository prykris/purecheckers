import { ScreenWakeLock } from '../src/lib/screenWakeLock.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function sentinel() {
  const lock = new EventTarget();
  lock.released = false;
  lock.release = vi.fn(async () => { lock.released = true; lock.dispatchEvent(new Event('release')); });
  return lock;
}
function fixture(request) {
  const document = new EventTarget(); document.visibilityState = 'visible';
  const owner = new ScreenWakeLock({ document, request });
  const visibility = value => { document.visibilityState = value; document.dispatchEvent(new Event('visibilitychange')); };
  return { owner, visibility, document };
}

it('deduplicates acquisition while the same invitation is visible', async () => {
  const gate = deferred(), lock = sentinel(), request = vi.fn(() => gate.promise), h = fixture(request);
  h.owner.setTarget(1); const task = h.owner.pending.task;
  h.owner.setTarget(1); h.visibility('visible'); h.visibility('visible');
  await Promise.resolve(); expect(request).toHaveBeenCalledTimes(1);
  gate.resolve(lock); await task;
  h.visibility('visible'); expect(request).toHaveBeenCalledTimes(1);
  h.owner.dispose(); await Promise.resolve(); expect(lock.release).toHaveBeenCalledOnce();
});

it.each(['dispose', 'leave', 'hide'])('releases a late acquired lock after %s', async mode => {
  const gate = deferred(), lock = sentinel(), h = fixture(() => gate.promise);
  h.owner.setTarget(1); const task = h.owner.pending.task; await Promise.resolve();
  if (mode === 'dispose') h.owner.dispose();
  else if (mode === 'leave') h.owner.setTarget(null);
  else h.visibility('hidden');
  gate.resolve(lock); await task;
  expect(lock.release).toHaveBeenCalledOnce(); expect(h.owner.held).toBeNull(); h.owner.dispose();
});

it('does not request a lock if the screen closes before acquisition starts', async () => {
  const request = vi.fn(), h = fixture(request);
  h.owner.setTarget(1); const task = h.owner.pending.task; h.owner.dispose(); await task;
  expect(request).not.toHaveBeenCalled();
});

it('does not let an old acquisition or release replace a newer visible room lock', async () => {
  const old = deferred(), a = sentinel(), b = sentinel();
  const h = fixture(vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValueOnce(b));
  h.owner.setTarget(1); const first = h.owner.pending.task; await Promise.resolve();
  h.owner.setTarget(2); await h.owner.pending.task;
  old.resolve(a); await first;
  expect(a.release).toHaveBeenCalledOnce(); expect(h.owner.held.lock).toBe(b);
  a.dispatchEvent(new Event('release')); expect(h.owner.held.lock).toBe(b);
  h.owner.dispose();
});

it('reacquires on visibility return and releases when the invitation leaves the screen', async () => {
  const a = sentinel(), b = sentinel(), request = vi.fn().mockResolvedValueOnce(a).mockResolvedValueOnce(b), h = fixture(request);
  h.owner.setTarget(1); await h.owner.pending.task;
  h.visibility('hidden'); expect(a.release).toHaveBeenCalledOnce();
  h.visibility('visible'); await h.owner.pending.task;
  expect(request).toHaveBeenCalledTimes(2);
  h.owner.setTarget(null); expect(b.release).toHaveBeenCalledOnce(); h.owner.dispose();
});

it('tolerates unavailable, refused and failed-release capabilities without blocking a later visibility retry', async () => {
  const lock = sentinel(); lock.release.mockRejectedValueOnce(Error('release refused'));
  const h = fixture(vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('permission denied')).mockResolvedValueOnce(lock));
  h.owner.setTarget(1); await h.owner.pending.task;
  expect(h.owner.held).toBeNull();
  h.visibility('hidden'); h.visibility('visible'); await h.owner.pending.task;
  expect(h.owner.held).toBeNull();
  h.visibility('hidden'); h.visibility('visible'); await h.owner.pending.task;
  expect(h.owner.held.lock).toBe(lock); h.owner.dispose(); await Promise.resolve();
  h.visibility('visible'); expect(h.owner.pending).toBeNull();
});

it('ignores a queued release event from a previously held lock', async () => {
  const a = sentinel(), b = sentinel(), request = vi.fn().mockResolvedValueOnce(a).mockResolvedValueOnce(b), h = fixture(request);
  h.owner.setTarget(1); await h.owner.pending.task;
  const oldRelease = h.owner.held.onRelease;
  h.owner.setTarget(2); await h.owner.pending.task;
  oldRelease(); expect(h.owner.held.lock).toBe(b); h.owner.dispose();
});
