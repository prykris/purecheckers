// Restart readiness is distinct from the original colour reveal and normal
// transport reconnection. A readiness acknowledgement belongs to one connection.
export const RESTART_GRACE_MS = 120_000;

export function readyRecoveryPlayers(recovery, humans, connectionFor) {
  return humans.filter(id => {
    const connection = connectionFor(id);
    return connection && recovery.readyConnections[id] === connection;
  });
}

export function recoveryDecision(recovery, humans, connectionFor, now) {
  const ready = readyRecoveryPlayers(recovery, humans, connectionFor);
  if (ready.length === humans.length) return { type: 'resume' };
  if (now < recovery.deadline) return { type: 'wait' };
  // A bot is never a returning human and never wins an abandoned recovery.
  return ready.length === 1 ? { type: 'forfeit', winnerId: ready[0] } : { type: 'abort' };
}
