import { isDeepStrictEqual } from 'node:util';
import { assertCoinAmount, EconomyError, inEconomyTransaction, lockEconomyUsers } from './economy.js';
import { awardCoins, deductCoins } from './coins.js';
import { calculateShopSplit, depositToVault } from './vault.js';
import { assertActiveAccount } from './accounts.js';
import { equipmentSelection } from '../../shared/equipmentSelection.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertId(id) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) throw new EconomyError('Invalid account or item');
}

// Receipt identity belongs to the authenticated actor. Lock all affected accounts
// first (in sorted order), then check the receipt before mutable business rules.
function execute(userId, requestId, kind, payload, affectedUsers, work, transaction) {
  assertId(userId);
  if (typeof requestId !== 'string' || !UUID.test(requestId)) throw new EconomyError('A valid requestId is required; reload the page and try again');
  return inEconomyTransaction(transaction, async tx => {
    await lockEconomyUsers(tx, affectedUsers);
    assertActiveAccount(await tx.user.findUnique({ where: { id: userId } }));
    const existing = await tx.walletOperation.findUnique({ where: { userId_key: { userId, key: requestId } } });
    if (existing) {
      if (existing.kind !== kind || !isDeepStrictEqual(existing.payload, payload)) throw new EconomyError('Request ID was already used for a different action', 409);
      return existing.receipt;
    }
    const { receipt, burned = 0 } = await work(tx);
    // JSON round-trip dates so the first response and every retry are identical.
    const saved = await tx.walletOperation.create({ data: { userId, key: requestId, kind, payload, receipt: JSON.parse(JSON.stringify(receipt)), burned } });
    return saved.receipt;
  });
}

export function purchaseItem(userId, { itemId, requestId } = {}, transaction = null) {
  assertId(itemId);
  return execute(userId, requestId, 'purchase', { itemId }, [userId], async tx => {
    const item = await tx.shopItem.findUnique({ where: { id: itemId } });
    if (!item) throw new EconomyError('Item not found', 404);
    const existing = await tx.inventory.findUnique({ where: { userId_itemId: { userId, itemId } } });
    if (existing) throw new EconomyError('Already owned', 409);
    const { burned, toVault } = calculateShopSplit(item.price);
    const { coins } = await deductCoins(userId, item.price, 'PURCHASE', tx);
    const inventory = await tx.inventory.create({ data: { userId, itemId } });
    await depositToVault(toVault, 'Shop purchase', `${item.price} for "${item.name}", ${burned} burned`, tx);
    // Burn is allocation metadata on the receipt, not a second wallet debit.
    return { receipt: { coins, inventory, burned, toVault }, burned };
  }, transaction);
}

export function tipFriend(userId, { receiverId, amount, requestId } = {}, transaction = null) {
  assertId(receiverId);
  assertCoinAmount(amount);
  if (amount < 1) throw new EconomyError('Minimum tip is 1 coin');
  if (receiverId === userId) throw new EconomyError('Cannot tip yourself');
  return execute(userId, requestId, 'tip', { receiverId, amount }, [userId, receiverId], async tx => {
    const receiver = await tx.user.findUnique({ where: { id: receiverId } });
    if (!receiver || receiver.guestRetiredAt) throw new EconomyError('Recipient account is unavailable', 404);
    const friendship = await tx.friendship.findFirst({ where: { status: 'ACCEPTED', OR: [
      { requesterId: userId, receiverId }, { requesterId: receiverId, receiverId: userId }
    ] } });
    if (!friendship) throw new EconomyError('Must be friends to tip', 403);
    const debit = await deductCoins(userId, amount, 'TIP_SENT', tx);
    const credit = await awardCoins(receiverId, amount, 'TIP_RECEIVED', tx);
    await tx.coinTransaction.updateMany({ where: { id: { in: [debit.transaction.id, credit.transaction.id] } }, data: { senderId: userId } });
    return { receipt: { coins: debit.coins, receiverId, amount } };
  }, transaction);
}

export function equipItem(userId, body = {}, transaction = null) {
  const payload = equipmentSelection(body);
  if (!payload) throw new EconomyError('Invalid equipment selection');
  const { itemId } = payload;
  return execute(userId, body.requestId, 'equip', payload, [userId], async tx => {
    if (itemId === null) {
      await tx.inventory.updateMany({ where: { userId, item: { type: payload.itemType }, equipped: true }, data: { equipped: false } });
      return { receipt: { equipped: false, itemId: null, itemType: payload.itemType } };
    }
    const inventory = await tx.inventory.findUnique({ where: { userId_itemId: { userId, itemId } }, include: { item: true } });
    if (!inventory) throw new EconomyError('Item not owned', 404);
    if (!['THEME', 'SKIN'].includes(inventory.item.type)) throw new EconomyError('This item cannot be equipped');
    await tx.inventory.updateMany({ where: { userId, item: { type: inventory.item.type }, equipped: true }, data: { equipped: false } });
    await tx.inventory.update({ where: { id: inventory.id }, data: { equipped: true } });
    return { receipt: { equipped: true, itemId } };
  }, transaction);
}
