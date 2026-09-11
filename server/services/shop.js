import { Prisma } from '@prisma/client';
import prisma from '../db.js';

// Catalogue and ownership are one read projection for the authenticated shop.
export function readShop(userId, db = prisma) {
  return db.$transaction(async tx => {
    const items = await tx.shopItem.findMany({ orderBy: [{ price: 'asc' }, { id: 'asc' }] });
    const inventory = await tx.inventory.findMany({ where: { userId }, orderBy: { itemId: 'asc' } });
    return { items, inventory };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
