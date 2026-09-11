const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;
export const FRIENDSHIP_CHANGED = 'friendship:changed';
export class FriendshipError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function normalizeFriendshipAction(kind, body = {}) {
  if (!['request', 'accept', 'remove'].includes(kind)) throw new FriendshipError('Unknown friendship action');
  if (typeof body?.requestId !== 'string' || !uuid.test(body.requestId)) throw new FriendshipError('A valid requestId is required; reload and retry');
  if (body.displayName !== undefined && (typeof body.displayName !== 'string' || body.displayName.length > 100)) throw new FriendshipError('Invalid display name');
  let payload;
  if (kind === 'request') {
    if (body.userId !== undefined) {
      if (!validId(body.userId) || body.friendCode !== undefined) throw new FriendshipError('Choose one valid player');
      payload = { userId: body.userId };
    } else {
      if (typeof body.friendCode !== 'string' || !/^[a-z0-9]{6,8}$/i.test(body.friendCode.trim())) throw new FriendshipError('Enter a valid friend code');
      payload = { friendCode: body.friendCode.trim().toUpperCase() };
    }
  } else {
    if (!validId(body.friendshipId)) throw new FriendshipError('Valid friendshipId required');
    payload = { friendshipId: body.friendshipId };
  }
  return { kind, payload, requestId: body.requestId };
}
export function validFriendshipIntent(intent) {
  try { normalizeFriendshipAction(intent?.kind, { ...intent?.payload, requestId: intent?.requestId }); return true; } catch { return false; }
}
export function validFriendshipReceipt(receipt, intent, userId) {
  return receipt?.userId === userId && receipt?.requestId === intent.requestId && receipt?.kind === intent.kind &&
    (intent.kind !== 'request' || intent.payload.userId === undefined ||
      (receipt.friendship?.requesterId === userId && receipt.friendship.receiverId === intent.payload.userId)) &&
    validId(receipt.friendship?.id) && (intent.kind === 'request' || receipt.friendship.id === intent.payload.friendshipId) &&
    (intent.kind === 'remove' ? receipt.removed === true : receipt.friendship.status === (intent.kind === 'request' ? 'PENDING' : 'ACCEPTED'));
}
