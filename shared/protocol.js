// The authoritative session protocol. Domain notifications (chat, emotes, lobby
// lists) are deliberately outside this contract and never change session state.
export const PROTOCOL_VERSION = 1;
export const COMMAND_TTL_MS = 30_000;


export function validSnapshot(value) {
  if (!value || value.protocolVersion !== PROTOCOL_VERSION || typeof value.serverId !== 'string' ||
      !Number.isSafeInteger(value.sequence) || typeof value.connectionId !== 'string') return false;
  switch (value.phase) {
    case 'idle': case 'matchmaking': return true;
    case 'in-room': return !!value.room?.id;
    case 'in-game': return !!value.game?.gameId && Array.isArray(value.game.board);
    case 'spectating': return !!value.spectate?.roomId;
    default: return false;
  }
}
