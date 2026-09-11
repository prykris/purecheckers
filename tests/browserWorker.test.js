import { browserWorkerAdapter } from '../src/lib/content/search.js';
import { WorkerPool } from '../shared/workerPool.js';

it('uses the shared scheduling core for browser replies, cancellation and replacement', async () => {
  const workers = [];
  const pool = new WorkerPool(null, { size: 1, maxQueue: 1, workerFactory: () => {
    const worker = { listeners: {}, sent: [], terminate: vi.fn(),
      addEventListener(type, fn) { this.listeners[type] = fn; }, postMessage(data) { this.sent.push(data); } };
    workers.push(worker); return browserWorkerAdapter(worker);
  } });
  const abort = new AbortController();
  const first = pool.run({ board: 'first' }, { signal: abort.signal });
  const cancelled = expect(first).rejects.toMatchObject({ code: 'ABORTED' });
  const next = pool.run({ board: 'second' }); abort.abort(); await cancelled;
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(workers[0].terminate).toHaveBeenCalledOnce(); expect(workers).toHaveLength(2);
  workers[0].listeners.message({ data: { id: workers[0].sent[0].id, result: 'stale' } });
  workers[1].listeners.message({ data: { id: workers[1].sent[0].id, result: 'current' } });
  expect(await next).toBe('current'); await pool.close();
});

it('reports browser worker errors through the same failure path', async () => {
  const listeners = {}, terminate = vi.fn(), preventDefault = vi.fn();
  const pool = new WorkerPool(null, { workerFactory: () => browserWorkerAdapter({
    addEventListener(type, fn) { listeners[type] = fn; }, postMessage() {}, terminate,
  }) });
  const job = pool.run({}); const failed = expect(job).rejects.toThrow('failed');
  listeners.error({ preventDefault, message: 'failed' }); await failed;
  expect(preventDefault).toHaveBeenCalledOnce(); expect(terminate).toHaveBeenCalledOnce(); await pool.close();
});
