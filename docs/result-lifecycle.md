# Durable finished-result lifecycle

Checkpoint: 11 September 2026. Terminal handling, result commands, reconnect and startup now use the result repository and its viewer/rematch claims. The integrated lifecycle is verified locally; owner browser and Railway replacement acceptance remain pending. No production migration or deployment was performed.

## State and ownership

`GameResultRecord` belongs to one terminal `GameRun`. It stores status, versioned state and revision. The state owns the original three-minute result deadline, player viewing/consent flags, spectator room IDs and deadlines, and one accepted rematch key/colour order/game association. Names, account flags, sockets and runtime timers are derived. Its deadline is the accepted checkpoint's end time plus `GAME_OVER_LINGER_MS`; retries, settlement delay and restart cannot extend it.

`ActiveResultViewer` supplies exclusive human viewer claims. Bots have no viewer claim and consent to a rematch automatically. Shared room/game admission rejects a claimed viewer until dismissal or the accepted rematch transfers that claim. Guest retirement protects result claims without relying on runtime sessions. Terminal handling creates these claims before publishing the ending.

`GameResultCommandReceipt` records exact action identity and revision. A duplicate returns the latest accepted result without repeating a transition, even after its original revision has changed. Different action content under the same identity is rejected. Dismissed viewers are removed from claims and remain absent in state; repeating initialization does not recreate them.

## Domain transitions

Pure policies live in `server/domain/resultState.js`. The repository accepts named actions rather than arbitrary JSON reducers.

| From | Action | Outcome |
| --- | --- | --- |
| No record | Initialize from terminal checkpoint and settlement intent | OPEN; fixed deadline and accepted viewers |
| OPEN | Player requests rematch | Save consent; STARTING when all humans consent, with bot consent automatic |
| OPEN or REMATCHED | Viewer dismisses | Remove that viewer; CLOSED when none remain |
| OPEN or REMATCHED | Deadline expiry | Remove due viewers and commit their expiry notices; CLOSED when empty |
| STARTING | Reserve accepted rematch | REMATCHED; create one game, swap colours, transfer human claims atomically |
| STARTING | Cancel before reservation | OPEN with fresh human consent, or CLOSED if the original deadline has elapsed |
| REMATCHED | Abort an uninstalled rematch | Restore parent viewers/consent state or expire them at the original deadline |
| STARTING | Player dismissal or expiry | Requires cancellation first; spectators may still leave independently |
| CLOSED | Any new action | Reject; existing command receipts remain readable |

Rematches are free, preserve the prior mode/turn limit/origin, and swap the original player order. A human cannot request once their opponent has left or the deadline has passed. Spectator expiry preserves an earlier room disconnect deadline rather than extending it to the player result deadline. A reserved child that has started play cannot be aborted back into its parent's result.

## Atomic boundaries and lock order

Initialization takes the captured gameplay ownership fence, source-room row when present, game key, then ordered accounts. It requires a terminal checkpoint and settlement intent. Result membership, source-room closure and release of room claims commit together. A room that already closed without a result record is not evidence of who was still viewing it; initialization refuses that inference. Ordinary room transitions also reject spectator admission after the game is terminal.

The terminal checkpoint repository acquires the source-room lock before its game-key lock and initializes the result in that same transaction. Checkpoint, settlement intent, game-claim release, result membership and source-room closure commit together. Publication installs the accepted closed-room revision too, so delayed room hydration cannot overwrite closure or resurrect a dismissed spectator.

Result commands take the parent game key and ordered accounts. Rematch reservation takes parent result/game key, child game key, then all involved accounts in order. `GameRun.resultSourceId` identifies the parent. Creation validates the accepted consent/key/colours/settings, commits one child, transfers player claims and associates that child with the parent result in the same transaction. Spectators remain with the old result.

Cancellation uses that same parent-before-child ordering. `abortGameStart` restores the parent's viewers and resets human consent in the transaction that releases child claims; expiry notices also commit there when the original deadline has elapsed. If a previously unknown room/result association appears while standalone cancellation waits for the child key, it retries the transaction with the correct lock order. An outer transaction must retry as a whole when that association-race error is returned.

## Runtime, reconnect and restart

`server/domain/resultRuntime.js` serializes result actions, reads accepted state and projects session membership. Result commands use exact persisted receipts; a lost response confirms the same command before returning success. `game:leave`, a spectator's `room:leave`, and the dispatcher release preceding an idle command all await durable dismissal. Local rematch request sets and the separate finished-room cleanup writer have been removed.

One result timer uses the earliest accepted player/spectator deadline. Expiry commits viewer removal and notices together before releasing sessions. Storage failures retain the last accepted view and retry. The timer starts from the committed ending even if settlement is slow. Retiring an empty result removes its runtime and prevents late publication; pending settlement remains tracked by the gameplay lifetime and drains during shutdown.

Bootstrap restores unfinished games first, rooms second, and results third, before listening. It validates result state and checkpoint versions, expires overdue viewers before recreating sessions, restores only retained viewers, and loads the durable settlement result. A record with one rematch request keeps that consent across restart. A STARTING request without a child keeps its accepted key and resumes when all humans reconnect. An uninstalled reserved child is cancelled by game restoration, which resets human consent and restores or expires the parent viewers atomically. A child with a trustworthy checkpoint restores as an active game with the normal recovery pause. Spectators remain with the old result through a rematch.

Reconnect waits for any terminal/result work already committed but not yet projected, then reconciles membership before the first snapshot. Opponent departure comes from the accepted viewing flags, not the presence of a socket. Bot consent requires neither a bot session nor a readiness event. Rematch creation swaps colours under the saved identity; a human disconnect before installation cancels the uninstalled child rather than leaving an occupied invisible seat.

## Manual acceptance still pending

1. Finish a human game, request a rematch from one side, and restart a local/staging server. Both result views and the first request should return. Accept from the other side: exactly one game opens with swapped colours.
2. Leave a result, restart and reconnect. The dismissed result must stay gone; the opponent should see that you left. Also start another bot game directly from a finished bot result.
3. Keep a spectator connected through game completion, a rematch and restart. They should retain the old result until they leave or its original deadline passes; they must not become a player in the rematch.
4. Restart while a result is open, then let its original three-minute deadline pass. Reconnect after expiry: show idle with the expiry notice, without granting a fresh result window. Dismiss that notice and confirm it stays dismissed after another restart.

Run these on the controlled candidate before production acceptance. Automated tests inject database faults and interleave commits; owner testing need not reproduce those faults manually. Actual Railway replacement and target-capacity measurements remain separate release gates.

## Verification and rollout

`tests/resultRecords.test.js` covers fixed deadlines, duplicate creation/commands, terminal/result rollback, source-room closure/claim rollback, spectator deadlines and late admission, refusal to invent viewers from a closed room, dismissal, consent races, atomic rematch reservation/rollback, cancellation, expiry notices, bots, admission conflicts, guest protection and ownership/version validation. `tests/resultRuntime.test.js` adds integrated result/rematch, bot, spectator, original-deadline, lost-response, delayed-projection, shutdown and two-process socket checks. Full-suite/build evidence is recorded in [growth/implementation-status.md](growth/implementation-status.md).

Migration `20260911090000_result_records` adds empty result/viewer/receipt tables and a nullable source-result association on game runs. It was applied only to the isolated test database and the Prisma client was regenerated. Deploy the migration before the integrated binary. It does not backfill old views: drain or explicitly expire result screens from the previous in-memory implementation before replacement, since their membership/consent cannot be reconstructed. Keep the single-owner deployment constraint.
