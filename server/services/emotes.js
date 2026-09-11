import prisma from '../db.js';

const selectable = userId => ({ type: 'EMOTE', OR: [{ price: 0 }, { inventory: { some: { userId } } }] });
const fields = { id: true, name: true, data: true };

function view(item) {
  const { emoji, label } = item?.data ?? {};
  if (typeof emoji !== 'string' || !emoji.trim() || emoji.length > 64 || typeof label !== 'string' || !label.trim() || label.length > 100) return null;
  return { id: item.id, name: item.name, emoji, label };
}

export async function listAvailableEmotes(userId, db = prisma) {
  return (await db.shopItem.findMany({ where: selectable(userId), select: fields, orderBy: { id: 'asc' } })).map(view).filter(Boolean);
}

export async function resolveEmote(userId, itemId, db = prisma) {
  if (!Number.isSafeInteger(itemId) || itemId < 1 || itemId > 2_147_483_647) return null;
  return view(await db.shopItem.findFirst({ where: { ...selectable(userId), id: itemId }, select: fields }));
}
