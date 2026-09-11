# Restoring unfinished games

Startup takes gameplay ownership, waits for old writers through the ownership lock, then reads committed open runs before accepting connections or starting matchmaking. It never substitutes the initial board for accepted play. Runtime construction is shared with normal game creation.

## State and readiness

Each unfinished checkpoint is installed with a committed restart recovery state. Human sessions are reconstructed with the same database game ID and assigned colour; the existing authoritative snapshot and navigation controller restore the game route. The saved board, turn, capture chain, history, clock balances, original start time and draw offer survive. Socket IDs and timers are recreated, not deserialized.

The browser shows the restored board and a **Resume game** action, with clocks and moves paused. This is distinct from the original colour wheel. An interrupted wheel does not replay: both players already have assigned colours, and recovery readiness starts that game. An already-started game retains its original start time.

The grace period is two minutes. Readiness is an acknowledged game command bound to the current session, game, writer generation and connection. Another device or reconnect requires readiness again while the recovery is pending. A second server restart clears old readiness and starts a new grace period. Bots do not need a connection or readiness command.

When all humans have acknowledged from their current connections, normal clocks and bot scheduling resume. A returning human sees the bot's next move through the existing snapshot subscription, including when the bot owns the saved turn. Time spent offline or waiting for recovery is not charged against the saved clocks. Normal post-recovery disconnect rules still apply.

At the deadline, one ready, connected human wins by `restart-disconnect` if the other human did not resume. If no human is ready, the result is `ABORTED` with reason `restart-abandoned`: stakes are refunded once, and no ratings, game statistics, consolation, win rewards, bounties or milestones change. A bot never wins because its human failed to return. Terminal checkpoint and settlement intent commit together, and financial recovery uses the existing idempotent receipt.

Result presentation uses `shared/gameResult.js` across private history, profiles, live results, replay pages/boards, discovery and preview cards. `ABORTED` is a neutral cancellation for both participants, never a loss or draw. Private history returns `result: "cancelled"`; public history keeps the stored result code and profiles show a C badge labelled Cancelled. Replay text and cards say Game cancelled. Unknown result codes stay unavailable rather than inventing a win/loss/draw. The live sheet prefers the persisted result code once available. Cancelled replays remain excluded from discovery, but their direct history/replay links remain usable.

Deadline evaluation is serialized with readiness commands. A late command cannot change an already due outcome. A storage failure leaves the confirmed paused state and retries the deadline after one second. The ordinary disconnect-forfeit callback yields to restart recovery while it is pending.

## Ambiguous and uninstalled records

Migration `20260911040000_game_recovery_version` adds `recoveryVersion`, defaulting to zero for both historical rows and old binaries that omit it. New creation code explicitly writes version one. A version-one open run with revision zero and no checkpoint is known never to have accepted gameplay, so startup cancels that start and refunds its reservation through the existing atomic cancellation service.

A legacy null checkpoint is not safe to reconstruct or automatically refund. Startup fails with an identified game requiring review. Likewise, overlapping saved games for the same human, a game with no human, or a terminal checkpoint missing its settlement job fail validation before runtime installation or cancellation. The deployment must drain/review ambiguous legacy records first; do not rewrite their recovery version to bypass this check.

Terminal jobs are left to the settlement worker. Historical finished games are not automatically rebound to player sessions, because result dismissal is not yet durable. Fencing is still single-owner operation, not a horizontally scalable socket/session system.

## Verification and remaining boundaries

`tests/gameRestoration.test.js` exercises exact checkpoint restoration, paused clocks and command rejection, human readiness, replaced connections, two successive takeovers, safe start cancellation, legacy/overlap rejection, abandoned wager refunds, human forfeiture, interrupted reveal and readiness rollback. Separate tests boot the actual server against the isolated PostgreSQL database and reconnect authenticated Socket.IO clients. The bot case starts with the bot owning the saved turn and requires its move to arrive without another sync request. Both actual servers exit through ownership-loss shutdown.

These are controlled local checks, not evidence of a successful Railway rolling deployment. Waiting rooms, departure and active-game spectators now restore through the [durable room boundary](durable-rooms.md). [Recorded notices and dismissal](session-notices.md) also survive restart. Rematches and finished-result view membership remain unfinished. A subsequent [membership pass](game-membership.md) now enforces one unfinished game per human transactionally and rebuilds its claims before listening. Account cleanup and target-concurrency checkpoint/restoration throughput remain under review. No production migration or deployment was performed.

Manual acceptance after the implementation is ready for deployment:

1. Restart a local server during a human game, once during a capture chain. Confirm the same URL, turn, position and clocks; resume both browsers and continue the chain.
2. Restart during a bot's turn. Resume in the browser and confirm the bot moves without refresh. Repeat during the initial colour reveal.
3. Resume only one human, then neither. Verify the two-minute outcome and refunded stakes on cancellation; reconnect a ready browser and confirm it must acknowledge again while waiting.
