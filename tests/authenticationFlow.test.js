import { AuthenticationFlow } from '../src/lib/authenticationFlow.js';
import { AccountSession } from '../src/lib/accountSession.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const credentials = id => ({ token: `token-${id}`, user: { id, profileVersion: 1 } });
function setup() {
  const account = new AccountSession({ publish: () => {} });
  const api = { get: vi.fn(async () => ({ name: 'Suggested' })), post: vi.fn(async () => credentials(1)) };
  const publish = vi.fn(), onGuestCreated = vi.fn();
  const flow = new AuthenticationFlow({ api, beginAuthentication: () => account.beginAuthentication(),
    establishSession: (data, scope) => account.establish(data, scope), isCurrentSession: scope => account.current(scope), publish, onGuestCreated });
  return { flow, account, api, publish, onGuestCreated };
}
afterEach(() => vi.useRealTimers());

it('submits one captured payload, establishes through the account owner and tracks its original entry source', async () => {
  const h = setup(), response = deferred(); h.api.post.mockReturnValue(response.promise);
  const pending = h.flow.submit({ guestName: 'Chosen' }, 'invite');
  expect(await h.flow.submit({ guestName: 'Duplicate' })).toBe(false);
  expect(h.api.post).toHaveBeenCalledOnce();
  expect(h.api.post).toHaveBeenCalledWith('/guest', { username: 'Chosen' }, expect.objectContaining({ authToken: null, signal: expect.any(AbortSignal) }));
  response.resolve(credentials(1)); expect(await pending).toBe(true);
  expect(h.account.user.id).toBe(1); expect(h.onGuestCreated).toHaveBeenCalledWith('invite');
  expect(h.flow.state.loading).toBe(false);
});

it.each(['view', 'dispose', 'account'])('ignores authentication completed after %s changes, even when transport ignores abort', async cause => {
  const h = setup(), response = deferred(); h.api.post.mockReturnValue(response.promise);
  const pending = h.flow.submit({ guestName: 'First' });
  if (cause === 'view') h.flow.switchView('login');
  if (cause === 'dispose') h.flow.dispose();
  if (cause === 'account') h.account.establish(credentials(2));
  response.resolve(credentials(1)); expect(await pending).toBe(false);
  expect(h.account.user?.id).toBe(cause === 'account' ? 2 : undefined);
  expect(h.onGuestCreated).not.toHaveBeenCalled();
});

it('cannot let an obsolete failure clear a newer request or publish an error on another form', async () => {
  const h = setup(), first = deferred(), second = deferred();
  h.api.post.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const old = h.flow.submit({ guestName: 'First' });
  h.flow.switchView('login'); const current = h.flow.submit({ email: 'a@example.test', password: 'secret' });
  first.reject(Error('Old failure')); await old;
  expect(h.flow.state).toMatchObject({ loading: true, error: '', view: 'login' });
  second.resolve(credentials(2)); await current; expect(h.account.user.id).toBe(2);
});

it('leaves typed names untouched and ignores suggestions after submission or navigation', async () => {
  for (const cause of ['typing', 'submit', 'view', 'dispose']) {
    const h = setup(), response = deferred(), apply = vi.fn(); let untouched = true;
    h.api.get.mockReturnValue(response.promise);
    const suggested = h.flow.suggestName({ untouched: () => untouched, apply });
    if (cause === 'typing') untouched = false;
    if (cause === 'submit') await h.flow.submit({ guestName: 'Picked' });
    if (cause === 'view') h.flow.switchView('register');
    if (cause === 'dispose') h.flow.dispose();
    response.resolve({ name: 'Late suggestion' }); await suggested;
    expect(apply).not.toHaveBeenCalled();
  }
});

it.each(['guest', 'login', 'register'])('unlocks %s after a deadline and allows an explicit next attempt', async view => {
  vi.useFakeTimers(); const h = setup(); h.flow.switchView(view);
  h.api.post.mockImplementationOnce((path, body, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true })));
  const pending = h.flow.submit({ email: 'a@example.test', password: 'secret' });
  await vi.advanceTimersByTimeAsync(15_000); expect(await pending).toBe(false);
  expect(h.flow.state.loading).toBe(false);
  expect(h.flow.state.error).toMatch(view === 'register' ? /Try signing in/ : /timed out/);
  expect(h.account.token).toBeNull();
  if (view === 'register') h.flow.switchView('login');
  expect(await h.flow.submit({ email: 'a@example.test', password: 'secret' })).toBe(true);
});

it('reports invalid account responses without establishing credentials', async () => {
  const h = setup(); h.api.post.mockResolvedValue({ token: 'invalid', user: { id: 1 } });
  expect(await h.flow.submit({})).toBe(false);
  expect(h.account.token).toBeNull(); expect(h.flow.state.error).toMatch(/Invalid account response/);
});
