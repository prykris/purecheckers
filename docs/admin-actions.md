# Administrative actions

The action service and its migration shipped with the 11 September release. The dedicated admin workspace and contextual inspectors are included in the 15 September release, with no additional migration.

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

Session storage is per tab, not an account-wide or cross-device outbox. Unreadable saved state blocks new actions; a storage failure before sending prevents execution. Lost responses and server failures retain the intent. Explicit client rejection clears it. Closing a tab can lose its local pending record; server receipts remain available in the Administration activity view.

## Rollout and verification

Apply `20260911093000_admin_operations` before the new application starts. It adds the receipt table and ledger reason; it does not backfill historical adjustments. Old clients without request IDs must reload. Keep receipts and their actor/target references; hard account deletion is restricted by the audit relations. Account retirement uses retained identities.

Automated coverage includes concurrent duplicates, changed payloads, rollback, underflow/overflow, strict input validation, reward-history preservation, room/result/game eligibility, queued permission revocation, lost self-revocation responses, HTTP authorization, saved browser retries, wrong-target receipts and account replacement. See the latest [implementation checkpoint](growth/implementation-status.md) for final test/build results. These checks do not establish production or browser acceptance.

Manual checks in a test environment:

1. In Administration or a player's contextual admin tools, adjust a test account by a small positive and negative amount. Confirm each once and verify its balance and ledger.
2. Interrupt an adjustment response, reload the same tab and select **Confirm pending action**. The original amount/target must remain and the adjustment must occur once.
3. Try changing a rating while the target is in a room or viewing a result. It must be rejected; leave/dismiss and retry. Reset statistics and confirm historical peak and earned rewards remain unchanged.

## Administration workspace (15 September)

`/admin` provides overview, players, live games/rooms, saved replays, puzzles, economy and activity sections. The account menu exposes it to administrators. Mobile shows one record at a time with a Back to list control; desktop adds persistent navigation and a list/detail split from 1100 CSS pixels. Queries, player filters, sort, pagination and record selection are URL state. The document remains viewport height with the content area scrolling. Admin routes send noindex; API reads send no-store.

`AdminResource` owns scoped reads through the existing ReadResource class. Account replacement or loss of administrator status clears the view and prevents a late response being displayed. Every read endpoint also checks current account authority in the database. New reads never return password hashes, friend codes or session credentials. Player search is bounded to 25 records; player email and private account details are administrator-only.

`AdminPlayerActions` is shared between the workspace and contextual inspectors. It delegates to the original action journal and transactional write service. A reason and a review showing the exact target and intended change precede a write. Pending actions retain their original identity and the shared confirmation control works after self-revocation. F2 now links to the workspace instead of duplicating the forms.

Admins remain normal players. No gameplay admission, matchmaking, readiness, rating or turn rules change based on the new UI. PlayerLink uses a shared shield marker; public profile responses include the role. Older name-only projections use one batched role lookup (maximum 50 visible names per request, 60-second cache). That cache communicates a role and never authorizes an action. Profiles name the Administrator role explicitly.

The same AdminInspector opens from player profiles, live/result game toolbars, waiting rooms and daily puzzles using the existing Modal. Opening an inspector does not navigate away or pause the current game. Game inspection uses durable run IDs; saved replay inspection uses saved game IDs. Puzzle tools show the shared canvas renderer, calendar availability, stored verification depth/provenance and publishing/rejection status; they do not claim to have run a fresh engine search. Background generation remains the existing external publisher, not a long-running web request.

The operational surface is deliberately built on existing capabilities: it does not add bans, forced game results, remote shell commands or direct puzzle edits. Any such future controls need explicit semantics and the same authority/audit contracts.

Local acceptance: 122 tests across ten targeted regression files passed, including authorization, permission revocation, admin writes/recovery, profile versions, room records, navigation and SEO. The six admin-read tests also passed after adding invalid calendar-date detail coverage. `npm run build` passed with the development server stopped to release Windows' Prisma engine lock.

Browser checks covered 320px mobile and desktop list/detail layouts, normal bot play by an administrator, profile/room/game/puzzle inspectors without route changes, persistence across account refresh, saved replay stepping, and a single confirmed +5 coin adjustment with matching balance, ledger and immutable audit receipt. These checks used local test accounts. Production deployment must additionally verify the admin route, unauthenticated API denial, startup recovery and continued daily puzzle availability.
