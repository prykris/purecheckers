import { randomUUID } from 'node:crypto';
import { WalletJournal } from '../src/lib/wallet/journal.js';

it('confirms a standard-piece selection after reload using the same intent and an exact reset receipt', async () => {
  const h = setup(vi.fn().mockRejectedValue(Error('lost response')));
  await expect(h.journal.start('equip', { itemId: null, itemType: 'SKIN' })).rejects.toThrow('lost response');
  const intent = h.journal.pending;
  const next = setup(vi.fn().mockResolvedValueOnce({ equipped: true, itemId: 3 }).mockResolvedValue({ equipped: false, itemId: null, itemType: 'SKIN' }), h.storage);
  await expect(next.journal.retry()).rejects.toThrow('could not be confirmed'); expect(next.journal.pending).toEqual(intent);
  await next.journal.retry(); expect(next.journal.pending).toBeNull(); expect(next.send.mock.calls[0]).toEqual(next.send.mock.calls[1]);
});

it('keeps an uncertain selection across reload and requires the matching item receipt', async () => {
  const h = setup(vi.fn().mockRejectedValue(Error('lost response')));
  await expect(h.journal.start('equip', { itemId: 3 })).rejects.toThrow('lost response');
  const intent = h.journal.pending;
  const next = setup(vi.fn().mockResolvedValueOnce({ equipped: true, itemId: 4 }).mockResolvedValue({ equipped: true, itemId: 3 }), h.storage);
  await expect(next.journal.start('equip', { itemId: 4 })).rejects.toThrow('pending');
  await expect(next.journal.retry()).rejects.toThrow('could not be confirmed');
  expect(next.journal.pending).toEqual(intent);
  expect(await next.journal.retry()).toEqual({ equipped: true, itemId: 3 });
  expect(next.journal.pending).toBeNull();
  expect(next.send.mock.calls[0]).toEqual(next.send.mock.calls[1]);
});

it('fences a previous authentication generation even when the account id is unchanged', async () => {
  let resolve;
  const h = setup(vi.fn(() => new Promise(r => { resolve = r; })));
  h.journal.setIdentity(1, 10);
  const old = h.journal.start('equip', { itemId: 3 });
  const intent = h.journal.pending;
  h.journal.setIdentity(1, 11);
  resolve({ equipped: true, itemId: 3 });
  expect(await old).toBeNull(); expect(h.journal.pending).toEqual(intent);
  expect(h.journal.busy).toBe(false);
  h.send.mockResolvedValue({ equipped: true, itemId: 3 });
  await h.journal.retry(); expect(h.journal.pending).toBeNull();
});

