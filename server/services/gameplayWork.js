import { gameplayOwner, GameplayOwnershipLost } from './gameplayOwnership.js';

// Runtime admission and draining, separate from database ownership fencing.
// A captured lifetime cannot adopt a later owner after an asynchronous wait.
let lifetime = null;
const pending = new Set();
const newLifetime = owner => ({ owner, stopped: false, controller: new AbortController() });
function stopLifetime(value) {
  if (!value) return;
  value.stopped = true;
  value.controller.abort();
}

export function runGameplayWork(work, enqueue = action => Promise.resolve().then(action)) {
  let owner;
  try { owner = gameplayOwner(); } catch (error) { return Promise.reject(error); }
  if (lifetime?.owner !== owner) {
    stopLifetime(lifetime);
    lifetime = newLifetime(owner);
  }
  const captured = lifetime;
  const isCurrent = () => {
    if (captured.stopped) return false;
    try { return gameplayOwner() === owner; } catch { return false; }
  };
  const assertCurrent = () => {
    if (!isCurrent()) throw new GameplayOwnershipLost('Gameplay runtime stopped or replaced');
  };
  // Register before work starts, including work that fails synchronously.
  // A caller may reserve a session queue synchronously. The lifetime is still
  // captured at admission and shutdown also drains work waiting in that queue.
  const task = enqueue(() => {
    assertCurrent();
    return work({ owner, isCurrent, assertCurrent, signal: captured.controller.signal });
  });
  pending.add(task);
  task.then(() => pending.delete(task), () => pending.delete(task));
  return task;
}

export function stopGameplayWork() {
  try {
    const owner = gameplayOwner();
    if (lifetime?.owner !== owner) {
      stopLifetime(lifetime);
      lifetime = newLifetime(owner);
    }
  } catch { /* Ownership loss already denies admission. */ }
  stopLifetime(lifetime);
  return Promise.allSettled([...pending]);
}

// An unavailable confirmation is not a failed write. Keep the owning work
// pending until its recovery read succeeds or this runtime stops. No DB lock is
// held during backoff, and shutdown interrupts the wait immediately.
export async function retryGameplayRecovery(work, recover) {
  let delay = 1000;
  for (;;) {
    work.assertCurrent();
    try {
      const value = await recover();
      work.assertCurrent();
      return value;
    } catch (error) {
      work.assertCurrent();
      if (delay === 1000) console.error('Gameplay confirmation unavailable; retrying:', error.message);
      await new Promise((resolve, reject) => {
        const finish = () => { work.signal.removeEventListener('abort', abort); resolve(); };
        const timer = setTimeout(finish, delay);
        const abort = () => {
          clearTimeout(timer);
          work.signal.removeEventListener('abort', abort);
          reject(new GameplayOwnershipLost('Gameplay runtime stopped during recovery'));
        };
        work.signal.addEventListener('abort', abort, { once: true });
        if (work.signal.aborted) abort();
      });
      delay = Math.min(delay * 2, 10000);
    }
  }
}

export function gameplayActions(actions, bypass = []) {
  return Object.fromEntries(Object.entries(actions).map(([name, action]) => [name,
    bypass.includes(name) ? action : (data, request) => runGameplayWork(work => action(data, request, work))
  ]));
}
