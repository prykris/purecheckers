# Recovering completed-game settlement

This implements durable retry of a **recorded terminal intent**. Later passes persist accepted gameplay and [restore unfinished checkpointed games](game-restoration.md) before startup readiness. No production changes were made during these passes.

## Current boundary

The later [game-checkpoint pass](game-checkpoints.md) commits an accepted terminal checkpoint and its settlement job together before publication. It removes the previous in-memory unqueued-intent buffer and its retry hook. The historical two-step capture/enqueue description below explains the earlier boundary; the current live path enters settlement only from a committed terminal checkpoint/job. Unfinished games now restore at startup; historical finished-result membership still needs durable lifecycle state.

## Original contract and durability boundary

`GameRoom.endGame` captures the terminal intent once, including the settlement key, players, mode, wager, move history, start/end timestamps and end reason. It cannot reconstruct a different intent on a later retry. `enqueueSettlement` commits that intent to `GameSettlementJob` before starting the financial transaction. Repeating its key must match the complete normalized intent, including move history and timestamps.

`settleQueuedGame` reads that job and invokes the existing settlement service inside one transaction. The replay, statistics, ratings, wallet/vault movements, queued rewards and job completion all commit together. A process failure after commit cannot make the next worker pay again: the unique settlement receipt is the authority. A process failure after enqueue but before settlement leaves a pending job that a new process can execute without the original room.

The durability boundary is the successful **enqueue commit**, not `endGame` being called or the client seeing a terminal board. If the database cannot accept the intent, the server retains the immutable in-memory intent and periodically retries its enqueue. The result-screen cleanup timer does not discard an intent that has never reached the database. A process crash before enqueue still loses it; durable accepted-transition storage is required to close that gap.

Two migrations add the job table and participant references: `20260911000000_game_settlement_jobs` and `20260911000100_settlement_job_participants`. Participant foreign keys prevent account deletion from orphaning pending settlement. They do not finish the wider guest-cleanup/lifetime audit. Completed jobs reference their replay; deleting a replay also removes that job, so these records must not be purged as ordinary queue messages while retry safety is required. Existing historical completed games are not re-enqueued or repaid by migration.

## Recovery worker and publication

`server/index.js` starts one recovery service on startup. It runs immediately and then every ten seconds, processing at most 25 due jobs sequentially per batch. Calls share an in-flight batch; repeated timer ticks cannot overlap it. Transaction-scoped locks also make independently started workers safe for the same terminal job. This does **not** fence competing live-game owners.

A failed job records another attempt and backs off from one second to a maximum of one minute. The worker continues with other due jobs. There is no silent retry-count cutoff that abandons money owed. Job counts, attempt counts and next retry times are retained in PostgreSQL; errors go to server logs. A database outage is logged and retried on a later tick. Shutdown stops new batches and allows the current operation to finish; abrupt process termination is handled by transaction rollback/commit and the durable job.

For an aggregate still present in memory, the committed receipt updates the existing authoritative result snapshot and announces its replay once. It does not emit a separate client reconciliation protocol. Publication errors cannot undo payment or mark the completed job pending again. After a full process restart the financial result/replay can recover, but restoring the player's old game screen/session still depends on the unfinished live-state persistence work.

## Verification

Nine real PostgreSQL recovery tests cover immutable intent identity, concurrent settlement, complete transaction rollback/retry, bounded batches, failed-job backoff/fairness, stopping and non-overlap, publication failure and participant deletion protection. Two tests use separate Node processes and abrupt exits: one exits after enqueue commit; another exits after settlement commit before publication. A fresh process recovers the former and does not repeat the latter's bot reward. These are controlled local process-boundary tests, not production crash acceptance.

Socket coverage interrupts the database before enqueue, verifies failure without a false replay announcement, then restores persistence and checks the existing result snapshot and one replay announcement. The final focused settlement/recovery/socket run passed 64 tests across three files (`.generated/tests-settlement-recovery-final.log`). The production build passed (`.generated/build-recovery.log`). The full suite passed 381 tests across 44 files (`.generated/tests-recovery-full.log`).

In staging, the remaining owner check is to interrupt persistence while finishing a bot game, restore it, and confirm the existing result changes to saved with one reward and a working replay. Full live-game crash/clock/reconnect acceptance must wait until those states are durably stored.

## Remaining restart work

1. Creation, wagers, accepted transitions and command identities now commit durably. Startup restores unfinished checkpoints and safely cancels versioned uninstalled starts; ambiguous historical records still require review.
2. [Durable active-human membership](game-membership.md) commits with creation and releases with terminal/cancellation transitions. [Room departure](room-departure.md) now awaits failed-start cancellation/refunds. Finish the remaining lifecycle repositories and restart restoration.
3. Terminal intent now commits atomically with its checkpoint. Restore the committed terminal aggregate/session after restart; financial recovery already reads its durable job.
4. Writer generations fence old gameplay transactions during overlap. Restore spectators, waiting rooms, notices and their deadlines, then verify the complete handoff.
5. The game restart clock/readiness policy is implemented and locally tested. Complete lifecycle, target-concurrency and real deployment acceptance remain required.
