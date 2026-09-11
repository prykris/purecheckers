import { ActionJournal } from '../actions/journal.js';
import { normalizeAdminAction } from '../../../shared/adminActions.js';

function validIntent(intent) {
  try {
    normalizeAdminAction(intent.payload.userId, intent.kind, { ...intent.payload, requestId: intent.requestId });
    return true;
  } catch { return false; }
}
export class AdminJournal extends ActionJournal {
  constructor(options) {
    super({ ...options, namespace: 'admin', validIntent,
      validReceipt: (receipt, intent, actorId) => receipt?.requestId === intent.requestId && receipt.actorId === actorId &&
        receipt.kind === intent.kind && receipt.user?.id === intent.payload.userId });
  }
}
