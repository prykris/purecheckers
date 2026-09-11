import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '@prisma/client';
import prisma from '../db.js';
import { normalizeFriendshipAction, FriendshipError } from '../../shared/friendshipActions.js';
import { inEconomyTransaction, lockEconomyUsers } from './economy.js';
import { assertActiveAccount } from './accounts.js';

const pair = (a, b) => ({ OR: [{ requesterId: a, receiverId: b }, { requesterId: b, receiverId: a }] });
const person = { id: true, username: true, elo: true, friendCode: true };

export async function readFriends(userId, presence = () => 'offline', db = prisma) {
  const rows = await db.$transaction(tx => tx.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { receiverId: userId }], requester: { guestRetiredAt: null }, receiver: { guestRetiredAt: null } },
    include: { requester: { select: person }, receiver: { select: person } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return {
    friends: rows.filter(row => row.status === 'ACCEPTED').map(row => {
      const friend = row.requesterId === userId ? row.receiver : row.requester;
      return { friendshipId: row.id, ...friend, status: presence(friend.id) };
    }),
    requests: rows.filter(row => row.status === 'PENDING' && row.receiverId === userId),
    outgoing: rows.filter(row => row.status === 'PENDING' && row.requesterId === userId)
  };
}

export function executeFriendshipAction(userId, kind, body, transaction = null) {
  if (!Number.isSafeInteger(userId) || userId < 1 || userId > 2_147_483_647) throw new FriendshipError('Invalid account', 401);
  const { payload, requestId } = normalizeFriendshipAction(kind, body);
  return inEconomyTransaction(transaction, async tx => {
    // Discover the pair, then lock both accounts in the same order as tips and
    // account cleanup. Re-read mutable relationship state after acquiring locks.
    const candidate = kind === 'request'
      ? await tx.user.findUnique({ where: payload.userId !== undefined ? { id: payload.userId } : { friendCode: payload.friendCode }, select: { id: true } })
      : await tx.friendship.findUnique({ where: { id: payload.friendshipId } });
    const ids = kind === 'request' ? [userId, candidate?.id] : [userId, candidate?.requesterId, candidate?.receiverId];
    await lockEconomyUsers(tx, ids.filter(id => id !== undefined));
    assertActiveAccount(await tx.user.findUnique({ where: { id: userId } }));
    const existing = await tx.friendshipOperation.findUnique({ where: { userId_key: { userId, key: requestId } } });
    if (existing) {
      if (existing.kind !== kind || !isDeepStrictEqual(existing.payload, payload)) throw new FriendshipError('Request ID was already used for a different action', 409);
      return existing.receipt;
    }
    let friendship;
    if (kind === 'request') {
      const target = candidate && await tx.user.findUnique({ where: { id: candidate.id } });
      if (!target || target.guestRetiredAt || (payload.friendCode !== undefined && target.friendCode !== payload.friendCode)) throw new FriendshipError('Player not found', 404);
      if (target.isBot) throw new FriendshipError('Choose a human player');
      if (target.id === userId) throw new FriendshipError('Cannot friend yourself');
      const prior = await tx.friendship.findFirst({ where: pair(userId, target.id) });
      if (prior) throw new FriendshipError(prior.status === 'BLOCKED' ? 'Cannot send request' : prior.status === 'ACCEPTED' ? 'Already friends' : 'Request already pending', prior.status === 'BLOCKED' ? 403 : 409);
      friendship = await tx.friendship.create({ data: { requesterId: userId, receiverId: target.id } });
    } else {
      friendship = await tx.friendship.findUnique({ where: { id: payload.friendshipId } });
      if (!friendship) throw new FriendshipError('Friendship not found', 404);
      if (!candidate || candidate.requesterId !== friendship.requesterId || candidate.receiverId !== friendship.receiverId) throw new FriendshipError('Relationship changed; refresh and retry', 409);
      if (kind === 'accept' ? friendship.receiverId !== userId : ![friendship.requesterId, friendship.receiverId].includes(userId)) throw new FriendshipError('Not your request', 403);
      if (friendship.status === 'BLOCKED') throw new FriendshipError('This relationship cannot be changed here', 403);
      if (kind === 'accept') {
        if (friendship.status !== 'PENDING') throw new FriendshipError('Not a pending request', 409);
        const requester = await tx.user.findUnique({ where: { id: friendship.requesterId } });
        if (!requester || requester.guestRetiredAt || requester.isBot) throw new FriendshipError('Player is unavailable', 404);
        friendship = await tx.friendship.update({ where: { id: friendship.id }, data: { status: 'ACCEPTED' } });
      } else await tx.friendship.delete({ where: { id: friendship.id } });
    }
    const receipt = JSON.parse(JSON.stringify({ userId, requestId, kind, friendship, removed: kind === 'remove' }));
    await tx.friendshipOperation.create({ data: { userId, key: requestId, kind, payload, receipt } });
    return receipt;
  });
}
