import { AppBootstrap } from '../src/lib/appBootstrap.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

it('does not let an automatic guest response replace a newer authentication attempt with the same empty token', async () => {
  const h = harness(), entered = deferred(), response = deferred();
  let accountGeneration = 0;
  h.bootstrap.readSessionGeneration = () => accountGeneration;
  h.createGuest.mockImplementation(() => { entered.resolve(); return response.promise; });
  const pending = h.bootstrap.start();
  await entered.promise;
  accountGeneration++;
  response.resolve({ token: 'obsolete-guest', user: { id: 1 } });
  await pending;
  expect(h.acceptGuest).not.toHaveBeenCalled();
  expect(h.state.loading).toBe(false);
});
function harness({ token = null, code = 'ABCDEF' } = {}) {
  const auth = { token, code }, state = {};
  const options = {
    readToken: () => auth.token, readInvite: () => auth.code,
    restoreSession: vi.fn(async () => {}), clearSession: vi.fn(() => auth.token = null),
    checkInvite: vi.fn(async () => ({ hostName: 'Chris' })),
    createGuest: vi.fn(async () => ({ token: 'guest', user: { id: 1 } })),
    acceptGuest: vi.fn(data => auth.token = data.token), abandonInvite: vi.fn(), showNotice: vi.fn(),
    publish: vi.fn(patch => Object.assign(state, patch)),
  };
  return { auth, state, ...options, bootstrap: new AppBootstrap(options) };
}

it('restores an existing identity instead of creating a guest', async () => {
  const h = harness({ token: 'existing' }); await h.bootstrap.start();
  expect(h.restoreSession).toHaveBeenCalledOnce(); expect(h.createGuest).not.toHaveBeenCalled();
  expect(h.state.loading).toBe(false);
});
it('checks the invitation before creating and accepting a guest', async () => {
  const h = harness(); await h.bootstrap.start();
  expect(h.checkInvite).toHaveBeenCalledWith('ABCDEF', { signal: expect.any(AbortSignal) }); expect(h.acceptGuest).toHaveBeenCalledOnce();
  expect(h.state).toMatchObject({ loading: false, joiningInvite: false, hostName: 'Chris' });
});
it('does not create an account for an expired invitation or a normal auth visit', async () => {
  const h = harness(); h.checkInvite.mockResolvedValue(null); await h.bootstrap.start();
  expect(h.abandonInvite).toHaveBeenCalledWith('ABCDEF'); expect(h.createGuest).not.toHaveBeenCalled();
  h.auth.code = null; await h.bootstrap.start(); expect(h.checkInvite).toHaveBeenCalledTimes(1);
});
it('ignores an invite lookup completed after navigation away', async () => {
  const h = harness(), request = deferred(); h.checkInvite.mockReturnValue(request.promise);
  const pending = h.bootstrap.start(); h.auth.code = null; request.resolve({ hostName: 'Chris' }); await pending;
  expect(h.createGuest).not.toHaveBeenCalled(); expect(h.state.loading).toBe(false);
});
it.each(['login', 'navigation', 'disposal'])('ignores a late guest response after %s', async cause => {
  const h = harness(), request = deferred(); h.createGuest.mockReturnValue(request.promise);
  const pending = h.bootstrap.start(); await Promise.resolve();
  if (cause === 'login') h.auth.token = 'registered';
  if (cause === 'navigation') h.auth.code = 'GHIJKL';
  if (cause === 'disposal') h.bootstrap.dispose();
  request.resolve({ token: 'obsolete', user: { id: 1 } }); await pending;
  expect(h.acceptGuest).not.toHaveBeenCalled();
});
it('keeps credentials on network failure and permits an explicit retry', async () => {
  const h = harness({ token: 'existing' }); h.restoreSession.mockRejectedValueOnce(new Error('offline'));
  await h.bootstrap.start(); expect(h.state.error).toMatch(/retry/); expect(h.clearSession).not.toHaveBeenCalled();
  await h.bootstrap.start(); expect(h.state.error).toBeNull(); expect(h.state.loading).toBe(false);
});
it('can replace expired credentials with a guest for a valid invite', async () => {
  const h = harness({ token: 'expired' }); h.restoreSession.mockRejectedValue({ status: 401 });
  await h.bootstrap.start(); expect(h.clearSession).toHaveBeenCalledOnce(); expect(h.acceptGuest).toHaveBeenCalledOnce();
  expect(h.state.loading).toBe(false);
});
it('offers manual authentication after automatic guest creation fails', async () => {
  const h = harness(); h.createGuest.mockRejectedValue(new Error('rate limited')); await h.bootstrap.start();
  expect(h.showNotice).toHaveBeenCalledOnce(); expect(h.state).toMatchObject({ loading: false, joiningInvite: false });
  expect(h.abandonInvite).not.toHaveBeenCalled();
});

it.each(['checkInvite', 'createGuest', 'restoreSession'])('recovers when %s exceeds its deadline', async step => {
  vi.useFakeTimers();
  try {
    const h = harness({ token: step === 'restoreSession' ? 'saved' : null });
    h[step].mockImplementationOnce((...args) => {
      const { signal } = args.at(-1);
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }));
    });
    const pending = h.bootstrap.start(); await vi.advanceTimersByTimeAsync(15_000); await pending;
    expect(h.state.loading).toBe(false); expect(h.state.joiningInvite).toBe(false);
    expect(h.acceptGuest).not.toHaveBeenCalled(); expect(h.clearSession).not.toHaveBeenCalled();
    if (step === 'restoreSession') expect(h.state.error).toMatch(/retry/);
    else expect(h.showNotice).toHaveBeenCalledOnce();
    await h.bootstrap.start(); expect(h.state.error).toBeNull();
  } finally { vi.useRealTimers(); }
});
