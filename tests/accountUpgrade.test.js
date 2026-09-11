import { createAccountUpgrade } from '../src/lib/accountUpgrade.js';

const guest = { user: { id: 7, username: 'Guest', isGuest: true } };
const registered = { user: { id: 7, username: 'Saved', isGuest: false }, token: 'registered-token' };
const credentials = { username: 'Saved', email: 'saved@example.com', password: 'secret-password' };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function setup(timeoutMs = 1000) {
  const identity = { id: 7, token: 'guest-token' };
  const api = { get: vi.fn().mockResolvedValue(guest), post: vi.fn().mockResolvedValue(registered) };
  const accept = vi.fn(data => { identity.token = data.token ?? identity.token; });
  const controller = createAccountUpgrade({ api, accept, readIdentity: () => ({ ...identity }), timeoutMs });
  return { ...controller, identity, api, accept };
}
afterEach(() => vi.useRealTimers());

it('checks the account before saving and accepts the same registered identity', async () => {
  const h = setup();
  expect(await h.save(credentials)).toMatchObject({ status: 'saved', user: registered.user });
  expect(h.api.get.mock.invocationCallOrder[0]).toBeLessThan(h.api.post.mock.invocationCallOrder[0]);
  expect(h.api.post).toHaveBeenCalledWith('/auth/upgrade', credentials, expect.objectContaining({ authToken: 'guest-token', signal: expect.any(AbortSignal) }));
  expect(h.accept).toHaveBeenCalledExactlyOnceWith(registered, expect.objectContaining({ id: 7, token: 'guest-token' }));
});

it('recovers a lost upgrade response by reading the account without repeating the write', async () => {
  const h = setup();
  h.api.get.mockResolvedValueOnce(guest).mockResolvedValueOnce(registered);
  h.api.post.mockRejectedValue(new Error('connection lost'));
  expect(await h.save(credentials)).toMatchObject({ status: 'saved' });
  expect(h.api.post).toHaveBeenCalledTimes(1);
  expect(h.accept).toHaveBeenCalledExactlyOnceWith(registered, expect.objectContaining({ id: 7, token: 'guest-token' }));
});

it('uses a renewed guest token for the save without treating its own renewal as replacement', async () => {
  const h = setup(); h.api.get.mockResolvedValue({ ...guest, token: 'renewed-guest' });
  expect(await h.save(credentials)).toMatchObject({ status: 'saved' });
  expect(h.api.post.mock.calls[0][2].authToken).toBe('renewed-guest');
  expect(h.accept).toHaveBeenLastCalledWith(registered, expect.objectContaining({ id: 7, token: 'renewed-guest' }));
});

it('confirms a previous or concurrent upgrade before submitting any new credentials', async () => {
  const h = setup(); h.api.get.mockResolvedValue(registered);
  expect(await h.save(credentials)).toMatchObject({ status: 'saved' });
  expect(h.api.post).not.toHaveBeenCalled();
});

it('confirms registration after an already-registered error', async () => {
  const h = setup();
  h.api.get.mockResolvedValueOnce(guest).mockResolvedValueOnce(registered);
  h.api.post.mockRejectedValue(Object.assign(Error('Already registered'), { status: 400 }));
  expect(await h.save(credentials)).toMatchObject({ status: 'saved' });
});

it('keeps uncertainty distinct from a confirmed validation rejection', async () => {
  const h = setup();
  h.api.post.mockRejectedValue(Object.assign(Error('Email already taken'), { status: 409 }));
  expect(await h.save(credentials)).toMatchObject({ status: 'rejected', message: 'Email already taken' });
  h.api.post.mockRejectedValue(Error('offline'));
  expect(await h.save(credentials)).toMatchObject({ status: 'pending' });
  expect(h.accept).not.toHaveBeenCalled();
});

it('does not submit credentials when the initial account read fails', async () => {
  const h = setup(); h.api.get.mockRejectedValue(Error('offline'));
  expect(await h.save(credentials)).toMatchObject({ status: 'pending' });
  expect(h.api.post).not.toHaveBeenCalled();
});

it('supports a read-only status check after an uncertain save', async () => {
  const h = setup();
  expect(await h.recover()).toMatchObject({ status: 'pending' });
  h.api.get.mockResolvedValue(registered);
  expect(await h.recover()).toMatchObject({ status: 'saved' });
  expect(h.api.post).not.toHaveBeenCalled();
});

