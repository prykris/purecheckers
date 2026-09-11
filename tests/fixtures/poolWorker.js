import { parentPort } from 'node:worker_threads';
parentPort.on('message', ({ id, payload }) => {
  if (payload.crash) process.exit(1);
  if (payload.spin) {
    parentPort.postMessage({ started: true });
    const end = Date.now() + payload.spin;
    while (Date.now() < end) { /* intentionally CPU-bound fixture */ }
  }
  setTimeout(() => parentPort.postMessage({ id, result: payload.value }), payload.delay ?? 0);
});
