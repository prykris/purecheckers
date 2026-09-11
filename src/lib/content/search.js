import { WorkerPool } from '../../../shared/workerPool.js';
import { searchState } from '../../../shared/botSearch.js';

export function browserWorkerAdapter(worker) {
  return {
    on(event, fn) {
      if (event === 'message') worker.addEventListener('message', event => fn(event.data));
      if (event === 'error') worker.addEventListener('error', event => { event.preventDefault(); fn(new Error(event.message || 'Diagram worker failed')); });
      if (event === 'error') worker.addEventListener('messageerror', () => fn(new Error('Diagram worker reply could not be read')));
    },
    postMessage: payload => worker.postMessage(payload),
    terminate() { worker.terminate(); return Promise.resolve(); },
    ref() {}, unref() {},
  };
}

const pool = new WorkerPool(null, { size: 1, maxQueue: 4,
  workerFactory: () => browserWorkerAdapter(new Worker(new URL('./searchWorker.js', import.meta.url), { type: 'module' })) });
export const closeDiagramSearch = () => pool.close();

export async function chooseDiagramMove(game, depth, signal) {
  const legal = game.getAllValidMoves();
  if (signal.aborted) return null;
  if (legal.length <= 1) return legal[0] || null;
  const proposal = await pool.run({ state: searchState(game), options: { depth, timeMs: 350 } }, { signal, timeoutMs: 2000 });
  return legal.find(move => proposal && ['fromRow', 'fromCol', 'toRow', 'toCol'].every(key => move[key] === proposal[key])) || null;
}
