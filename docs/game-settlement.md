# Game settlement and remaining durability work

## Implemented contract

`server/services/gameSettlement.js` owns the financial/statistical outcome of a completed game. `GameRoom.persistResult` supplies an immutable terminal intent and publishes the resulting receipt only after commit. It no longer performs separate reward transactions after marking the replay saved.

Each live aggregate has a UUID settlement key, separate from its process-local numeric navigation ID. A transaction-scoped database lock serializes repeats of that key; a unique `Game.settlementKey` and its stored `settlement` receipt retain the committed result. Repeating the same settlement returns that receipt without changing statistics or balances. Reusing the key for different players, winner, mode or wager is rejected.

The owning transaction includes:

- Replay, actual start/end timestamps, end reason and stored payout totals.
- Ratings, games played, wins/losses and guest-lifetime extension.
- Base rewards, wager refunds/pot credits and tax, bot-win reward limits and coin activity entries.
- Daily bounty, milestone payments or queued obligations, consumed daily/milestone eligibility, and vault logs.

The result totals describe wallet credits during settlement, including a refunded stake; they are not net profit after the earlier buy-in. Pending obligations contribute zero to money received. Wager duration is measured at the recorded game end, so a delayed retry cannot turn a short game into an eligible wager. Bot reward caps are serialized per recipient and use a consistent UTC grant timestamp. The optional same-opponent limit now consults persisted games rather than an in-memory counter; it remains disabled by current configuration.

`server/services/economy.js` provides transaction composition and ordered account row locks. Vault operations acquire account locks before the shared vault when both are needed. Wallet and vault debits use conditional updates, so simultaneous debits cannot both spend a previously read balance. These helpers can join an owning transaction instead of independently committing its parts.

## Daily and pending rewards

An earned daily bounty consumes the UTC day's eligibility even when the vault queues payment. Repeated wins cannot create multiple pending obligations for that day. Milestone eligibility and its payment/obligation are committed together.

Claiming a pending payout atomically debits the vault, credits the account, records its activity and sets `claimedAt`. The row remains a receipt: a repeat claim by the owner returns the same successful amount. Another account cannot claim or inspect that receipt through the claim operation. Pending lists and treasury obligations exclude claimed rows.

## Migrations and historical limits

`20260910210000_atomic_game_settlement` adds the unique settlement key and JSON receipt to Game. Historical rows keep null keys/receipts; the change does not reconstruct missing historical rewards. The same migration combines any previously duplicated vault rows into row 1 while preserving their summed balance, then constrains the vault to that identity.

`20260910220000_payout_claim_receipts` retains receipts for newly claimed payouts. Previously deleted claim records cannot be reconstructed. Previously duplicated unpaid daily obligations are not automatically removed: correcting existing balances or obligations requires evidence of what was earned and paid, not a guessed migration.

Both migrations were applied only through the isolated test database setup. No production migration, repair or deployment was performed.

## Verification

The 11 PostgreSQL settlement/economy tests cover concurrent duplicate settlement, a conflicting retry, complete rollback followed by successful retry, correct refunds and recorded totals, pot/tax/bounty movement, end-time wager validation, concurrent guest bot-win limits, unpaid bounty deduplication and rollback, UTC rollover, milestone deduplication, duplicate claims, competing claimants, conditional wallet debits and vault rollback.

The actual socket tests verify the saved replay/result path and failure feedback. The full suite passed 347 tests across 41 files, and the production build passed. A later focused run covers the final receipt-conflict and grant-timestamp edits. Evidence is under `.generated/tests-economy-full.log`, `tests-economy-final.log` and `build-economy.log`. These checks do not simulate a full production process crash.

## Still required before claiming restart recovery

Settlement is atomic and repeatable **when its terminal intent and key are available**. The [gameplay checkpoint boundary](game-checkpoints.md) commits terminal state and its settlement job together before publication. [Startup restoration](game-restoration.md) now loads unfinished checkpoints and active human game sessions before listening. Abandoned restart recovery uses an ABORTED receipt with stake refunds and no rating, statistics or reward effects.

1. Creation, wagers and subsequent gameplay are durable. Versioned uninstalled starts recover through cancellation; ambiguous legacy null checkpoints still require review. An initial-state record is not the latest live board.
2. Persist/restore the remaining waiting-room, spectator, rematch and notice lifecycle. [Durable active-game membership](game-membership.md) now enforces one unfinished game per human; old financial settlement cannot erase the next game's claim.
3. Terminal jobs and startup retry are now implemented, with job completion committed alongside the existing settlement receipt. Terminal checkpoint and job now commit together. Still required: restore the finished aggregate/session view after restart.
4. Transactional gameplay ownership fences old generations during overlap; see [gameplay-ownership.md](gameplay-ownership.md). Real rolling-deployment acceptance remains required.
5. Extend controlled clock/readiness and transaction tests to the complete lifecycle and target concurrency; live-game restoration tests do not prove spectator/result handoff or production capacity.

A subsequent [wallet-actions pass](wallet-actions.md) moved purchases and tips into complete transactions with durable receipts and shared browser recovery. New purchase burn allocation is separated from wallet debits; historical burn metadata remains preserved. Account cleanup, administrator adjustments and other economy paths still require audit. The conditional debit helper does not fix callers that do not use it, and these changes do not establish a complete historical wallet ledger.
