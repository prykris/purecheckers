import { inEconomyTransaction, lockEconomyUsers, EconomyError } from './economy.js';
import { assertActiveAccount } from './accounts.js';

export async function updateProfilePrivacy(userId, body, transaction = null) {
  if (!Number.isSafeInteger(userId) || userId < 1 || userId > 2_147_483_647) throw new EconomyError('Invalid account', 401);
  if (typeof body?.profilePublic !== 'boolean') throw new EconomyError('profilePublic must be true or false');
  if (!Number.isSafeInteger(body.expectedProfileVersion) || body.expectedProfileVersion < 0 || body.expectedProfileVersion > 2_147_483_647) {
    throw new EconomyError('A valid expectedProfileVersion is required; refresh your account and retry');
  }
  return inEconomyTransaction(transaction, async tx => {
    await lockEconomyUsers(tx, [userId]);
    const current = assertActiveAccount(await tx.user.findUnique({ where: { id: userId } }));
    if (current.profileVersion !== body.expectedProfileVersion) throw new EconomyError('Your account changed. Refresh and choose the privacy setting again.', 409);
    // Even selecting the current value advances the existing profile revision:
    // an older pending request must not override this more recent decision.
    return tx.user.update({ where: { id: userId }, data: { profilePublic: body.profilePublic },
      select: { profilePublic: true, profileVersion: true } });
  });
}