function setup(send = vi.fn().mockResolvedValue({ coins: 20 }), storage) {
  const saved = new Map();
  storage ??= { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  const publish = vi.fn();
  const journal = new WalletJournal({ storage, send, uuid: randomUUID, publish });
  journal.setIdentity(1);
  return { journal, send, storage, publish };
}

it('persists before sending, blocks double clicks, and clears only on a confirmed response', async () => {
  let resolve;
  const send = vi.fn(() => new Promise(r => { resolve = r; }));
  const { journal, storage } = setup(send);
  const first = journal.start('tip', { receiverId: 2, amount: 20 });
  const saved = JSON.parse(storage.getItem(journal.storageKey()));
  expect(saved.requestId).toBe(send.mock.calls[0][1].requestId);
  await expect(journal.start('tip', { receiverId: 2, amount: 20 })).rejects.toThrow('pending');
  expect(await journal.retry()).toBeNull();
  resolve({ coins: 80 });
  expect(await first).toEqual({ coins: 80 });
  expect(journal.pending).toBeNull();
  expect(storage.getItem(journal.storageKey())).toBeUndefined();
});

it.each([undefined, 408, 429, 500])('retains identity across uncertain status %s and reload', async status => {
  const failure = Object.assign(new Error('uncertain'), { status });
  const first = setup(vi.fn().mockRejectedValue(failure));
  await expect(first.journal.start('purchase', { itemId: 3 })).rejects.toThrow('uncertain');
  const requestId = first.journal.pending.requestId;
  const next = setup(undefined, first.storage);
  expect(next.journal.pending.requestId).toBe(requestId);
  expect(await next.journal.retry()).toEqual({ coins: 20 });
  expect(next.send).toHaveBeenCalledWith('purchase', { itemId: 3, requestId });
});

it('clears explicitly rejected commands and permits a genuinely new action', async () => {
  const { journal, send } = setup(vi.fn().mockRejectedValueOnce(Object.assign(Error('Insufficient coins'), { status: 400 })).mockResolvedValue({ coins: 0 }));
  await expect(journal.start('purchase', { itemId: 3 })).rejects.toThrow('Insufficient');
  expect(journal.pending).toBeNull();
  await journal.start('purchase', { itemId: 3 });
  expect(send.mock.calls[0][1].requestId).not.toBe(send.mock.calls[1][1].requestId);
});

it('ignores a previous account response and keeps its intent for that account to confirm later', async () => {
  let resolve;
  const { journal, send } = setup(vi.fn(() => new Promise(r => { resolve = r; })));
  const pending = journal.start('tip', { receiverId: 2, amount: 10 });
  const key = journal.pending.requestId;
  journal.setIdentity(2);
  resolve({ coins: 90 });
  expect(await pending).toBeNull();
  expect(journal.pending).toBeNull();
  journal.setIdentity(1);
  expect(journal.pending.requestId).toBe(key);
  send.mockResolvedValue({ coins: 90 });
  await journal.retry();
});

it('will not send if persisting the request identity fails', async () => {
  const { journal, send } = setup(undefined, { getItem: () => null, setItem: () => { throw Error('disabled'); } });
  await expect(journal.start('purchase', { itemId: 3 })).rejects.toThrow('storage');
  expect(send).not.toHaveBeenCalled();
});

it('retains a confirmed action when storage cleanup fails so retries still use its receipt', async () => {
  const store = new Map();
  const { journal, send } = setup(undefined, {
    getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: () => { throw Error('storage cleanup failed'); }
  });
  await expect(journal.start('purchase', { itemId: 3 })).rejects.toThrow('cleanup');
  await expect(journal.retry()).rejects.toThrow('cleanup');
  expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
});

it('does not overwrite unreadable saved payment state', async () => {
  const { journal, send } = setup(undefined, { getItem: () => '{broken' });
  expect(journal.blocked).toBe(true);
  await expect(journal.start('purchase', { itemId: 3 })).rejects.toThrow('unavailable');
  expect(send).not.toHaveBeenCalled();
});

it('keeps the intent when a successful HTTP response lacks a valid receipt', async () => {
  const { journal } = setup(vi.fn().mockResolvedValue(null));
  await expect(journal.start('purchase', { itemId: 3 })).rejects.toThrow('confirmed');
  expect(journal.pending).not.toBeNull();
});

it('prevents another payment until current balance reconciliation finishes', async () => {
  let resolve;
  const { journal } = setup();
  journal.confirm = vi.fn(() => new Promise(r => { resolve = r; }));
  const result = journal.start('purchase', { itemId: 3 });
  await vi.waitFor(() => expect(journal.confirm).toHaveBeenCalled());
  await expect(journal.start('purchase', { itemId: 4 })).rejects.toThrow('pending');
  resolve();
  expect(await result).toEqual({ coins: 20 });
  expect(journal.pending).toBeNull();
});

it('reports a confirmed payment even when balance refresh fails', async () => {
  const { journal } = setup();
  journal.confirm = vi.fn().mockRejectedValue(Error('offline'));
  expect(await journal.start('purchase', { itemId: 3 })).toEqual({ coins: 20 });
  expect(journal.pending).toBeNull();
  expect(journal.error).toMatch(/Payment confirmed/);
});
