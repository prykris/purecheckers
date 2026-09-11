# Gameplay shutdown

Implemented locally, 10 September 2026. No deployment or migration was performed. This closes admission and draining races around asynchronous gameplay work; room persistence and restoration are covered by the subsequent [durable room boundary](durable-rooms.md).

## Runtime lifetime

`server/services/gameplayWork.js` provides one process-local lifetime for the captured gameplay owner. Room/game actions, direct game starts, quick-play room creation and optional move analysis register their promises before starting. The socket dispatcher uses the same boundary so it cannot release a finished-game session or dismiss a notice after admission closes. Room-list reads and disconnect/emote notifications keep their existing non-command interfaces; stopped rooms/games suppress the latter mutations.

`stopGameRuntime()` and `stopRoomRuntime()` close this shared admission boundary synchronously and wait for admitted work as well as their installed aggregates' existing transition, settlement and membership-change promises. Calling stop before the owner's first operation still closes admission. Repeating stop remains safe. A new explicit ownership acquisition establishes a new lifetime; a delayed operation retains its previous lifetime and cannot adopt the new owner.

The helper only handles lifetime checks and promise draining. Room settings, readiness, session changes, wagers and refunds stay in their domain services. The database ownership lock remains the authority for persisted writes. The lifetime flag does not discover a remote takeover by itself: the ownership watcher or a fenced write must still detect it.

## Boundaries after asynchronous waits

Queued multi-session gameplay reserves its participant queues synchronously while capturing the current lifetime. Shutdown drains these admitted jobs even before their callbacks begin, and the lifetime check rejects stopped work at dequeue. Queue ordering does not grant a new ownership generation to old work.

The lifetime now also owns an abort signal for recovery backoff. Uncertain room-creation confirmations and accepted-record projections retry while storage is unavailable, without holding database locks during the wait. Stop or lifetime replacement interrupts that wait immediately; an in-flight database call still remains in the drain until it settles. Unknown membership is not requeued merely because shutdown interrupted its confirmation.

Room installation requires the owning work context and checks it synchronously before changing the runtime map or sessions. This closes the gap between a committed projection promise resolving and its caller installing it. A room accepted before shutdown remains durable for replacement startup; the stopped runtime does not publish it. Recovery loops recheck the captured lifetime before each nested member restoration so they cannot adopt a later owner between participants.

- Room creation checks its captured lifetime after account lookup and QR generation, before installation. Joining, adding a bot and entering matchmaking check it after their account/bot lookups. Stopped work cannot recreate a room or search timer.
- Direct game creation checks before reserving a game and includes lifetime validity in its existing participant-context check after reservation and the reveal checkpoint. An uninstalled start is cancelled/refunded through `abortGameStart`, with the original owner, before the promise finishes. Financial effects retain their existing transaction and receipt rules.
- If ownership has changed, the old process cannot refund with its obsolete fence. The durable run stays available for the replacement's existing startup restoration/cancellation rules. A lost database response likewise is not proof that no reservation exists.
- Room-start failure handling does not reset/readvertise a stopped room. Rematch continuation cannot start a new game after awaiting final settlement in a stopped lifetime.
- Optional move analysis stays asynchronous relative to the move response, but its entire work chain is registered for shutdown. Cancellation/current-position checks guard the analysis result and later bot-reaction lookups. A dependency ignoring cancellation still stays in the drain until it settles.
- Settlement publication rechecks the installed game's stopped flag after fallback name lookups. It cannot rearm the result-linger timer after shutdown. Transport closure does not create new disconnect chat records for stopped games.

## Verification

`tests/gameplayShutdown.test.js` pauses actual QR/account operations and PostgreSQL transaction responses to check shutdown at account lookup, committed reservation and committed reveal checkpoint. It verifies that the stop promise remains pending, no game/room is installed afterward, same-owner cancellation refunds each player once and releases claims, and an obsolete owner leaves the durable record untouched. It also covers a complete room-ready start, fresh-owner admission versus stale work, pending matchmaking, nested rejection, analysis that ignores cancellation, settlement name lookup and stopped disconnect notifications.

The existing room and stale quick-play pairing fixtures now explicitly acquire gameplay ownership, matching application bootstrap. Socket, restoration and membership integration tests continue to exercise their real domain paths. Full-suite/build results are recorded in [growth/implementation-status.md](growth/implementation-status.md).

## Limits and acceptance

Graceful draining cannot make a killed process finish promises or guarantee unlimited shutdown time from the host. Database/search requests retain their existing bounds; the application does not pretend that an arbitrary unresolved dependency has completed. A hard kill still relies on durable game records and startup recovery. Waiting-room rosters, codes, readiness and active-game spectators now restore through the durable room boundary. [Recorded notices/dismissal](session-notices.md) now survive restart, and admitted result-expiry writes drain on shutdown. Rematches and finished-result view memberships remain unfinished. This is not evidence of successful Railway rolling replacement or capacity at a particular concurrency.

Manual local/staging check: start a room or bot game, then stop the server during setup. The old process must not advertise a new game after shutdown; reconnect to the replacement and verify the accepted durable game/refund outcome according to [game-restoration.md](game-restoration.md). Use the automated pauses for precise commit-boundary checks instead of attempting to time or inject database faults in production.
