// Reset is explicit about its slot and uses the same durable equipment command.
export function equipmentSelection(body) {
  if (Number.isSafeInteger(body?.itemId) && body.itemId > 0 && body.itemId <= 2_147_483_647) return { itemId: body.itemId };
  if (body?.itemId === null && ['SKIN', 'THEME'].includes(body.itemType)) return { itemId: null, itemType: body.itemType };
  return null;
}
export function validEquipmentReceipt(receipt, payload) {
  return payload.itemId === null
    ? receipt?.equipped === false && receipt.itemId === null && receipt.itemType === payload.itemType
    : receipt?.equipped === true && receipt.itemId === payload.itemId;
}
