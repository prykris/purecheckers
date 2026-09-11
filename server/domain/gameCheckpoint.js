import { CheckersGame } from '../../shared/game.js';

// Explicit durable state contract. Transport state, promises and runtime timers
// never enter a checkpoint. GameRoom and future restoration share this codec.
export function encodeCheckpoint(state) {
  return {
    schema: 1, engine: JSON.parse(JSON.stringify(state.game)),
    started: state.started, startedAt: state.startedAt.toISOString(),
    endedAt: state.endedAt, endReason: state.endReason,
    revealAcks: [...state.revealAcks], revealDeadline: state.revealDeadline,
    pendingDrawOffer: state.pendingDrawOffer, lastDrawOffer: { ...state.lastDrawOffer },
    recovery: state.recovery ? structuredClone(state.recovery) : null
  };
}

export function decodeCheckpoint(checkpoint) {
  if (checkpoint?.schema !== 1) throw new Error('Unsupported game checkpoint');
  const { engine, schema, ...state } = structuredClone(checkpoint);
  return { ...state, recovery: state.recovery || null, game: Object.assign(new CheckersGame(engine.turnTime), engine),
    startedAt: new Date(state.startedAt), revealAcks: new Set(state.revealAcks) };
}

export function terminalIntentFor(run, checkpoint) {
  if (!checkpoint.engine.gameOver) return null;
  return { key: run.key, redUserId: run.redPlayerId, blackUserId: run.blackPlayerId,
    mode: run.mode, buyIn: run.buyIn, winner: checkpoint.engine.winner,
    moveHistory: checkpoint.engine.moveHistory, startedAt: checkpoint.startedAt,
    endedAt: new Date(checkpoint.endedAt).toISOString(),
    endReason: checkpoint.endReason || checkpoint.engine.drawReason || 'no-moves' };
}
