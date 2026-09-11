# Durable game creation and wager reservation

Implemented locally on 10 September 2026. No production migration or deployment was performed. This establishes a durable creation/reservation record, not recovery of the latest live board after a restart.

## Creation contract

`server/services/gameRuns.js` owns creation and reservation. Within one transaction it locks the creation identity, locks both accounts in a consistent order, validates participants, conditionally debits both wagers, records their `WAGER_STAKE` ledger entries and inserts `GameRun`. Either all of those effects commit or none do. Free games also have a durable creation record but create no wager entries.

`GameRun` stores a unique creation/settlement key, database-assigned navigation ID, participants, mode, stake, turn timer, origin, initial engine state, serialization version and lifecycle outcome. IDs no longer come from a process-local timestamp counter. `OPEN`, `SETTLED` and `ABORTED` describe the reservation's lifecycle. **`initialState` is the starting position; it must never be mistaken for the latest game position.** The subsequent [checkpoint pass](game-checkpoints.md) now writes accepted transitions to the separate checkpoint/revision fields; initialState remains the original board.

A repeated key must match every creation parameter and returns the original record without another charge. Closed identities cannot start again. Room starts preserve their key and colour assignment across an uncertain creation response. A retry can install the already committed reservation. When the room's participants change before retry, the old uninstalled attempt is closed before creating another identity.

GameRoom is installed only after creation commits. A synchronous reservation for each human prevents competing async starts in this process; bots can participate in multiple games. The participant session/phase/context is rechecked after database work. If it changed before installation, the start is aborted: both refunds, their `WAGER_REFUND` entries and the `ABORTED` state commit together. Repeating that abort confirms its existing outcome without another refund. This process-local guard does not fence two server processes.

## Settlement and accounting

Wager settlement requires a matching open durable reservation. Players, mode and stake must match. The financial settlement transaction closes the run as `SETTLED` and links its replay while committing all existing reward/statistics/vault effects. Rollback preserves the open reservation and the already reserved stakes for a safe retry. A terminal intent awaiting settlement, an aborted start or a settled game cannot be refunded through the failed-start operation.

The earlier room-layer debit/refund transactions are removed. Refunds now have an explicit ledger reason. Existing result totals still show settlement credits, including returned stakes; net profit must also account for the earlier stake debit. The settlement tests now reserve actual wagers before paying/refunding them, rather than constructing unfunded pots.

The migration is `20260911010000_game_creation_reservation`. It creates the run table and adds `WAGER_STAKE`/`WAGER_REFUND` reasons. It does not fabricate reservation records for historical or currently running legacy games. A wager without evidence of a reservation is refused rather than paid from an invented pot. Before eventual production rollout, drain legacy games and review unresolved wagers; no production reconciliation was attempted here. Participant references preserve the record against account deletion. Replay deletion leaves the run's closed status intact, so deleting a replay cannot reopen the wager.

## Evidence

Ten PostgreSQL service tests cover concurrent/repeated creation, full creation rollback, insufficient funds in the second account, a separate process exiting after creation commit, retry without a second debit, atomic abort/duplicate refund, reservation validation, settlement rollback and closure, terminal-intent protection, competing wallet spending and free bot eligibility. The process-exit test explicitly retains the known creation key; it does not prove automatic discovery or live-game restoration after restart.

Three socket tests cover a committed creation whose response is lost, competing human starts, and a session changing after commit but before installation. The focused creation/socket/economy/wallet run passed 79 tests before the final constructor simplification and additional settlement-rollback test (`.generated/tests-game-creation-final.log`). After those refinements, the full suite passed **394 tests across 45 files**, and the production build passed (`.generated/tests-reservations-full.log`, `.generated/build-reservations.log`).

Manual acceptance in staging: create a small wager room, ready both players, verify one stake debit each, play/resign, and check the resulting credit/refund. The controlled response-loss and context-change cases are covered automatically; production interruptions are not requested as a manual test.

## What is still missing

- Accepted gameplay, command identities and terminal jobs now commit together, ownership is fenced, and [startup restoration](game-restoration.md) loads saved games with an explicit clock/readiness policy. Versioned uninstalled reservations are now cancelled/refunded automatically; legacy null checkpoints remain review cases.
- Persist waiting-room, spectator, rematch, notice and finished-result lifecycle and restore those contexts.
- Durable active-human membership uniqueness is now enforced by [transactional game claims](game-membership.md), alongside creation/stakes. [Room departure](room-departure.md) now confirms failed-start cancellation before removing members; durable room lifecycle remains unfinished.
- Complete account-cleanup, target-concurrency and real deployment/crash/reconnect acceptance.

Do not restart a game from `initialState`, automatically refund every open run, or permit another server to mutate it without an ownership policy. Those shortcuts would discard accepted play or risk conflicting outcomes.
