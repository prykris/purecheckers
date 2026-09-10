export const COMMAND_PHASES = {
  'matchmaking:join': ['idle'],
  'matchmaking:leave': ['matchmaking'],
  'room:create': ['idle'],
  'room:join': ['idle'],
  'room:leave': ['in-room', 'spectating'],
  'room:ready': ['in-room'],
  'room:kick': ['in-room'],
  'room:spectate': ['idle'],
  'bot:play': ['idle'],
  'bot:join': ['in-room'],
  'game:move': ['in-game'],
  'game:reveal-done': ['in-game'],
  'game:resign': ['in-game'],
  'game:draw-offer': ['in-game'],
  'game:draw-response': ['in-game'],
  'game:leave': ['in-game'],
  'game:rematch-request': ['in-game'],
};

export class CommandRejected extends Error {}
export function reject(reason) { throw new CommandRejected(typeof reason === 'string' ? reason : reason.error || reason.reason); }

// Domain policy: commands are bound to a lifecycle phase and its exact context.
export function createSessionDispatcher(session, actions) {
  return async request => {
    const allowed = COMMAND_PHASES[request.type];
    if (!allowed || !actions[request.type]) reject('Unknown command');
    if (!allowed.includes(session.phase)) reject('Your session has changed. Please try again.');
    if (request.context?.gameId !== session.gameId || request.context?.roomId !== session.roomId ||
        request.context?.spectatingRoomId !== session.spectatingRoomId) reject('This command belongs to a previous room or game');
    const data = request.data && typeof request.data === 'object' && !Array.isArray(request.data) ? request.data : {};
    await actions[request.type](data);
  };
}
