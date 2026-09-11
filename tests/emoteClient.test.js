import { EmoteClient } from '../src/lib/emoteClient.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const data = { emotes: [{ id: 3, name: 'GG', emoji: '🤝', label: 'GG' }] };
async function fixture() {
  let generation = 1, permitted = true, state;
  const load = vi.fn().mockResolvedValue(data), send = vi.fn().mockResolvedValue({ ok: true });
  const client = new EmoteClient({ load, send, canSend: () => permitted, readScope: () => ({ generation, gameId: 7 }),
    isCurrent: scope => scope.generation === generation, publish: value => { state = value; } });
  await client.refresh();
  return { client, load, send, state: () => state, replace: () => { generation++; client.reset(); }, pause: () => { permitted = false; } };
}

it('sends only an available item id with captured context and serializes pending acknowledgements', async () => {
  const h = await fixture(), pending = deferred(); h.send.mockReturnValue(pending.promise);
  expect(await h.client.sendItem(99)).toBe(false);
  const first = h.client.sendItem(3); expect(await h.client.sendItem(3)).toBe(false);
  expect(h.send).toHaveBeenCalledWith(3, { generation: 1, gameId: 7 });
  pending.resolve({ ok: true }); expect(await first).toBe(true);
  expect(h.state()).toMatchObject({ sending: false, error: null });
  h.pause(); expect(await h.client.sendItem(3)).toBe(false); h.client.dispose();
});

it('does not replay uncertain sends after refreshing reads or manufacture a successful acknowledgement', async () => {
  const h = await fixture(); h.send.mockRejectedValueOnce(Error('timeout')).mockResolvedValue(null);
  expect(await h.client.sendItem(3)).toBe(false);
  await h.client.refresh(); expect(h.send).toHaveBeenCalledTimes(1);
  expect(h.state().error).toMatch(/not confirmed/);
  expect(await h.client.sendItem(3)).toBe(false); expect(h.send).toHaveBeenCalledTimes(2); h.client.dispose();
});

it('refreshes revoked availability without retrying the denied send', async () => {
  const h = await fixture(); h.send.mockResolvedValue({ ok: false, code: 'EMOTE_UNAVAILABLE', error: 'Unavailable' });
  h.load.mockResolvedValue({ emotes: [] });
  expect(await h.client.sendItem(3)).toBe(false);
  expect(h.state()).toMatchObject({ emotes: [], error: 'Unavailable', sending: false });
  expect(h.send).toHaveBeenCalledTimes(1); h.client.dispose();
});

it.each(['replace', 'dispose'])('ignores acknowledgement feedback and follow-up reads after %s', async action => {
  const h = await fixture(), pending = deferred(); h.send.mockReturnValue(pending.promise);
  const first = h.client.sendItem(3);
  if (action === 'replace') h.replace(); else h.client.dispose();
  const state = h.state(); pending.resolve({ ok: false, code: 'EMOTE_UNAVAILABLE', error: 'old error' });
  expect(await first).toBe(false); expect(h.state()).toBe(state); expect(h.load).toHaveBeenCalledTimes(1); h.client.dispose();
});

it('retains known emotes on a failed read, exposes retry and rejects malformed lists', async () => {
  const h = await fixture(); h.load.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({ emotes: [null] }).mockResolvedValue(data);
  expect(await h.client.refresh()).toBe(false); expect(h.state()).toMatchObject({ emotes: data.emotes, readError: 'offline', status: 'error' });
  expect(await h.client.refresh()).toBe(false); expect(h.state().readError).toMatch(/confirm/);
  expect(await h.client.refresh()).toBe(true); expect(h.state().readError).toBeNull(); h.client.dispose();
});
