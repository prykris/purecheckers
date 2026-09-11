import prisma from '../db.js';
import { Prisma } from '@prisma/client';
import { normalizePieceSkin } from '../../shared/pieceSkins.js';
import { normalizeTheme } from '../../shared/themes.js';

export async function readAppearance(userId, db = prisma) {
  const rows = await db.$transaction(tx => tx.inventory.findMany({ where: { userId, equipped: true, item: { type: { in: ['SKIN', 'THEME'] } } },
    select: { item: { select: { id: true, name: true, data: true, type: true } } }, orderBy: { itemId: 'asc' } }),
  { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const read = (type, normalize, field) => {
    const selected = rows.filter(row => row.item.type === type);
    if (selected.length > 1) throw Error('Multiple appearance items are equipped. Select one per slot in Shop.');
    if (!selected.length) return null;
    const item = selected[0].item, value = normalize(item.data);
    if (!value) throw Error('An equipped appearance item is unavailable. Select another item in Shop.');
    return { itemId: item.id, name: item.name, [field]: value };
  };
  return { skin: read('SKIN', normalizePieceSkin, 'palette'), theme: read('THEME', normalizeTheme, 'vars') };
}