it('coalesces overlapping saves instead of submitting two password changes', async () => {
  const h = setup(), waiting = deferred(); h.api.get.mockReturnValue(waiting.promise);
  const first = h.save(credentials);
  expect(h.save({ ...credentials, password: 'different' })).toBe(first);
  waiting.resolve(guest); await first;
  expect(h.api.post).toHaveBeenCalledTimes(1);
  expect(h.api.post.mock.calls[0][1]).toEqual(credentials);
});

it.each(['read', 'write', 'confirmation'])('ignores %s responses after logout/account replacement', async phase => {
  const h = setup(), waiting = deferred();
  if (phase === 'read') h.api.get.mockReturnValue(waiting.promise);
  if (phase === 'write') h.api.post.mockReturnValue(waiting.promise);
  if (phase === 'confirmation') {
    h.api.post.mockRejectedValue(Error('lost'));
    h.api.get.mockResolvedValueOnce(guest).mockReturnValueOnce(waiting.promise);
  }
  const saving = h.save(credentials);
  // Let the requested phase start without advancing the timeout clock.
  await vi.waitFor(() => expect(phase === 'write' ? h.api.post : h.api.get).toHaveBeenCalledTimes(phase === 'confirmation' ? 2 : 1), { interval: 1 });
  h.identity.id = 8; h.identity.token = 'another-token';
  waiting.resolve(registered);
  expect(await saving).toEqual({ status: 'superseded' });
  expect(h.accept).not.toHaveBeenCalled();
});

it('rejects malformed and cross-account confirmation responses', async () => {
  const h = setup();
  for (const data of [null, { user: { ...registered.user, id: 8 } }, { user: { id: 7 } }]) {
    h.api.get.mockResolvedValue(data);
    expect(await h.save(credentials)).toMatchObject({ status: 'pending' });
  }
  expect(h.api.post).not.toHaveBeenCalled(); expect(h.accept).not.toHaveBeenCalled();
});

it('bounds a hanging request and ignores its eventual response', async () => {
  vi.useFakeTimers();
  const h = setup(10), waiting = deferred(); h.api.get.mockReturnValue(waiting.promise);
  const result = h.save(credentials);
  await vi.advanceTimersByTimeAsync(11);
  expect(await result).toMatchObject({ status: 'pending' });
  expect(h.api.get.mock.calls[0][1].signal.aborted).toBe(true);
  waiting.resolve(registered); await Promise.resolve();
  expect(h.accept).not.toHaveBeenCalled(); expect(h.api.post).not.toHaveBeenCalled();
});

it('aborts pending requests when the owning sheet is destroyed', async () => {
  const h = setup(), waiting = deferred(); h.api.get.mockReturnValue(waiting.promise);
  const result = h.save(credentials); h.dispose();
  expect(await result).toEqual({ status: 'superseded' });
  expect(h.api.get.mock.calls[0][1].signal.aborted).toBe(true);
  expect(await h.recover()).toEqual({ status: 'superseded' });
  expect(h.accept).not.toHaveBeenCalled();
});

it('ignores an upgrade response after the same account and token enter a new session generation', async () => {
  const h = setup(), waiting = deferred();
  h.identity.generation = 1;
  h.api.get.mockReturnValue(waiting.promise);
  const result = h.recover();
  h.identity.generation = 2;
  waiting.resolve(registered);
  expect(await result).toEqual({ status: 'superseded' });
  expect(h.accept).not.toHaveBeenCalled();
});

it('lets a replacement account save immediately while its disposed predecessor has an unresolved request', async () => {
  const previous = setup(), waiting = deferred();
  previous.api.get.mockReturnValue(waiting.promise);
  const abandoned = previous.save(credentials);
  previous.dispose();
  const next = setup(); next.identity.id = 8; next.identity.token = 'new-account-token';
  const nextUser = { ...registered.user, id: 8, username: 'NewAccount' };
  next.api.get.mockResolvedValue({ user: { ...guest.user, id: 8 } });
  next.api.post.mockResolvedValue({ user: nextUser, token: 'new-registered-token' });
  expect(await next.save({ ...credentials, username: 'NewAccount' })).toMatchObject({ status: 'saved', user: nextUser });
  waiting.resolve(registered);
  expect(await abandoned).toEqual({ status: 'superseded' });
  expect(previous.accept).not.toHaveBeenCalled(); expect(previous.api.post).not.toHaveBeenCalled();
  expect(next.accept).toHaveBeenCalledTimes(1);
});
