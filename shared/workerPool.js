
export class WorkerPoolError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Scheduling and transport only. Workers return proposals; callers own domain
// validity, stale-result checks and overload behavior.
export class WorkerPool {
  constructor(url, { size = 1, maxQueue = 32, workerFactory, resourceFactory = () => ({ runInAsyncScope: (fn, receiver, value) => fn.call(receiver, value), emitDestroy() {} }) } = {}) {
    if (!Number.isInteger(size) || size < 1 || !Number.isInteger(maxQueue) || maxQueue < 0) throw new Error('Invalid worker pool limits');
    this.size = size;
    this.maxQueue = maxQueue;
    if (typeof workerFactory !== 'function') throw new Error('Worker factory required');
    this.workerFactory = workerFactory;
    this.resourceFactory = resourceFactory;
    this.slots = new Set();
    this.queue = [];
    this.nextId = 1;
    this.closed = false;
  }

  run(payload, { signal, timeoutMs = 2000, priority = 0 } = {}) {
    if (this.closed) return Promise.reject(new WorkerPoolError('CLOSED', 'Worker pool closed'));
    if (signal?.aborted) return Promise.reject(new WorkerPoolError('ABORTED', 'Work cancelled'));
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new WorkerPoolError('TIMEOUT', 'Work deadline exceeded'));
    const idle = [...this.slots].some(s => !s.retired && !s.job);
    if (!idle && this.slots.size >= this.size && this.queue.length >= this.maxQueue) return Promise.reject(new WorkerPoolError('BUSY', 'Worker queue full'));
    return new Promise((resolve, reject) => {
      const job = { id: this.nextId++, payload, priority, signal, resolve, reject, resource: this.resourceFactory(), slot: null, done: false };
      job.cancel = () => this.finish(job, new WorkerPoolError('ABORTED', 'Work cancelled'), null, true);
      job.timer = setTimeout(() => this.finish(job, new WorkerPoolError('TIMEOUT', 'Work deadline exceeded'), null, true), timeoutMs);
      signal?.addEventListener('abort', job.cancel, { once: true });
      this.queue.push(job);
      this.queue.sort((a, b) => b.priority - a.priority || a.id - b.id);
      this.drain();
    });
  }

  spawn() {
    const worker = this.workerFactory();
    const slot = { worker, job: null, retired: false };
    this.slots.add(slot);
    worker.on('message', message => {
      if (slot.retired || slot.job?.id !== message.id) return;
      this.finish(slot.job, message.error ? new WorkerPoolError('WORKER', message.error) : null, message.result);
    });
    worker.on('error', err => this.failSlot(slot, err));
    worker.on('exit', code => { if (!slot.retired) this.failSlot(slot, new WorkerPoolError('EXIT', `Worker exited (${code})`)); });
    worker.unref();
    return slot;
  }

  failSlot(slot, err) {
    if (slot.retired) return;
    if (slot.job) this.finish(slot.job, err, null, true);
    else { this.retire(slot); this.drain(); }
  }

  retire(slot) {
    slot.retired = true;
    // A terminating worker still counts against the thread limit until it exits.
    void slot.worker.terminate().catch(() => {}).finally(() => { this.slots.delete(slot); this.drain(); });
  }

  finish(job, err, result, retire = false) {
    if (job.done) return;
    job.done = true;
    clearTimeout(job.timer);
    job.signal?.removeEventListener('abort', job.cancel);
    const index = this.queue.indexOf(job);
    if (index >= 0) this.queue.splice(index, 1);
    if (job.slot) {
      job.slot.job = null;
      if (retire) this.retire(job.slot);
      else job.slot.worker.unref();
    }
    job.resource.runInAsyncScope(err ? job.reject : job.resolve, null, err ?? result);
    job.resource.emitDestroy();
    this.drain();
  }

  drain() {
    while (!this.closed && this.queue.length) {
      let slot = [...this.slots].find(s => !s.retired && !s.job);
      if (!slot) {
        if (this.slots.size >= this.size) return;
        try { slot = this.spawn(); }
        catch (err) { this.finish(this.queue[0], err); return; }
      }
      const job = this.queue.shift();
      slot.job = job; job.slot = slot;
      slot.worker.ref();
      try { slot.worker.postMessage({ id: job.id, payload: job.payload }); }
      catch (err) { this.finish(job, err, null, true); }
    }
  }

  async close() {
    this.closed = true;
    for (const job of [...this.queue, ...[...this.slots].map(s => s.job).filter(Boolean)]) this.finish(job, new WorkerPoolError('CLOSED', 'Worker pool closed'));
    const workers = [...this.slots];
    for (const slot of workers) { slot.retired = true; this.slots.delete(slot); }
    await Promise.all(workers.map(s => s.worker.terminate()));
  }
}
