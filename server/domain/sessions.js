
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
    this.notice = null;
    this.noticeCursor = { sequence: 0n, dismissed: false };

    // Context (set based on phase)
    this.roomId = null;
    this.gameId = null;
    this.gameColor = null;
    this.spectatingRoomId = null;
    this.spectatingGameId = null;
    // Search fallback: when the queue was entered and when "play a bot instead" opens.
    this.matchmakingJoinedAt = null;
    this.matchmakingFallbackAt = null;
    this.fallbackTimer = null;

    // Disconnect handling
    this.disconnectedAt = null;
    this.disconnectDeadline = null;
    this.disconnectTimer = null;
  }

  clearContext() {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
    this.disconnectDeadline = null;
    this.roomId = null;
    this.gameId = null;
    this.gameColor = null;
    this.spectatingRoomId = null;
    this.spectatingGameId = null;
    this.matchmakingJoinedAt = null;
    this.matchmakingFallbackAt = null;
    if (this.fallbackTimer) { clearTimeout(this.fallbackTimer); this.fallbackTimer = null; }
  }
}

// ---- Public API ----

export function getSession(userId) {
  return sessions.get(userId) || null;
}

// Project only accepted records. A delayed pre-dismissal read cannot revive an
// event, and a delayed older event cannot overwrite a newer one.
export function applySessionNotice(userId, record) {
  const session = getSession(userId);
  if (!session || !record) return;
  const cursor = session.noticeCursor;
  if (record.sequence < cursor.sequence || (record.sequence === cursor.sequence && cursor.dismissed)) return;
  const dismissed = record.dismissedAt !== null;
  session.noticeCursor = { sequence: record.sequence, dismissed };
  session.notice = dismissed ? null : { id: record.id, reason: record.reason, context: record.context, occurredAt: record.occurredAt.getTime() };
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
 * Record the search deadline on a matchmaking session and arm the timer that
 * re-checks the phase at the deadline. Leaving the phase (clearContext) cancels it.
 */
export function setMatchmakingDeadline(userId, joinedAt, fallbackAt, onDeadline) {
  const session = sessions.get(userId);
  if (!session || session.phase !== 'matchmaking') return false;
  if (session.fallbackTimer) { clearTimeout(session.fallbackTimer); session.fallbackTimer = null; }
  session.matchmakingJoinedAt = joinedAt;
  session.matchmakingFallbackAt = fallbackAt;
  const delay = fallbackAt - Date.now();
  if (delay <= 0) return true; // already open; the next snapshot says so
  let timer;
  function arm(remaining) {
    timer = setTimeout(checkDeadline, Math.min(2_147_483_647, Math.max(1, Math.ceil(remaining))));
    session.fallbackTimer = timer;
    timer.unref?.();
  }
  function checkDeadline() {
    // Timers can wake before wall time reaches the deadline. A cleared callback
    // may also belong to an older search, even when its timestamps were reused.
    if (sessions.get(userId) !== session || session.phase !== 'matchmaking' ||
        session.fallbackTimer !== timer || session.matchmakingJoinedAt !== joinedAt ||
        session.matchmakingFallbackAt !== fallbackAt) return;
    const remaining = fallbackAt - Date.now();
    if (remaining > 0) { arm(remaining); return; }
    session.fallbackTimer = null;
    onDeadline(userId);
  }
  arm(delay);
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

export function setDisconnectCallbacks({ onGameTimeout }) {
  onGameDisconnectTimeout = onGameTimeout;
}

/**
 * Handle socket disconnect — mark session as disconnected, start timeout.
 */
export function handleDisconnect(userId) {
  const session = sessions.get(userId);
  if (!session) return;
  if (!session.connectionId && session.disconnectTimer) return;
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
      session.disconnectDeadline = session.disconnectedAt + 30000;
      session.disconnectTimer = setTimeout(() => {
        session.disconnectTimer = null;
        session.disconnectDeadline = null;
        if (session.phase === 'in-game' && !session.connectionId && onGameDisconnectTimeout) {
          console.log(`[UserState] Game disconnect timeout: ${session.username} (${userId})`);
          onGameDisconnectTimeout(userId, session.gameId);
        }
      }, 30000);
      break;
    }
    // Room players and spectators use the room's persisted deadline and timer.
    case 'matchmaking': {
      // Immediately remove from queue
      forceIdle(userId);
      break;
    }
    // spectating, idle — no timer needed
  }
  session.disconnectTimer?.unref?.();
}

/**
 * Handle socket reconnect — restore socket ref, clear disconnect state.
 */
export function handleReconnect(userId, connectionId) {
  const session = sessions.get(userId);
  if (!session) return;
  session.connectionId = connectionId;
  session.disconnectedAt = null;
  session.disconnectDeadline = null;
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
  if (session?.fallbackTimer) clearTimeout(session.fallbackTimer);
  sessions.delete(userId);
}

/**
 * Get all sessions (for presence stats, etc.)
 */
export function getAllSessions() {
  return sessions;
}
