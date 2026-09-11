# Treasury reads and claims

Implemented locally on 11 September 2026. Browser acceptance and production rollout remain pending.

## One committed overview

`server/services/treasury.js` owns the treasury projection. `GET /api/treasury` returns public totals and, with valid authentication, only that account's unclaimed rewards. The response is non-cacheable and varies by Authorization. Invalid credentials are rejected rather than silently returning a public view. Pending rewards and totals come from the same PostgreSQL Repeatable Read transaction. A payment committed between aggregate queries appears entirely in the next overview, never half in each snapshot. Logs are limited to 30 with deterministic ordering. Global pending counts/sums use aggregation instead of loading every payout.

Reading a missing vault returns zero without inserting/updating the shared vault row. The service includes both historical purchase-burn metadata and modern wallet receipt allocations. Paid bounty/achievement totals include deferred rewards when claimed, once; outstanding liabilities are not counted as paid. Pending count means rewards, not distinct players.

Player coins include spendable User balances plus both stakes held by each OPEN GameRun. Creation records those stakes atomically with wallet debits. Settlement/refund closes the run atomically with payment, so the overview cannot double-count or lose the same stake. `circulation.spendable` and `circulation.reserved` expose that distinction; the view labels active reservations. The sum of player coins, vault and recorded burns is labeled **Coins accounted for**, not a claim to reconstruct every historically minted coin. Administrative adjustments, legacy records and deleted accounts prevent the old “ever created” wording from being established by these aggregates. The account count is also not a live-presence count.

## Server-defined availability

Each personal pending reward carries `canClaim` and `claimUnavailableReason`. Pending rewards are liabilities, not individually reserved funds: a reward can be claimed when the actual vault balance covers its amount, even if the unallocated balance (`vault.available`, net of all liabilities) is zero. The browser consumes this availability; it does not recompute eligibility from dashboard totals.

Availability is advisory at read time. `claimPendingPayout` still locks the account and conditionally debits the shared vault in a transaction. Concurrent claimants may see available funds; only affordable claims commit. The payout's existing ID and retained `claimedAt` make duplicate/lost-response retries return the original receipt without another credit. No new mint, ordering priority, reservation policy or claim queue was added.

## Browser lifecycle

`src/lib/treasuryClient.js` owns loading/claim coordination. `src/lib/readResource.js` supplies reusable request cancellation, latest-request publication, account-generation fencing, a 15-second fetch deadline and disposal. This is a read lifecycle, not a second database authority or a revision for other resource types. An older read/failure cannot replace a newer view. A failed refresh keeps the previous successful snapshot; an initial failure exits loading and exposes Refresh. Returning focus also refreshes. The treasury is not continuously polled while focused; a new vault deposit can be discovered with Refresh.

The component displays the controller's state, accessible busy/error feedback and the server's claim controls. One claim remains active through its confirmation reads. A successful receipt causes fresh treasury and account-profile reads; it never adds the receipt amount locally or optimistically removes an unconfirmed reward. Treasury and User reads have separate authorities, so one failure does not discard the other's successful data. A confirmed claim with failed reads has explicit confirmation-plus-refresh feedback.

Lost/malformed responses and rejected claims refresh the view/profile without automatically resending a mutation. A malformed claimed amount is not treated as confirmation. The current reward ID remains the only retry identity. Leaving the view or replacing the account prevents late claim callbacks from starting follow-up reads or publishing messages into the next view. Profile publication continues to use the [versioned account owner](profile-state.md).

## Rollout and verification

The browser now reads personal rewards from the authenticated overview. The separate `/api/treasury/my-pending` endpoint and its unused list/log accessors were removed; deploy server/client together and reload old tabs. No new migration, dependency or production write was needed. Existing [deployment requirements](deployment.md) still apply, especially durable wager reservations and profile revisions.

Tests cover funded-but-fully-owed claims, contention, payment during a multi-query read, pending-payment totals, public/account isolation, non-cacheable responses, absent-vault reads, wager reservation/refund/settlement accounting, reversed browser reads, stale errors, timeouts, account replacement, disposal, duplicate clicks, malformed/lost claim responses and failed confirmation reads. See the [implementation checkpoint](growth/implementation-status.md) for exact test/build counts and logs. These checks do not prove production capacity or rendered-device acceptance.

Manual acceptance:

1. In a test environment, open Treasury with one pending reward and exactly enough vault funds for it. Claim must be enabled even when all vault funds are owed. Claim once; the reward disappears after the authoritative read and the current balance updates once.
2. Block the treasury request, open the page and then restore connectivity. Loading must end with an error and Refresh must recover. After a successful load, a failed refresh should retain the previous overview. Navigate away or change accounts during a delayed read/claim; the old view must not reappear.
3. Start a wager in a separate test session and refresh the treasury: reserved player coins should appear, with no drop in coins accounted for. After refund/settlement, the reservation disappears and only the actual rewards/burns change the total. Two competing claims may show availability initially; insufficient-funds rejection must refresh the remaining claimant's controls.
