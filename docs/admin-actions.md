# Administrative actions

Implemented locally on 11 September 2026. Production migration and browser acceptance remain pending.

## Ownership and transaction contract

`shared/adminActions.js` defines accepted actions, normalized inputs and profile-change policy. `server/services/adminActions.js` owns authorization, account locking, game eligibility, wallet effects and audit receipts. HTTP routes only authenticate, delegate and translate errors.

The existing `give-coins`, `set-elo`, `reset-stats` and `set-admin` endpoints require a UUID v4 `requestId`. Actor and target account rows are locked in ascending order, matching wallet and gameplay admission/settlement locking. Current admin authority is checked inside that transaction. Revocation cannot race a queued privileged write using an earlier permission check.

`AdminOperation` retains the normalized payload and immutable successful receipt, including actor, target, action and before/after profile fields. The same actor and request ID return the original receipt; different parameters under that ID return 409. An exact retry remains confirmable after self-revocation, while new privileged actions are denied. A retired actor cannot authenticate or recover a receipt. Failed operations create no receipt.

- Coin adjustments accept a signed, nonzero whole amount. They use the shared wallet service, enforce balance bounds and create an `ADMIN_ADJUSTMENT` ledger entry identifying the administrator. Balance, ledger and receipt commit or roll back together.
- ELO accepts integers from 0 through 100000. Setting ELO preserves the highest historical rating. Resetting statistics sets wins/losses/games played to zero and ELO to 1000, preserving peak rating, daily-win watermark, historical games, payouts and ledger entries. It does not restore already consumed reward eligibility.
- Rating/stat changes require no active room membership, result-view membership or OPEN game run, including games awaiting settlement. This prevents a saved game/result context from competing with a manual rating reset. Leave/dismiss the view and finish settlement before retrying. Coin adjustments and permission changes do not require leaving gameplay.
- Permission changes require an actual boolean. Target IDs and numeric fields do not accept coercive strings, fractions or explicit zero target IDs. An optional reason is trimmed and limited to 300 characters.

## Browser recovery

Admin and wallet commands use one `ActionJournal` mechanism with separate action validators and storage namespaces. Wallet storage keys remain compatible. Each journal persists the intent before sending, retains uncertain responses, has a 15-second request deadline and prevents a second action while confirmation is pending. Reloading the same tab restores the same actor-scoped request. The admin panel shows the saved target and a **Confirm pending action** button; it remains available for pending self-revocation confirmation.

Confirmation refreshes the current signed-in account rather than assigning the old receipt balance/profile. Responses belonging to a previous account generation cannot confirm or clear the active account's work. Other target accounts refresh through their normal profile requests; this change does not add immediate cross-browser profile broadcasts. The panel reports the confirmed target separately.

The later [profile-state contract](profile-state.md) also orders those refresh responses by the User row's transactional revision. A late read cannot undo a newer balance or permission update. Focus and socket recovery request current profiles; immediate remote invalidation remains separate work.

Session storage is per tab, not an account-wide or cross-device outbox. Unreadable saved state blocks new actions; a storage failure before sending prevents execution. Lost responses and server failures retain the intent. Explicit client rejection clears it. Closing a tab can lose its local pending record; server receipts remain. There is no audit-history UI yet.

## Rollout and verification

Apply `20260911093000_admin_operations` before the new application starts. It adds the receipt table and ledger reason; it does not backfill historical adjustments. Old clients without request IDs must reload. Keep receipts and their actor/target references; hard account deletion is restricted by the audit relations. Account retirement uses retained identities.

Automated coverage includes concurrent duplicates, changed payloads, rollback, underflow/overflow, strict input validation, reward-history preservation, room/result/game eligibility, queued permission revocation, lost self-revocation responses, HTTP authorization, saved browser retries, wrong-target receipts and account replacement. See the latest [implementation checkpoint](growth/implementation-status.md) for final test/build results. These checks do not establish production or browser acceptance.

Manual checks in a test environment:

1. In the F2 admin panel, adjust a test account by a small positive and negative amount. Confirm each once and verify its balance and ledger.
2. Interrupt an adjustment response, reload the same tab and select **Confirm pending action**. The original amount/target must remain and the adjustment must occur once.
3. Try changing a rating while the target is in a room or viewing a result. It must be rejected; leave/dismiss and retry. Reset statistics and confirm historical peak and earned rewards remain unchanged.
