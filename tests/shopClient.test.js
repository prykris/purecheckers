import { ShopClient } from '../src/lib/shopClient.js';

it('selects standard pieces through the existing equipment action and refreshes inventory', async () => {
  const h = await fixture();
  expect(await h.client.act('equip', null)).toBe(true);
  expect(h.perform).toHaveBeenCalledWith('equip', { itemId: null, itemType: 'SKIN' });
  expect(h.load).toHaveBeenCalledTimes(2); h.client.dispose();
});

it('selects the basic theme through the same journal with an explicit theme slot', async () => {
  const h = await fixture();
  expect(await h.client.act('equip', null, 'THEME')).toBe(true);
  expect(h.perform).toHaveBeenCalledWith('equip', { itemId: null, itemType: 'THEME' });
  expect(await h.client.act('equip', null, 'EMOTE')).toBe(false);
  h.client.dispose();
});

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const snapshot = (owned = false, equipped = false) => ({ items: [{ id: 1, type: 'THEME' }], inventory: owned ? [{ itemId: 1, equipped }] : [] });
async function fixture(owned = false) {
  let generation = 0, state;
  const load = vi.fn().mockResolvedValue(snapshot(owned));
  const perform = vi.fn().mockResolvedValue({ coins: 10 });
  const client = new ShopClient({ load, perform, readScope: () => ({ generation }), isCurrent: scope => scope.generation === generation,
    publish: value => { state = value; } });
  await client.refresh();
  return { client, load, perform, state: () => state, replace: () => { generation++; client.reset(); } };
}

it.each(['purchase', 'equip'])('confirms %s through the shared journal and reads current inventory instead of applying its receipt', async kind => {
  const h = await fixture(kind === 'equip');
  h.load.mockResolvedValue(snapshot(true, true));
  expect(await h.client.act(kind, 1)).toBe(true);
  expect(h.perform).toHaveBeenCalledWith(kind, { itemId: 1 });
  expect(h.state()).toMatchObject({ data: snapshot(true, true), action: null, error: null }); h.client.dispose();
});

it('prevents overlapping actions while confirmation and inventory reads are pending', async () => {
  const h = await fixture(), result = deferred(), view = deferred();
  h.perform.mockReturnValue(result.promise); h.load.mockReturnValue(view.promise);
  const first = h.client.act('purchase', 1);
  expect(await h.client.act('purchase', 1)).toBe(false);
  result.resolve({ coins: 10 }); await Promise.resolve(); await Promise.resolve();
  expect(await h.client.act('purchase', 1)).toBe(false);
  view.resolve(snapshot(true)); await first;
  expect(h.perform).toHaveBeenCalledTimes(1); h.client.dispose();
});

it('keeps confirmation distinct from a failed read, preserves inventory and supports refresh', async () => {
  const h = await fixture(true);
  h.load.mockRejectedValue(Error('offline'));
  expect(await h.client.act('equip', 1)).toBe(true);
  expect(h.state()).toMatchObject({ data: snapshot(true), status: 'error', action: null, error: 'Item selection confirmed. Refresh to load your current items.' });
  expect(await h.client.act('equip', 1)).toBe(false);
  h.load.mockResolvedValue(snapshot(true, true)); await h.client.refresh();
  expect(h.state()).toMatchObject({ data: snapshot(true, true), status: 'ready', error: null }); h.client.dispose();
});

it('refreshes uncertain actions without automatically retrying or claiming optimistic ownership', async () => {
  const h = await fixture(); h.perform.mockRejectedValue(Error('confirmation required'));
  expect(await h.client.act('purchase', 1)).toBe(false);
  expect(h.perform).toHaveBeenCalledTimes(1); expect(h.load).toHaveBeenCalledTimes(2);
  expect(h.state()).toMatchObject({ data: snapshot(), action: null, error: 'confirmation required' }); h.client.dispose();
});

it.each(['replace', 'dispose'])('discards action completion and follow-up reads after %s', async action => {
  const h = await fixture(), pending = deferred(); h.perform.mockReturnValue(pending.promise);
  const first = h.client.act('purchase', 1);
  if (action === 'replace') h.replace(); else h.client.dispose();
  const state = h.state(); pending.resolve({ coins: 10 });
  expect(await first).toBe(false); expect(h.state()).toBe(state); expect(h.load).toHaveBeenCalledTimes(1); h.client.dispose();
});

it('rejects malformed reads, clears initial loading and does not call an empty view a valid catalogue', async () => {
  const h = await fixture(); h.client.reset(); h.load.mockResolvedValue(null);
  expect(await h.client.refresh()).toBe(false);
  expect(h.state()).toMatchObject({ data: null, status: 'error', readError: 'Could not confirm shop data. Please refresh.' });
  expect(await h.client.act('purchase', 1)).toBe(false);
  h.load.mockResolvedValue({ items: [], inventory: [] }); expect(await h.client.refresh()).toBe(true); h.client.dispose();
});
