# Account profile state

Implemented locally on 11 September 2026. Browser acceptance and production rollout remain pending.

## Authority and ordering

The database User row owns balance, rating, account identity and privacy. Every update advances `profileVersion` in the same transaction, including ORM, bulk and raw wallet writes. A database trigger supplies ordering metadata only; eligibility, economy and account rules remain in their domain services. Rollback also rolls back the revision. Revisions are per user, not timestamps or request-start counters.

`GET /api/auth/me` returns one versioned User row with `Cache-Control: no-store`. It no longer includes unused equipped inventory, which remains available through `/api/shop/inventory`. User revisions do not order inventory, friendship lists, the shop catalogue or treasury aggregates; those are separate resources.

`src/lib/accountSession.js` is the only owner of the browser's account token and profile. The public stores expose read-only projections. Accepted profile objects are frozen. An older revision cannot replace a newer one regardless of response order; equal revisions retain the accepted object. Unversioned or wrong-account responses are rejected. A full page reload starts a fresh projection from the stored token, not from a locally persisted balance.

An account generation invalidates work after logout, replacement or a newer authentication attempt, including reuse of the same token. Token renewal and an in-place guest upgrade preserve the account generation and socket identity. A response made with an older token may still supply a newer profile revision for that same generation, but it cannot replace a token that was already renewed. Invitation bootstrap and account upgrade consume the same generation boundary.

## Refresh and recovery

### Privacy writes

`server/services/profileSettings.js` owns privacy changes. `PATCH /api/auth/profile` takes `{ profilePublic, expectedProfileVersion }`, where the version is the browser's accepted profile revision. The service locks the account with the shared account-lock helper, rechecks retirement and requires an exact revision match before updating. The existing User trigger advances the revision in the same transaction. Even explicitly choosing the current value advances it, so an older pending request cannot override that newer decision. A successful response contains the resulting privacy value and revision; it is confirmation of that write, not a replacement for the current account projection.

A mismatch returns 409 and requires a fresh profile and a new explicit choice. This deliberately includes unrelated User changes such as a coin credit; there is no separate privacy counter, receipt table or retry queue. Privacy is an absolute conditional setting, not an additive payment. Repeating a completed request with its old revision is rejected, and reloading never replays it automatically. Rollback preserves both the setting and its revision. Existing API/page/preview enforcement and the disclosed leaderboard/shared-game visibility policy remain unchanged.

`ProfileSettingsClient` keeps the checkbox on the authoritative profile, bounds the write with the shared 15-second deadline and refreshes through `refreshSession()` after success, rejection or an uncertain response. It never installs the write response as a profile or automatically retries the choice. Duplicate input is blocked through confirmation and the follow-up read. A failed read distinguishes a confirmed change from an uncertain one, blocks new changes and exposes **Refresh account**. Once the read recovers, the user can make another explicit choice based on current state. The existing five-second profile hints continue to reconcile changes made elsewhere.

Account-generation change and component disposal invalidate action feedback and follow-up reads. Old write completions cannot start a new account's read; old read completions cannot clear a newer action's busy state. Ordinary profile revision updates do not reset a pending action.

This contract requires a coordinated server/client rollout and old-tab reload. Old privacy requests without `expectedProfileVersion` receive validation errors rather than unconditionally changing the setting. It uses the existing `20260911100000_profile_versions` migration; no new migration or dependency is needed. See the [implementation checkpoint](growth/implementation-status.md) for tests and build evidence. Production and manual acceptance remain pending.

### Shared profile reconciliation

`refreshSession()` binds a profile read to its account generation and token, then delegates publication to the account owner. Reads have a 15-second deadline unless a caller supplies its own cancellation/deadline signal. Failed background reads retain the last accepted profile; they do not manufacture a balance or imply that a payment failed.

