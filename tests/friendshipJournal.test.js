import { randomUUID } from 'node:crypto';
import { FriendshipJournal } from '../src/lib/friends/journal.js';

function fixture(send = vi.fn().mockRejectedValue(Error('lost response')), storage) {
  const saved = new Map();
  storage ??= { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  const journal = new FriendshipJournal({ storage, send, uuid: randomUUID, publish: vi.fn() }); journal.setIdentity(1, 1);
  return { journal, send, storage };
}
const receipt = (intent, userId = 1) => ({ userId, requestId: intent.requestId, kind: intent.kind,
  friendship: { id: intent.payload.friendshipId ?? 20, status: intent.kind === 'accept' ? 'ACCEPTED' : 'PENDING' }, removed: intent.kind === 'remove' });

it('retains a room-player request across reload and validates the exact recipient before confirming', async () => {
  const h = fixture();
  await expect(h.journal.start('request', { userId: 5, displayName: 'Opponent' })).rejects.toThrow('lost response');
  const intent = h.journal.pending, next = fixture(vi.fn(), h.storage);
  const accepted = { ...receipt(intent), friendship: { id: 20, requesterId: 1, receiverId: 6, status: 'PENDING' } };
  next.send.mockResolvedValue(accepted);
  await expect(next.journal.retry()).rejects.toThrow('could not be confirmed');
  accepted.friendship.receiverId = 5;
  next.send.mockResolvedValue(accepted);
  await next.journal.retry();
  expect(next.journal.pending).toBeNull();
});

it.each(['request', 'accept', 'remove'])('retains uncertain %s across reload without automatically replaying it', async kind => {
  const h = fixture(), payload = kind === 'request' ? { friendCode: 'ABCDEF' } : { friendshipId: 20, displayName: 'Alice' };
  await expect(h.journal.start(kind, payload)).rejects.toThrow('lost response');
  const intent = h.journal.pending, next = fixture(vi.fn(), h.storage);
  expect(next.journal.pending).toEqual(intent); expect(next.send).not.toHaveBeenCalled();
  await expect(next.journal.start('request', { friendCode: 'FEDCBA' })).rejects.toThrow('pending');
  next.send.mockResolvedValue(receipt(intent));
  expect(await next.journal.retry()).toEqual(receipt(intent));
  expect(next.send).toHaveBeenCalledWith(kind, { ...payload, requestId: intent.requestId }); expect(next.journal.pending).toBeNull();
});

it.each(['user', 'request', 'kind', 'relationship', 'status'])('retains the intent when a receipt has the wrong %s', async field => {
  const h = fixture(); await expect(h.journal.start('accept', { friendshipId: 20 })).rejects.toThrow();
  const intent = h.journal.pending, response = receipt(intent);
  if (field === 'user') response.userId = 2;
  if (field === 'request') response.requestId = randomUUID();
  if (field === 'kind') response.kind = 'remove';
  if (field === 'relationship') response.friendship.id = 21;
  if (field === 'status') response.friendship.status = 'PENDING';
  h.send.mockResolvedValue(response);
  await expect(h.journal.retry()).rejects.toThrow('could not be confirmed'); expect(h.journal.pending).toEqual(intent);
});

it('fences old completions even when signing back into the same account', async () => {
  let resolve;
  const h = fixture(vi.fn(() => new Promise(r => { resolve = r; })));
  const first = h.journal.start('remove', { friendshipId: 20 }), intent = h.journal.pending;
  h.journal.setIdentity(1, 2); resolve(receipt(intent));
  expect(await first).toBeNull(); expect(h.journal.pending).toEqual(intent); expect(h.journal.busy).toBe(false);
  h.send.mockResolvedValue(receipt(intent)); await h.journal.retry(); expect(h.journal.pending).toBeNull();
});

it('clears definitive rejection and refuses to send when intent persistence fails', async () => {
  const h = fixture(vi.fn().mockRejectedValue(Object.assign(Error('already pending'), { status: 409 })));
  await expect(h.journal.start('request', { friendCode: 'ABCDEF' })).rejects.toThrow('already pending'); expect(h.journal.pending).toBeNull();
  h.storage.setItem = () => { throw Error('unavailable'); }; h.send.mockClear();
  await expect(h.journal.start('request', { friendCode: 'ABCDEF' })).rejects.toThrow('Enable browser storage'); expect(h.send).not.toHaveBeenCalled();
});
