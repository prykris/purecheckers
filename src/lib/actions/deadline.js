// Bounds observation even when a transport ignores abort. Cancellation cannot
// establish whether a server write committed; callers retain their receipt or
// account reconciliation policy for uncertain outcomes.
export async function withDeadline(work, timeoutMessage = 'Confirmation timed out. Retry to confirm the same action.',
  { timeoutMs = 15_000, signal } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new RangeError('Invalid request timeout');
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  let timer, onAbort;
  try {
    return await new Promise((resolve, reject) => {
      onAbort = () => reject(controller.signal.reason instanceof Error ? controller.signal.reason : new DOMException('Request cancelled', 'AbortError'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) { cancel(); return; }
      timer = setTimeout(() => {
        const error = new Error(timeoutMessage); error.name = 'TimeoutError';
        controller.abort(error);
      }, timeoutMs);
      try { Promise.resolve(work(controller.signal)).then(resolve, reject); }
      catch (error) { reject(error); }
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