- Friends, wallet confirmations, administrative confirmations, puzzle rewards and privacy changes use the shared refresh path. Friends no longer assigns an independent `/auth/me` result to the whole user store.
- Treasury claims use the server's existing durable payout identity. A returned claim receipt causes a current profile read, never addition of the historical claimed amount to browser coins. A lost response can retry the same payout; claims are serialized in the view. A failed read after confirmation says the claim succeeded and that the balance needs refreshing.
- Friends and Treasury clear account-specific display data on identity replacement and ignore completions from the previous generation. Treasury no longer represents a failed pending-payout read as an empty list.
- Socket recovery/channel transitions, completed settlement and returning focus to the app request a profile refresh. They use the same version-aware publication path as explicit actions.

The server also reconciles revisions for its connected accounts every five seconds. It reads only IDs/revisions in sequential batches of at most 500 using the existing Prisma pool, skips empty audiences and never overlaps scans. Results are sent only to the exact connection captured for the read. Shutdown drains the active scan and suppresses late publication. Database errors are logged and retried on the next interval.

`account:revision` hints contain account ID and revision only. They repeat even when unchanged: losing a hint or failing an HTTP read cannot leave a connected browser permanently stale. A browser already at that revision makes no request. A browser behind the server coalesces background reads, follows a newer revision arriving during a read, and retries unsuccessful reads on a later hint without a tight retry loop. Detached listeners and account-generation changes stop follow-up work; the account owner still fences each response. Explicit action confirmations continue to start fresh reads after their writes, rather than sharing an older background request.

This provides eventual live refresh, normally within five seconds plus database/HTTP time, not instantaneous delivery or a fixed latency guarantee under load/outage. It adds no payment hooks, database listener connection, durable notification queue or second profile owner. Per scan, database query count is `ceil(connected accounts / 500)` and hint traffic is one small event per connected account; production capacity measurement remains pending. Account deletion/expiry still follows existing authentication and guest lifecycle rules. Storage restrictions permit an in-memory session but may prevent its token surviving reload. Other resource lists and complete browser acceptance still require their own verification; the full app audit remains active.

## Rollout and evidence

Apply `20260911100000_profile_versions` before the new server/client. Existing accounts start at revision zero; subsequent writes increment automatically. Retain the trigger and do not manually reset revisions on live accounts. Old clients can still consume the extra field, but must reload to use the new ordering contract. The new client rejects an old server's unversioned profiles. The migration and regenerated Prisma Client have only been exercised against the isolated test database in this pass.

The full suite passed **629 tests across 63 files** (`.generated/tests-profile-full.log`). Final focused checks additionally cover the invite-bootstrap authentication race; see the current [implementation checkpoint](growth/implementation-status.md) for their count and final build result. Coverage includes concurrent database writers, raw/bulk updates, transaction rollback, non-cacheable profile reads, reversed revisions, equal revisions, frozen projections, renewal, account replacement, token reuse and upgrade generation checks. These tests do not substitute for browser or Railway acceptance.

Manual acceptance:

1. In a test environment, delay an old `/auth/me` response, then complete a purchase or tip and deliver the old response. Balance, privacy and registration state must not regress.
2. Sign out and enter another account while reads are pending. No previous account profile or payout list should appear. Save a guest account during a game; the board/socket must remain mounted.
3. Interrupt a treasury claim response and retry its same payout. Confirm one server credit and a balance matching `/auth/me`, including after another spend. Toggle privacy, reconnect and return focus to confirm the server's current setting is restored.
4. Keep the recipient's browser open while another account sends a tip or an administrator adjusts its balance. It should update within roughly five seconds plus request time. Block `/api/auth/me`, make another adjustment, then unblock it without changing focus: a subsequent revision hint must recover the balance. Use distinct accounts; signing into the same account elsewhere deliberately replaces its previous socket.
5. Change profile privacy, interrupt its response and restore the connection. The current setting must come from the refreshed account. If a newer account revision causes a conflict, choose again after refresh. Block the follow-up read and recover with **Refresh account**; leave Profile or switch accounts during a delayed request and verify no old confirmation changes the new view. Confirm private profile pages/previews remain hidden while public rankings and shared-game names follow the stated policy.
