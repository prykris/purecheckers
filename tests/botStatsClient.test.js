import { writable } from 'svelte/store';
import { createBotStats, bindBotStats } from '../src/lib/botStats.js';

const payload = wins => ({ stats: ['easy', 'medium', 'hard'].map(difficulty => ({ difficulty, wins, draws: 0, losses: 0 })) });

it('clears personal data on account replacement and rejects the previous account’s late response', async () => {
  let scope = { generation: 1, token: 'first' }, resolve;
  const user = writable({ id: 1 }), session = writable({ status: 'ready', recovery: 1 });
  const request = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(payload(2));
  const resource = createBotStats({ request, readScope: () => scope, isCurrent: value => value.generation === scope.generation, publish: () => {} });
  let focus;
  const stop = bindBotStats({ resource, user, session, capture: () => scope, onFocus: callback => { focus = callback; return () => {}; } });
  scope = { generation: 2, token: 'second' }; user.set({ id: 2 });
  expect(resource.state.data).toBeNull();
  await vi.waitFor(() => expect(resource.state.data?.[0].wins).toBe(2));
  resolve(payload(99));
  await new Promise(done => setTimeout(done, 0));
  expect(resource.state.data[0].wins).toBe(2);
  expect(request.mock.calls[1][1].authToken).toBe('second');
  focus(); await vi.waitFor(() => expect(resource.state.status).toBe('ready'));
  session.set({ status: 'ready', recovery: 2 });
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(4));
  scope = { generation: 3, token: null }; user.set(null);
  expect(resource.state.data).toBeNull();
  stop();
});

it('shows failure rather than fabricated zeroes and recovers on retry', async () => {
  const malformed = payload(0); malformed.stats[1] = malformed.stats[0];
  const resource = createBotStats({ request: vi.fn().mockResolvedValueOnce(malformed).mockResolvedValueOnce(payload(0)),
    readScope: () => ({ token: 'account' }), isCurrent: () => true, publish: () => {} });
  expect(await resource.refresh()).toBe(false);
  expect(resource.state).toMatchObject({ status: 'error', data: null });
  expect(await resource.refresh()).toBe(true);
  expect(resource.state.data[0].wins).toBe(0);
  resource.dispose();
});
