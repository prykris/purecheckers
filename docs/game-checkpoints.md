# Committed gameplay transitions

Implemented locally on 10 September 2026. This establishes durable accepted gameplay state and command identity. Subsequent [ownership fencing](gameplay-ownership.md) and [startup game restoration](game-restoration.md) restore unfinished games and human game sessions with paused clocks/readiness. Wider lifecycle persistence remains unfinished. Nothing was committed, deployed or migrated in production.

## One state transition boundary

`GameRoom.commit` serializes changes for one aggregate. A transition operates on an isolated draft through the explicit `gameCheckpoint.js` codec. The shared CheckersGame engine still decides legal moves, capture chains, promotion and draw outcomes. The live aggregate is not mutated while persistence is pending, so a concurrent sync request cannot expose an uncommitted move.

`commitGameTransition` locks the game identity, checks durable command receipts and the expected revision, then runs the pure transition. In one PostgreSQL transaction it saves the new checkpoint/revision, the accepted command receipt, and any terminal settlement intent. Only after commit does GameRoom install and publish that state through the existing snapshot protocol. No second client reconciliation channel was added.

This boundary covers human and bot moves, reveal acknowledgements/deadline completion, clock ticks/timeouts, resignations, draw offers/declines/agreements and disconnect forfeiture. Room membership, rematch requests, notices and session routing are not yet durable parts of this aggregate and still need their lifecycle repository work.

## Checkpoint and identity

`GameRun.checkpoint` stores schema version 1, the full engine state (including move history, capture chain, position history and no-capture count), started/start/end fields, end reason, reveal acknowledgements/deadline, pending draw offer and offer cooldown timestamps. Runtime timers, promises, socket state and monotonic clock anchors are excluded. The codec restores an actual CheckersGame instance with its methods and independent mutable data.

`GameRun.revision` orders committed gameplay changes. The outward snapshot's existing version/sequence remains responsible for presentation and transport ordering; those can also change for non-gameplay UI information. `GameCommandReceipt` keys are scoped to run, actor and request identity, and bind the command type/data. A duplicate is checked before evaluating the transition or rejecting a stale revision, returning the current authoritative checkpoint without replaying the move. Changed payloads and nonparticipant actors are rejected. These records must be retained while retry guarantees are required.

On an uncertain commit response, GameRoom first attempts to confirm the durable command receipt without executing its mutation again. If confirmed, it installs the committed checkpoint and acknowledges success. Otherwise it reads any newer authoritative revision for reconciliation and returns failure with the last confirmed state. A rollback creates neither a checkpoint nor an accepted command receipt.

## Terminal transition and recovery

Game-over is now persisted together with its settlement job. Only that committed terminal snapshot is exposed. A crash between accepting game-over and enqueueing its terminal intent is therefore closed for transitions using this boundary. The existing recovery worker settles the job and updates any still-present result screen.

If the terminal transition cannot commit, the last confirmed game remains live and the command fails. There is no speculative terminal result backed only by an in-memory retry buffer. The earlier unqueued-terminal buffer/enqueue retry hook was removed. Once terminal state commits, a financial settlement failure remains a retryable durable job, as described in [settlement-recovery.md](settlement-recovery.md).

## Clocks and asynchronous effects

Clock changes are currently checkpointed every second for timed games. Calls coalesce into one outstanding clock update rather than queueing unbounded ticks. Before a move, draw decision or explicit ending, elapsed time is evaluated on the draft. Successful database-commit latency is excluded when re-anchoring the running clock. A storage failure re-anchors the runtime clock while retaining the last confirmed remaining time; an invalid/stale player command does not reset elapsed time. Unlimited games do not write clock-only checkpoints.

This favors correctness and a simple durability boundary. Database throughput/latency at target concurrent-game load is not yet measured; do not claim a production capacity from these tests. [Restart recovery](game-restoration.md) now preserves saved clocks and pauses them until current human connections explicitly resume.

Bot retries use a bounded delay after a failed search/commit, while the existing game/colour/ply guards reject stale work. Reveal deadlines retry persistence failures. Disconnect forfeiture checks that the same participant is still disconnected when its transition is evaluated; storage failures retry through the existing session timer, and reconnect cancels it. Move analysis and emotes stay asynchronous and cannot decide game state.

## Migration and remaining restoration work

`20260911020000_game_checkpoints` adds checkpoint/revision and command receipts. Existing rows without a checkpoint are not backfilled with `initialState`: that would falsely present the starting board as the latest accepted play. Legacy games must be drained/reviewed before eventual production rollout. A safe automatic distinction between legacy null checkpoints and newly uninstalled runs belongs in the remaining restoration work.

Later passes now load the latest aggregate, fence old writers, restore active human game sessions and define paused-clock readiness. Versioned uninstalled starts are cancelled safely; ambiguous legacy null checkpoints require review. Expected revisions alone are not ownership: the separate generation/transaction lock fences obsolete writers. [Durable game claims](game-membership.md) now enforce one unfinished game per human. Waiting-room, spectator, notice, rematch and finished-result lifecycle restoration and deployment/concurrency acceptance remain unfinished.

## Evidence and manual acceptance

Six PostgreSQL transition tests cover checkpoint/command identity, competing revisions, terminal checkpoint/job rollback, a separate process exiting after commit before acknowledgement, capture-chain/draw-history restoration and invalid actor/started-game abort rejection. Seven new socket checks cover pending-commit snapshot isolation, rollback, lost response plus transport-cache loss, invalid-command clock behavior, failed terminal commits, the first bot move retrying after commit failure and reconnect invalidating a queued disconnect forfeiture. Existing gameplay and recovery tests also run through the new boundary.

The final focused run passed **79 tests across four files** (`.generated/tests-checkpoints-verified.log`). The full suite passed **407 tests across 46 files**, and the production build passed (`.generated/tests-checkpoints-full.log`, `.generated/build-checkpoints.log`). These tests prove local commit/retry behavior, not a complete production restart or load test.

Owner checks after the remaining restoration work is ready: play against a bot that moves first, play a forced capture chain, and reconnect during a draw offer. Confirm animation and input stay aligned with the recovered board. Database commit failures and process exits are covered by controlled automated tests; do not interrupt production to test them.
