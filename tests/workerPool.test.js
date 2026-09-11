import { Worker } from 'node:worker_threads';
import { WorkerPool } from '../server/services/workerPool.js';
import { setTimeout as delay } from 'node:timers/promises';
const url = new URL('./fixtures/poolWorker.js', import.meta.url);
const pools = [];
const make = options => { const pool = new WorkerPool(url, options); pools.push(pool); return pool; };
afterEach(async () => { await Promise.all(pools.splice(0).map(p => p.close())); });

it('bounds running and queued work and prioritizes bot moves over grading', async () => {
  const pool = make({ size: 1, maxQueue: 2 });
  const order = [];
  const first = pool.run({ value: 'first', delay: 100 }).then(v => order.push(v));
  const grade = pool.run({ value: 'grade' }).then(v => order.push(v));
  const move = pool.run({ value: 'move' }, { priority: 1 }).then(v => order.push(v));
  await expect(pool.run({})).rejects.toMatchObject({ code: 'BUSY' });
  await Promise.all([first, grade, move]);
  expect(order).toEqual(['first', 'move', 'grade']);
  expect(pool.slots.size).toBe(1);
});

it('cancels queued and running jobs and continues with a replacement worker', async () => {
  const pool = make({ size: 1 });
  const active = new AbortController(), queued = new AbortController();
  const a = pool.run({ delay: 1000 }, { signal: active.signal });
  const b = pool.run({ value: 'obsolete' }, { signal: queued.signal });
  const checks = [expect(a).rejects.toMatchObject({ code: 'ABORTED' }), expect(b).rejects.toMatchObject({ code: 'ABORTED' })];
  queued.abort(); active.abort();
  await Promise.all(checks);
  expect(await pool.run({ value: 'current' })).toBe('current');
  expect(pool.queue).toHaveLength(0);
});

it('recovers after a crash and after a deadline, with no stale completion', async () => {
  const pool = make({ size: 1 });
  await expect(pool.run({ crash: true })).rejects.toMatchObject({ code: 'EXIT' });
  await expect(pool.run({ delay: 1000 }, { timeoutMs: 100 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  expect(await pool.run({ value: 'recovered' })).toBe('recovered');
});

it('keeps the main event loop responsive during worker CPU work', async () => {
  let signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const pool = make({ workerFactory: () => {
    const worker = new Worker(url);
    worker.on('message', m => { if (m.started) signalStarted(); });
    return worker;
  } });
  let finished = false;
  const job = pool.run({ spin: 300, value: 'done' }).then(value => { finished = true; return value; });
  await started;
  await delay(20);
  expect(finished).toBe(false);
  expect(await job).toBe('done');
});

it('rejects outstanding work on shutdown and refuses new work', async () => {
  const pool = make();
  const first = pool.run({ delay: 1000 });
  const second = pool.run({});
  const checks = [expect(first).rejects.toMatchObject({ code: 'CLOSED' }), expect(second).rejects.toMatchObject({ code: 'CLOSED' })];
  await pool.close(); await Promise.all(checks);
  await expect(pool.run({})).rejects.toMatchObject({ code: 'CLOSED' });
});
