import { FriendsClient } from '../src/lib/friendsClient.js';

it('coalesces notifications during an active read and fetches the relationship change afterwards', async () => {
  const h = await fixture(), pending = deferred();
  h.load.mockReturnValueOnce(pending.promise).mockResolvedValue(snapshot([{ id: 9 }]));
  const read = h.client.refresh();
  h.client.invalidate(); h.client.invalidate();
  expect(h.load).toHaveBeenCalledTimes(2);
  pending.resolve(snapshot()); await read;
  await vi.waitFor(() => expect(h.state().data.friends).toEqual([{ id: 9 }]));
  expect(h.load).toHaveBeenCalledTimes(3); h.client.dispose();
});

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const snapshot = (friends = []) => ({ friends, requests: [], outgoing: [] });
async function fixture() {
  let generation = 0, state;
  const load = vi.fn().mockResolvedValue(snapshot()), perform = vi.fn().mockResolvedValue({ confirmed: true }), tip = vi.fn().mockResolvedValue({ coins: 10 });
  const client = new FriendsClient({ load, perform, tip, readScope: () => ({ generation }), isCurrent: scope => scope.generation === generation,
    publish: value => { state = value; } });
  await client.refresh();
  return { client, load, perform, tip, state: () => state, replace: () => { generation++; client.reset(); } };
}

it.each(['request', 'accept', 'remove', 'tip'])('confirms %s through its journal and then reads current relationships', async kind => {
  const h = await fixture(), payload = { target: 1 };
  h.load.mockResolvedValue(snapshot([{ id: 3 }]));
  expect(await h.client.act(kind, payload)).toBe(true);
  if (kind === 'tip') { expect(h.tip).toHaveBeenCalledWith(payload); expect(h.perform).not.toHaveBeenCalled(); }
  else expect(h.perform).toHaveBeenCalledWith(kind, payload);
  expect(h.state()).toMatchObject({ data: snapshot([{ id: 3 }]), action: null, error: null }); h.client.dispose();
});

it('blocks duplicate actions through both command confirmation and the following read', async () => {
  const h = await fixture(), result = deferred(), read = deferred();
  h.perform.mockReturnValue(result.promise); h.load.mockReturnValue(read.promise);
  const first = h.client.act('accept', {});
  expect(await h.client.act('remove', {})).toBe(false);
  result.resolve({ confirmed: true }); await Promise.resolve(); await Promise.resolve();
  expect(await h.client.act('remove', {})).toBe(false);
  read.resolve(snapshot()); await first;
  expect(h.perform).toHaveBeenCalledTimes(1); h.client.dispose();
});

it('distinguishes confirmation from read failure and permits explicit recovery without repeating the action', async () => {
  const h = await fixture(); h.load.mockRejectedValue(Error('offline'));
  expect(await h.client.act('accept', {})).toBe(true);
  expect(h.state()).toMatchObject({ data: snapshot(), status: 'error', error: 'Action confirmed. Refresh to load the latest friends list.' });
  expect(await h.client.act('accept', {})).toBe(false);
  h.load.mockResolvedValue(snapshot([{ id: 1 }])); await h.client.refresh();
  expect(h.state()).toMatchObject({ status: 'ready', error: null }); expect(h.perform).toHaveBeenCalledTimes(1); h.client.dispose();
});

it('does not automatically repeat an uncertain action or apply a guessed friendship', async () => {
  const h = await fixture(); h.perform.mockRejectedValue(Error('needs confirmation'));
  expect(await h.client.act('request', {})).toBe(false);
  expect(h.state()).toMatchObject({ data: snapshot(), error: 'needs confirmation', action: null });
  expect(h.perform).toHaveBeenCalledTimes(1); expect(h.load).toHaveBeenCalledTimes(2); h.client.dispose();
});

it.each(['replace', 'dispose'])('discards late confirmation after %s', async action => {
  const h = await fixture(), result = deferred(); h.perform.mockReturnValue(result.promise);
  const first = h.client.act('remove', {});
  if (action === 'replace') h.replace(); else h.client.dispose();
  const state = h.state(); result.resolve({ confirmed: true });
  expect(await first).toBe(false); expect(h.state()).toBe(state); expect(h.load).toHaveBeenCalledTimes(1); h.client.dispose();
});

it('rejects malformed reads instead of displaying them as an empty friends list', async () => {
  const h = await fixture(); h.client.reset(); h.load.mockResolvedValue({ friends: [] });
  expect(await h.client.refresh()).toBe(false);
  expect(h.state()).toMatchObject({ status: 'error', data: null, readError: 'Could not confirm friends data. Please refresh.' });
  expect(await h.client.act('request', {})).toBe(false);
  h.load.mockResolvedValue(snapshot()); expect(await h.client.refresh()).toBe(true); h.client.dispose();
});
