import { assertCoinAmount, EconomyError, inEconomyTransaction } from './economy.js';

export function awardCoins(userId, amount, reason, transaction = null, occurredAt = new Date()) {
  assertCoinAmount(amount);
  return inEconomyTransaction(transaction, async tx => {
    const user = await tx.user.update({ where: { id: userId }, data: { coins: { increment: amount } } });
    const entry = amount > 0 ? await tx.coinTransaction.create({ data: { receiverId: userId, amount, reason, createdAt: occurredAt } }) : null;
    return { coins: user.coins, transaction: entry };
  });
}

export function deductCoins(userId, amount, reason, transaction = null) {
  assertCoinAmount(amount);
  return inEconomyTransaction(transaction, async tx => {
    const debit = await tx.user.updateMany({ where: { id: userId, coins: { gte: amount } }, data: { coins: { decrement: amount } } });
    if (debit.count !== 1) throw new EconomyError('Insufficient coins');
    const entry = amount > 0 ? await tx.coinTransaction.create({ data: { receiverId: userId, amount: -amount, reason } }) : null;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    return { coins: user.coins, transaction: entry };
  });
}
