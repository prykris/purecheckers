import { WorkerPool } from './workerPool.js';
import { searchState } from '../../shared/botSearch.js';
import { getBotDefinition } from '../domain/botRegistry.js';

const configured = Number(process.env.BOT_WORKERS ?? 1);
const pool = new WorkerPool(new URL('./searchWorker.js', import.meta.url), { size: Number.isInteger(configured) ? Math.min(4, Math.max(1, configured)) : 1, maxQueue: 32 });
export const closeSearchPool = () => pool.close();

export async function chooseBotMove(game, difficulty, { signal } = {}) {
  const definition = getBotDefinition(difficulty);
  if (!definition) throw new Error('Unknown bot difficulty');
  const legal = game.getAllValidMoves();
  if (legal.length <= 1) return legal[0] ?? null;
  try {
    const proposal = await pool.run({ kind: 'move', state: searchState(game), options: { depth: definition.depth, timeMs: 350 } }, { signal, timeoutMs: 2000, priority: 1 });
    const accepted = legal.find(move => proposal && ['fromRow', 'fromCol', 'toRow', 'toCol'].every(key => move[key] === proposal[key]));
    if (!accepted) throw new Error('Worker returned no legal proposal');
    return accepted;
  } catch (err) {
    if (signal?.aborted || err.code === 'ABORTED') return null;
    // Overload, worker crash or timeout must not strand an unlimited-clock bot
    // game. A legal fallback is checked again against the live game by its owner.
    console.warn('Bot search fallback:', err.code ?? err.message);
    return legal[Math.floor(Math.random() * legal.length)];
  }
}

export async function analyzeMoveQuality(game, move, _color, { signal } = {}) {
  try {
    return await pool.run({ kind: 'grade', state: searchState(game), move, options: { depth: 6, timeMs: 150 } }, { signal, timeoutMs: 1000, priority: 0 });
  } catch { return null; } // Grading is optional; it never delays or blocks play.
}
