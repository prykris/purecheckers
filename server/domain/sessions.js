/**
 * Server-authoritative user state.
 *
 * Every connected user has a UserSession that tracks their lifecycle phase.
 * Phase transitions are enforced — invalid transitions are rejected.
 * On every connect/reconnect the server pushes a sync:state event built
 * from the session, so the client never has to guess.
 */

// Callback fired after any phase change — used to broadcast presence stats
let onPhaseChangeCallback = null;

export function setOnPhaseChange(cb) {
  onPhaseChangeCallback = cb;
}

function notifyPhaseChange() {
  if (onPhaseChangeCallback) onPhaseChangeCallback();
}

// ---- Phase transition table ----
const VALID_TRANSITIONS = {
  'idle':         ['in-room', 'matchmaking', 'in-game', 'spectating'],
  'in-room':      ['in-game', 'idle'],
  'matchmaking':  ['in-room', 'in-game', 'idle'],
  'in-game':      ['idle'],
  'spectating':   ['idle', 'spectating'],
};

// ---- Sessions map ----
// userId -> UserSession
const sessions = new Map();

class UserSession {
  constructor(userId, username, isGuest) {
    this.userId = userId;
    this.username = username;
    this.isGuest = isGuest;

    this.connectionId = null;

    this.phase = 'idle';

    // Context (set based on phase)
    this.roomId = null;
    this.gameId = null;
    this.gameColor = null;
    this.spectatingRoomId = null;
    this.spectatingGameId = null;

    // Disconnect handling
    this.disconnectedAt = null;
    this.disconnectTimer = null;
  }

  clearContext() {
    this.roomId = null;
    this.gameId = null;
    this.gameColor = null;
    this.spectatingRoomId = null;
    this.spectatingGameId = null;
  }
}

// ---- Public API ----

export function getSession(userId) {
  return sessions.get(userId) || null;
}

export function getOrCreateSession(userId, username, isGuest) {
  let session = sessions.get(userId);
  if (session) {
    // Update mutable fields (username can change on guest upgrade)
    session.username = username;
    session.isGuest = isGuest;
    return session;
  }
  session = new UserSession(userId, username, isGuest);
  sessions.set(userId, session);
  return session;
}

/**
 * Transition a user's phase. Returns true if the transition was valid.
 * context: { roomId?, gameId?, gameColor?, spectatingRoomId?, spectatingGameId? }
 */
export function setPhase(userId, newPhase, context = {}) {
  const session = sessions.get(userId);
  if (!session) return false;

  const allowed = VALID_TRANSITIONS[session.phase];
  if (!allowed || !allowed.includes(newPhase)) {
    console.log(`[UserState] Rejected phase transition: ${session.username} (${userId}) ${session.phase} -> ${newPhase}`);
    return false;
  }

  if ((newPhase === 'in-room' && !context.roomId) || (newPhase === 'in-game' && (!context.gameId || !['red', 'black'].includes(context.gameColor))) || (newPhase === 'spectating' && !context.spectatingRoomId)) return false;
  const oldPhase = session.phase;
  session.phase = newPhase;
  session.clearContext();

  // Apply context
  if (context.roomId != null) session.roomId = context.roomId;
  if (context.gameId != null) session.gameId = context.gameId;
  if (context.gameColor != null) session.gameColor = context.gameColor;
  if (context.spectatingRoomId != null) session.spectatingRoomId = context.spectatingRoomId;
  if (context.spectatingGameId != null) session.spectatingGameId = context.spectatingGameId;

  console.log(`[UserState] Phase: ${session.username} (${userId}) ${oldPhase} -> ${newPhase}`);
  notifyPhaseChange();
  return true;
}

/**
 * Force phase to idle (used for cleanup: game end, kick, etc.)
 * Bypasses transition validation.
 */
export function forceIdle(userId) {
  const session = sessions.get(userId);
  if (!session) return;
  const oldPhase = session.phase;
  session.phase = 'idle';
  session.clearContext();
  if (oldPhase !== 'idle') {
    console.log(`[UserState] Force idle: ${session.username} (${userId}) ${oldPhase} -> idle`);
    notifyPhaseChange();
  }
}

/**
 * Build the sync:state payload for a user.
 * Requires access to gameRooms and activeGames — passed in to avoid circular imports.
 */
// Disconnect timer callbacks — set by handlers to avoid circular imports
let onGameDisconnectTimeout = null;
let onRoomDisconnectTimeout = null;

export function setDisconnectCallbacks({ onGameTimeout, onRoomTimeout }) {
  onGameDisconnectTimeout = onGameTimeout;
  onRoomDisconnectTimeout = onRoomTimeout;
}

/**
 * Handle socket disconnect — mark session as disconnected, start timeout.
 */
export function handleDisconnect(userId) {
  const session = sessions.get(userId);
  if (!session) return;
  session.connectionId = null;
  session.disconnectedAt = Date.now();

  // Start phase-appropriate disconnect timer
  if (session.disconnectTimer) {
    clearTimeout(session.disconnectTimer);
    session.disconnectTimer = null;
  }

  switch (session.phase) {
    case 'in-game': {
      // 30 seconds to reconnect or forfeit
      session.disconnectTimer = setTimeout(() => {
        session.disconnectTimer = null;
        if (session.phase === 'in-game' && !session.connectionId && onGameDisconnectTimeout) {
          console.log(`[UserState] Game disconnect timeout: ${session.username} (${userId})`);
          onGameDisconnectTimeout(userId, session.gameId);
        }
      }, 30000);
      break;
    }
    case 'in-room': {
      // 2 minutes to reconnect or get removed
      session.disconnectTimer = setTimeout(() => {
        session.disconnectTimer = null;
        if (session.phase === 'in-room' && !session.connectionId && onRoomDisconnectTimeout) {
          console.log(`[UserState] Room disconnect timeout: ${session.username} (${userId})`);
          onRoomDisconnectTimeout(userId, session.roomId);
        }
      }, 120000);
      break;
    }
    case 'matchmaking': {
      // Immediately remove from queue
      forceIdle(userId);
      break;
    }
    // spectating, idle — no timer needed
  }
}

/**
 * Handle socket reconnect — restore socket ref, clear disconnect state.
 */
export function handleReconnect(userId, connectionId) {
  const session = sessions.get(userId);
  if (!session) return;
  session.connectionId = connectionId;
  session.disconnectedAt = null;
  if (session.disconnectTimer) {
    clearTimeout(session.disconnectTimer);
    session.disconnectTimer = null;
  }
}

/**
 * Remove session entirely (e.g., guest cleanup after long disconnect).
 */
export function removeSession(userId) {
  const session = sessions.get(userId);
  if (session?.disconnectTimer) {
    clearTimeout(session.disconnectTimer);
  }
  sessions.delete(userId);
}

/**
 * Get all sessions (for presence stats, etc.)
 */
export function getAllSessions() {
  return sessions;
}
