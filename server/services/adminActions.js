import { isDeepStrictEqual } from 'node:util';
import { normalizeAdminAction, adminProfileChange, AdminActionError } from '../../shared/adminActions.js';
import { inEconomyTransaction, lockEconomyUsers } from './economy.js';
import { assertActiveAccount } from './accounts.js';
import { awardCoins, deductCoins } from './coins.js';

const fields = { id: true, username: true, coins: true, elo: true, peakElo: true, gamesPlayed: true, wins: true, losses: true, isAdmin: true, lastDailyWin: true };

export async function executeAdminAction(actorId, kind, body, transaction = null) {
  const { payload, requestId } = normalizeAdminAction(actorId, kind, body);
  return inEconomyTransaction(transaction, async tx => {
    await lockEconomyUsers(tx, [actorId, payload.userId]);
    const actor = assertActiveAccount(await tx.user.findUnique({ where: { id: actorId } }));
    const existing = await tx.adminOperation.findUnique({ where: { actorId_key: { actorId, key: requestId } } });
    if (existing) {
      if (existing.kind !== kind || !isDeepStrictEqual(existing.payload, payload)) throw new AdminActionError('Request ID was already used for a different action', 409);
      // A lost self-revocation response remains confirmable by that actor.
      return existing.receipt;
    }
    if (!actor.isAdmin) throw new AdminActionError('Admin access required', 403);
    const target = await tx.user.findUnique({ where: { id: payload.userId } });
    if (!target || target.guestRetiredAt) throw new AdminActionError('Target account is unavailable', 404);
    if (kind === 'set-elo' || kind === 'reset-stats') {
      const [room, result, run] = await Promise.all([
        tx.activeRoomMember.findUnique({ where: { userId: target.id } }),
        tx.activeResultViewer.findUnique({ where: { userId: target.id } }),
        tx.gameRun.findFirst({ where: { status: 'OPEN', OR: [{ redPlayerId: target.id }, { blackPlayerId: target.id }] }, select: { id: true } })
      ]);
      if (room || result || run) throw new AdminActionError('Finish and leave the current room or game before changing ratings or statistics', 409);
    }
    const before = await tx.user.findUnique({ where: { id: target.id }, select: fields });
    if (kind === 'give-coins') {
      if (target.coins + payload.amount > 2_147_483_647) throw new AdminActionError('Coin balance would exceed its limit');
      const operation = payload.amount > 0 ? awardCoins : deductCoins;
      const result = await operation(target.id, Math.abs(payload.amount), 'ADMIN_ADJUSTMENT', tx);
      await tx.coinTransaction.update({ where: { id: result.transaction.id }, data: { senderId: actorId } });
    } else {
      await tx.user.update({ where: { id: target.id }, data: adminProfileChange(kind, payload, target) });
    }
    const user = await tx.user.findUnique({ where: { id: target.id }, select: fields });
    const receipt = JSON.parse(JSON.stringify({ requestId, actorId, kind, user, before }));
    await tx.adminOperation.create({ data: { actorId, targetId: target.id, key: requestId, kind, payload, receipt } });
    return receipt;
  });
}
