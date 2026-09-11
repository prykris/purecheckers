# Leaving a room after a failed game start

A room may retain a creation identity after a failed or uncertain start. The game and both wager stakes may already have committed even though no live game was installed. Departure must resolve that identity before discarding the room roster or releasing the user's session.

## One departure path

Player leave, host kick, disconnected-room expiry and failed bot-room cleanup all await `leaveRoom`. While a player change is in progress, the room enters `updating` synchronously. Its roster remains visible, ready/join/start mutations are rejected, and the waiting screen, room banner and directory show that the change is being confirmed.

The domain delegates to the existing `abortGameStart` service under captured gameplay ownership. That service serializes with creation using the same game-key lock. It confirms an already aborted identity, reports a creation that never committed, or atomically refunds stakes, releases active-game claims and marks the start ABORTED. It still refuses started play or terminal intent. Confirmed absence is distinct from a cancellation guard declining the operation.

Only after this outcome is confirmed does the domain remove the player, transfer host ownership if needed, close an empty/bot-only room, publish notices and release session/navigation context. A spectator departure never cancels the players' reservation. A stale roster entry cannot force a user out of an unrelated game or room.

If cancellation fails, the room retains its accepted status, roster and creation identity, and the command reports failure. It does not falsely advertise a waiting state. A lost commit response is confirmed by the same idempotent cancellation, so retry cannot issue another refund. A failed bot start also awaits this cleanup; if storage remains unavailable, the room retains its accepted attempt for automatic recovery or departure retry.

## Expiry and reconnects

Room expiry checks the same disconnected session and room before work, inside guarded cancellation after lock waits, and before publishing departure. A reconnect before cancellation prevents expiry. If the refund has already committed while the player reconnects, the player remains in the waiting room, its cancelled attempt is cleared, and readiness resets for a fresh start. No false expiry notice is published.

Room players and spectators now use one room-owned timer over persisted deadlines. A storage/busy failure retains the context and retries after one second while the same user remains disconnected there. Reconnect guards and shutdown stop obsolete expiry. Active-game players use the game's disconnect lifecycle. Room presence writes retry too, so a failed offline update cannot silently abandon cleanup.

Server shutdown marks rooms stopped and drains pending membership-change promises along with game/settlement work. The [shared shutdown boundary](gameplay-shutdown.md) also closes admission and drains asynchronous room creation, game starts and domain commands. The [durable room boundary](durable-rooms.md) now commits roster/host/closure and claims before publishing session changes and restores waiting-room membership at startup.

## Verification and limits

The integrated full suite passed **536 tests across 55 files** (`.generated/tests-live-room-recovery-full.log`) and the production build passed (`.generated/build-live-room-recovery.log`). The build retains only the existing adapter-generated unused-import warning.

Socket tests cover an uncommitted start, departure held before refund commit, failed cancellation and explicit retry, lost cancellation response, kicks, spectator departure, reconnect before cancellation, reconnect after refund but before departure publication, and expiry retry after storage recovers. Lost game/bot-start responses now confirm the original game automatically. Reservation/departure fixtures explicitly stage an uninstalled durable game instead of relying on the old lost-response bug. Existing creation/settlement tests cover transactional refund rollback and deduplication.

Waiting-room rosters, join codes, readiness, closure and active-game spectator membership now restore from durable records. Removal notices now commit with departure, and dismissal survives restart through [session-notices.md](session-notices.md). Rematches and finished-result view membership still require durable lifecycle work. Cancellation/refund restores the waiting room atomically; a subsequent guarded departure commits roster/claims/receipt before publication. No production migration, deployment or commit was performed.

Manual acceptance in local/staging: after a failed wager start, leave or remove the opponent; confirm the room stays visible until the response and both balances recover. If cancellation is temporarily unavailable, the error must leave the room visible and retryable. Normal spectator departure must leave player stakes unchanged. Automated tests inject the response-loss and database failures; do not introduce them in production for this check.
