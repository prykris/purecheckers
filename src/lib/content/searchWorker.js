import { restoreSearchState, chooseSearchMove } from '../../../shared/botSearch.js';

self.onmessage = ({ data: { id, payload } }) => {
  try { self.postMessage({ id, result: chooseSearchMove(restoreSearchState(payload.state), payload.options) }); }
  catch (error) { self.postMessage({ id, error: error.message }); }
};
