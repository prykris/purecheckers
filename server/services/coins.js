import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function awardCoins(userId, amount, reason) {
  const [user, transaction] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: amount } }
    }),
    prisma.coinTransaction.create({
      data: { receiverId: userId, amount, reason }
    })
  ]);
  return { coins: user.coins, transaction };
}

export async function deductCoins(userId, amount, reason) {
  // Check balance first
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.coins < amount) {
    throw new Error('Insufficient coins');
  }

  const [updated, transaction] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { coins: { decrement: amount } }
    }),
    prisma.coinTransaction.create({
      data: { receiverId: userId, amount: -amount, reason }
    })
  ]);
  return { coins: updated.coins, transaction };
}
