import { randomUUID } from 'node:crypto';
import { AdminJournal } from '../src/lib/admin/journal.js';
const receipt = (kind, body, actorId = 1) => ({ requestId: body.requestId, actorId, kind, user: { id: body.userId } });
function setup(send, storage) {
  const values = new Map();
  storage ??= { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const journal = new AdminJournal({ storage, send, uuid: randomUUID, publish: vi.fn() });
  journal.setIdentity(1); return { journal, storage };
}
it('reuses the saved target and request after a lost response and reload', async () => {
  const send = vi.fn().mockRejectedValueOnce(Error('lost')).mockImplementation(async (kind, body) => receipt(kind, body));
  const first = setup(send);
  await expect(first.journal.start('give-coins', { userId: 2, amount: 10 })).rejects.toThrow('lost');
  const id = first.journal.pending.requestId;
  const restored = setup(send, first.storage);
  await expect(restored.journal.start('reset-stats', { userId: 3 })).rejects.toThrow('pending');
  expect((await restored.journal.retry()).requestId).toBe(id);
  expect(send.mock.calls[1][1]).toEqual(send.mock.calls[0][1]);
  expect(restored.journal.pending).toBeNull();
});
it('rejects unrelated receipts and preserves uncertain privilege changes', async () => {
  const { journal } = setup(async (kind, body) => receipt(kind, { ...body, userId: 99 }));
  await expect(journal.start('set-admin', { userId: 1, isAdmin: false })).rejects.toThrow('confirmed');
  expect(journal.pending.payload.isAdmin).toBe(false);
});
it('does not refresh or publish an old actor result after switching identities', async () => {
  let finish;
  const { journal } = setup((kind, body) => new Promise(resolve => { finish = () => resolve(receipt(kind, body)); }));
  journal.confirm = vi.fn();
  const work = journal.start('reset-stats', { userId: 2 });
  journal.setIdentity(3); finish();
  expect(await work).toBeNull(); expect(journal.confirm).not.toHaveBeenCalled();
  journal.setIdentity(1); expect(journal.pending.kind).toBe('reset-stats');
});
it('refuses to send when the intent cannot be stored', async () => {
  const send = vi.fn(); const { journal } = setup(send, { getItem: () => null, setItem: () => { throw Error('blocked'); } });
  await expect(journal.start('give-coins', { userId: 2, amount: 10 })).rejects.toThrow('storage');
  expect(send).not.toHaveBeenCalled();
});
