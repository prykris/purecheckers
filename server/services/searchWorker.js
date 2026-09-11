import { parentPort } from 'node:worker_threads';
import { restoreSearchState, chooseSearchMove, gradeSearchMove } from '../../shared/botSearch.js';

parentPort.on('message', ({ id, payload }) => {
  try {
    const game = restoreSearchState(payload.state);
    const result = payload.kind === 'move' ? chooseSearchMove(game, payload.options)
      : payload.kind === 'grade' ? gradeSearchMove(game, payload.move, payload.options)
      : (() => { throw new Error('Unknown search task'); })();
    parentPort.postMessage({ id, result });
  } catch (err) { parentPort.postMessage({ id, error: err.message }); }
});
