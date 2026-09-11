import { createProfileReconciliation as createServer } from '../server/services/profileReconciliation.js';
import { createProfileReconciliation as createClient } from '../src/lib/profileReconciliation.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const connection = () => ({ socket: { connected: true, emit: vi.fn() } });

it('batches only connected identities, repeats revisions and does no work without an audience', async () => {
  const connections = new Map(Array.from({ length: 5 }, (_, i) => [i + 1, connection()]));
  const findMany = vi.fn(async query => query.where.id.in.map(id => ({ id, profileVersion: 7 })));
  const server = createServer({ db: { user: { findMany } }, connections, batchSize: 2 });
  await server.runOnce(); await server.runOnce();
  expect(findMany.mock.calls.map(([q]) => q.where.id.in.length)).toEqual([2, 2, 1, 2, 2, 1]);
  expect(connections.get(1).socket.emit).toHaveBeenCalledTimes(2);
  expect(connections.get(1).socket.emit).toHaveBeenCalledWith('account:revision', { userId: 1, profileVersion: 7 });
  expect(findMany.mock.calls[0][0].select).toEqual({ id: true, profileVersion: true });
  connections.clear(); await server.runOnce(); expect(findMany).toHaveBeenCalledTimes(6);
  await server.stop();
});

it('never overlaps scans or publishes to a replacement/disconnected socket', async () => {
  const pending = deferred(), old = connection(), offline = connection();
  const connections = new Map([[1, old], [2, offline]]);
  const findMany = vi.fn(() => pending.promise);
  const server = createServer({ db: { user: { findMany } }, connections });
  const first = server.runOnce(); expect(server.runOnce()).toBe(first);
  const replacement = connection(); connections.set(1, replacement); offline.socket.connected = false;
  pending.resolve([{ id: 1, profileVersion: 9 }, { id: 2, profileVersion: 8 }]); await first;
  expect(findMany).toHaveBeenCalledTimes(1);
  for (const item of [old, offline, replacement]) expect(item.socket.emit).not.toHaveBeenCalled();
  await server.stop();
});

it('drains an active scan on stop and suppresses late publication and future work', async () => {
  const pending = deferred(), target = connection();
  const findMany = vi.fn(() => pending.promise);
  const server = createServer({ db: { user: { findMany } }, connections: new Map([[1, target]]) });
  server.runOnce(); const stopping = server.stop();
  pending.resolve([{ id: 1, profileVersion: 1 }]); await stopping; await server.runOnce();
  expect(target.socket.emit).not.toHaveBeenCalled(); expect(findMany).toHaveBeenCalledTimes(1);
});

it('recovers a failed periodic scan and stops its timer', async () => {
  vi.useFakeTimers();
  const target = connection(), onError = vi.fn();
  const findMany = vi.fn().mockRejectedValueOnce(Error('database unavailable')).mockResolvedValue([{ id: 1, profileVersion: 3 }]);
  const server = createServer({ db: { user: { findMany } }, connections: new Map([[1, target]]), intervalMs: 100, onError });
  try {
    server.start(); server.start(); await vi.advanceTimersByTimeAsync(100);
    expect(onError).toHaveBeenCalledTimes(1); expect(target.socket.emit).toHaveBeenCalledTimes(1);
    await server.stop(); await vi.advanceTimersByTimeAsync(300); expect(findMany).toHaveBeenCalledTimes(2);
  } finally { await server.stop(); vi.useRealTimers(); }
});

it('ignores already accepted, malformed and other-account revision hints', async () => {
  const refresh = vi.fn(), client = createClient({ readProfile: () => ({ id: 1, profileVersion: 4 }), refresh });
  for (const hint of [null, { userId: 2, profileVersion: 6 }, { userId: 1, profileVersion: -1 }, { userId: 1, profileVersion: '5' }, { userId: 1, profileVersion: 4 }]) await client.observe(hint);
  expect(refresh).not.toHaveBeenCalled();
});

it('coalesces duplicate hints and follows a newer revision arriving during an older read', async () => {
  let profile = { id: 1, profileVersion: 0 };
  const pending = deferred();
  const refresh = vi.fn().mockImplementationOnce(async () => { await pending.promise; profile = { id: 1, profileVersion: 1 }; })
    .mockImplementationOnce(async () => { profile = { id: 1, profileVersion: 3 }; });
  const client = createClient({ readProfile: () => profile, refresh });
  const first = client.observe({ userId: 1, profileVersion: 1 });
  expect(client.observe({ userId: 1, profileVersion: 1 })).toBe(first);
  client.observe({ userId: 1, profileVersion: 3 }); pending.resolve(); await first;
  expect(refresh).toHaveBeenCalledTimes(2); expect(profile.profileVersion).toBe(3);
  await client.observe({ userId: 1, profileVersion: 3 }); expect(refresh).toHaveBeenCalledTimes(2);
});

it('retries failed or stale reads on repeated hints without a tight retry loop', async () => {
  let profile = { id: 1, profileVersion: 0 };
  const refresh = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(null)
    .mockImplementationOnce(async () => { profile = { id: 1, profileVersion: 2 }; });
  const client = createClient({ readProfile: () => profile, refresh });
  for (let i = 1; i <= 3; i++) { await client.observe({ userId: 1, profileVersion: 2 }); expect(refresh).toHaveBeenCalledTimes(i); }
  expect(profile.profileVersion).toBe(2);
});

it.each(['dispose', 'replace'])('does not start another read after lifecycle change: %s', async action => {
  let current = true;
  const pending = deferred(), refresh = vi.fn(() => pending.promise);
  const client = createClient({ readProfile: () => ({ id: 1, profileVersion: 0 }), refresh, isCurrent: () => current });
  const first = client.observe({ userId: 1, profileVersion: 1 });
  client.observe({ userId: 1, profileVersion: 2 });
  if (action === 'dispose') client.dispose(); else current = false;
  pending.resolve(); await first;
  await client.observe({ userId: 1, profileVersion: 3 }); expect(refresh).toHaveBeenCalledTimes(1);
});
