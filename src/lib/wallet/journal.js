import { ActionJournal } from '../actions/journal.js';
import { equipmentSelection, validEquipmentReceipt } from '../../../shared/equipmentSelection.js';
const kinds = new Set(['purchase', 'tip', 'equip']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;

function validIntent(intent) {
  return intent && kinds.has(intent.kind) && uuidPattern.test(intent.requestId) &&
    (intent.kind === 'equip' ? !!equipmentSelection(intent.payload) : intent.kind !== 'tip' ? validId(intent.payload?.itemId) :
      validId(intent.payload?.receiverId) && validId(intent.payload?.amount));
}


export class WalletJournal extends ActionJournal {
  constructor(options) { super({ ...options, namespace: 'wallet', label: intent => intent.kind === 'equip' ? 'Item selection' : 'Payment', validIntent,
    validReceipt: (receipt, intent) => intent.kind === 'equip'
      ? validEquipmentReceipt(receipt, intent.payload)
      : !!receipt && Number.isSafeInteger(receipt.coins) }); }
}
