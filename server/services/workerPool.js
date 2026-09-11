import { Worker } from 'node:worker_threads';
import { AsyncResource } from 'node:async_hooks';
import { WorkerPool as SharedWorkerPool } from '../../shared/workerPool.js';
export { WorkerPoolError } from '../../shared/workerPool.js';

// Node lifecycle and diagnostic context; scheduling is shared with browser diagrams.
export class WorkerPool extends SharedWorkerPool {
  constructor(url, options = {}) {
    super(url, {
      workerFactory: () => new Worker(url, { resourceLimits: { maxOldGenerationSizeMb: 128 } }),
      resourceFactory: () => new AsyncResource('WorkerPoolJob'),
      ...options,
    });
  }
}
