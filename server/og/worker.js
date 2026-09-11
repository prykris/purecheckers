import { parentPort } from 'node:worker_threads';
import { renderPng } from './render.js';
parentPort.on('message', ({ id, payload }) => {
  try { parentPort.postMessage({ id, result: renderPng(payload.svg) }); }
  catch (err) { parentPort.postMessage({ id, error: err.message }); }
});
