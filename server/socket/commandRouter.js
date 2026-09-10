import { COMMAND_TTL_MS, PROTOCOL_VERSION } from '../../shared/protocol.js';
import { CommandRejected } from '../domain/sessionCommands.js';

// Transport reliability only. Domain services decide whether a command is legal.
export function attachCommandTransport(socket, session, { serverId, publish, dispatch }) {
  socket.on('session:command', (request, ack) => {
    if (typeof ack !== 'function') return;
    const task = (session.commands || Promise.resolve()).then(async () => {
      const response = result => ({ ...result, snapshot: publish(socket, socket.userId) });
      const fail = error => response({ ok: false, error });
      if (session.connectionId !== socket.id) return { ok: false, error: 'Session replaced' };
      if (request?.protocolVersion !== PROTOCOL_VERSION || request.serverId !== serverId) return fail('Server session changed. Please try again.');
      if (typeof request.id !== 'string' || !request.id || request.id.length > 80 || !Number.isFinite(request.createdAt) ||
          Math.abs(Date.now() - request.createdAt) > COMMAND_TTL_MS) return fail('Command expired. Please try again.');
      session.receipts ||= new Map();
      for (const [id, receipt] of session.receipts) if (Date.now() - receipt.createdAt > COMMAND_TTL_MS) session.receipts.delete(id);
      const fingerprint = JSON.stringify([request.type, request.context, request.data]);
      const prior = session.receipts.get(request.id);
      if (prior) {
        if (prior.fingerprint !== fingerprint) return fail('Command ID reused with different contents');
        return response(prior.result);
      }
      if (session.receipts.size >= 256) return fail('Too many requests. Please wait.');
      let result;
      try { await dispatch(request); result = { ok: true }; }
      catch (error) {
        if (!(error instanceof CommandRejected)) console.error('Command failed:', request.type, error);
        result = { ok: false, error: error instanceof CommandRejected ? error.message : 'Request failed. Please try again.' };
      }
      session.receipts.set(request.id, { fingerprint, createdAt: request.createdAt, result });
      return response(result);
    });
    session.commands = task.catch(error => console.error('Command transport failed:', error));
    task.then(ack).catch(() => ack({ ok: false, error: 'Recovery failed. Reconnect to retry.' }));
  });
}
