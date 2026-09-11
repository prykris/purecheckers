import { withDeadline } from './actions/deadline.js';

// Account conversion has one durable outcome: this same user is registered.
// Confirm that outcome through /me before retrying; never persist credentials.
export function createAccountUpgrade({ api, readIdentity, accept, timeoutMs = 15_000 }) {
  let running = null, disposed = false;
  const requests = new Set();

  async function request(identity, method, path, body) {
    const controller = new AbortController();
    requests.add(controller);
    try {
      return await withDeadline(signal => method === 'get' ? api.get(path, { signal, authToken: identity.token })
        : api.post(path, body, { signal, authToken: identity.token }), 'Account request timed out.',
      { timeoutMs, signal: controller.signal });
    } finally { requests.delete(controller); }
  }

  async function perform(credentials) {
    let identity = readIdentity();
    const current = () => !disposed && readIdentity().id === identity.id && readIdentity().token === identity.token && readIdentity().generation === identity.generation;
    const superseded = { status: 'superseded' };
    const pending = { status: 'pending', message: 'We could not confirm whether your account was saved. Check again, or retry saving; a retry checks your account first.' };
    if (!current() || !identity.id || !identity.token) return superseded;

    function confirm(data) {
      if (!data?.user || data.user.id !== identity.id || typeof data.user.isGuest !== 'boolean') throw Error('Invalid account response');
      if (data.token !== undefined && (typeof data.token !== 'string' || !data.token)) throw Error('Invalid account token');
      if (data.user.isGuest) {
        // /me can renew an aging guest token. Continue with that token so the
        // subsequent save does not race its old expiry.
        if (data.token && data.token !== identity.token) { accept(data, identity); identity = readIdentity(); }
        return null;
      }
      accept(data, identity);
      return { status: 'saved', user: data.user };
    }
    try {
      const data = await request(identity, 'get', '/auth/me');
      if (!current()) return superseded;
      const saved = confirm(data);
      if (saved) return saved;
      if (!credentials) return { status: 'pending', message: 'The server still shows a guest account. You can check again or retry saving.' };
    } catch { return current() ? pending : superseded; }

    let failure;
    try {
      const data = await request(identity, 'post', '/auth/upgrade', credentials);
      if (!current()) return superseded;
      const saved = confirm(data);
      if (saved) return saved;
    } catch (error) { failure = error; }
    if (!current()) return superseded;

    // Even an error response may follow a committed upgrade (or another tab's
    // successful conversion). Read the account before reporting failure.
    try {
      const data = await request(identity, 'get', '/auth/me');
      if (!current()) return superseded;
      const saved = confirm(data);
      if (saved) return saved;
      if (failure?.status >= 400 && failure.status < 500) return { status: 'rejected', message: failure.message };
    } catch { /* A failed confirmation leaves the outcome unknown. */ }
    return current() ? pending : superseded;
  }

  function run(credentials) {
    if (disposed) return Promise.resolve({ status: 'superseded' });
    if (!running) running = perform(credentials).finally(() => { running = null; });
    return running;
  }
  return {
    save: credentials => run(credentials),
    recover: () => run(),
    dispose() { disposed = true; for (const controller of requests) controller.abort(); }
  };
}
