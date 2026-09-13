export const COMMAND_PHASES = {
  'notice:dismiss': ['idle', 'matchmaking', 'in-room', 'in-game', 'spectating'],
  'matchmaking:join': ['idle'],
  'matchmaking:leave': ['matchmaking'],
  'room:create': ['idle'],
  'challenge:send': ['idle'],
  'challenge:decline': ['idle', 'matchmaking', 'in-room', 'in-game', 'spectating'],
  'room:invite': ['in-room'],
  'room:invite-decline': ['idle', 'matchmaking', 'in-room', 'in-game', 'spectating'],
  'room:join': ['idle'],
  'room:leave': ['in-room', 'spectating'],
  'room:ready': ['in-room'],
  'room:settings': ['in-room'],
  'room:kick': ['in-room'],
  'room:spectate': ['idle'],
  'bot:play': ['idle', 'matchmaking'],
  'bot:join': ['in-room'],
  'game:move': ['in-game'],
  'game:reveal-done': ['in-game'],
  'game:recovery-ready': ['in-game'],
  'game:resign': ['in-game'],
  'game:draw-offer': ['in-game'],
  'game:draw-response': ['in-game'],
  'game:leave': ['in-game'],
  'game:rematch-request': ['in-game'],
};

export class CommandRejected extends Error {}
export function reject(reason) { throw new CommandRejected(typeof reason === 'string' ? reason : reason.error || reason.reason); }

// Domain policy: commands are bound to a lifecycle phase and its exact context.
// One allowance: a command permitted in `idle` is also accepted from a finished game.
// The server releases the finished game first (exactly what `game:leave` does), then runs it.
export function createSessionDispatcher(session, actions, { finishedGame = () => false, release = () => {} } = {}) {
  return async request => {
    const allowed = COMMAND_PHASES[request.type];
    if (!allowed || !actions[request.type]) reject('Unknown command');
    const fromFinishedGame = !allowed.includes(session.phase) && allowed.includes('idle') &&
      session.phase === 'in-game' && finishedGame(session.gameId);
    if (!allowed.includes(session.phase) && !fromFinishedGame) reject('Your session has changed. Please try again.');
    if (request.context?.gameId !== session.gameId || request.context?.roomId !== session.roomId ||
        request.context?.spectatingRoomId !== session.spectatingRoomId) reject('This command belongs to a previous room or game');
    const data = request.data && typeof request.data === 'object' && !Array.isArray(request.data) ? request.data : {};
    if (fromFinishedGame) await release(session, request);
    await actions[request.type](data, request);
  };
}
