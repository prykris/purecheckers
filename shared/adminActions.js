const MAX_INT = 2_147_483_647;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ADMIN_ACTIONS = ['give-coins', 'set-elo', 'reset-stats', 'set-admin'];
export class AdminActionError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function normalizeAdminAction(actorId, kind, body = {}) {
  const validId = value => Number.isSafeInteger(value) && value > 0 && value <= MAX_INT;
  if (!validId(actorId) || !ADMIN_ACTIONS.includes(kind) || !body || typeof body !== 'object' || Array.isArray(body)) throw new AdminActionError('Invalid admin action');
  const userId = body.userId === undefined ? actorId : body.userId;
  if (!validId(userId)) throw new AdminActionError('Invalid target account');
  if (typeof body.requestId !== 'string' || !UUID.test(body.requestId)) throw new AdminActionError('A valid requestId is required');
  const payload = { userId };
  if (kind === 'give-coins') {
    if (!Number.isSafeInteger(body.amount) || body.amount === 0 || Math.abs(body.amount) > MAX_INT) throw new AdminActionError('Use a nonzero whole coin amount');
    payload.amount = body.amount;
  }
  if (kind === 'set-elo') {
    if (!Number.isSafeInteger(body.elo) || body.elo < 0 || body.elo > 100_000) throw new AdminActionError('ELO must be a whole number from 0 to 100000');
    payload.elo = body.elo;
  }
  if (kind === 'set-admin') {
    if (typeof body.isAdmin !== 'boolean') throw new AdminActionError('isAdmin must be true or false');
    payload.isAdmin = body.isAdmin;
  }
  if (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 300)) throw new AdminActionError('Reason must be at most 300 characters');
  payload.reason = body.reason?.trim() || '';
  return { kind, payload, requestId: body.requestId };
}

// Resetting displayed statistics must not reopen previously consumed rewards.
export function adminProfileChange(kind, payload, user) {
  if (kind === 'set-elo') return { elo: payload.elo, peakElo: Math.max(user.peakElo, payload.elo) };
  if (kind === 'reset-stats') return { wins: 0, losses: 0, gamesPlayed: 0, elo: 1000, peakElo: Math.max(user.peakElo, 1000) };
  if (kind === 'set-admin') return { isAdmin: payload.isAdmin };
  return null;
}
