# Durable room records — persistence boundary

Checkpoint: 10 September 2026. Live room commands, room/game financial handoff and startup restoration are implemented and tested locally. The subsequent [notice boundary](session-notices.md) persists removal notices and dismissal. The integrated [result lifecycle](result-lifecycle.md) now restores finished-result membership and rematch consent too. No production migration or deployment was performed.

## Source of truth and projections

`RoomRecord` owns a database-generated numeric identity, immutable creation intent, unique invitation code, status, versioned JSON state and revision. State contains settings, host/player/spectator IDs, readiness, last-observed online/deadline fields, start identity and game association. Status lives in its enum column, not a second JSON field. Usernames and account type come from `User`; sockets, timers and generated QR images are excluded.

`ActiveRoomMember` is an exclusive human membership constraint derived in the same transaction as room state. Its role distinguishes players and spectators; neither can simultaneously claim another room or an unfinished game. Bots have no exclusive room claim and normalize to ready/online. Guest retirement protects durable room claims even without a local session. `GameRun.roomId` identifies the room that authorized a game; direct games retain a null association.

`RoomCommandReceipt` records the accepted payload and revision for a member's request identity. A duplicate returns the current room plus the originally accepted command revision without executing its reducer again. Changed payloads are rejected. Creation has a separate creator/request identity: its allocated invitation code is excluded from intent comparison, so retrying with a newly generated code returns the original room/code. Closed records are not resurrected by creation retries, and their invitation codes remain reserved.

## Accepted invitation entry

A shared waiting room offers friendship actions by clicking the other human's name. If either seated human joined through the invitation code (QR, link or code entry), both see an explicit add-friend suggestion. This is derived from accepted entry evidence, not a new room type or a browser URL guess. Joining never creates a friendship. The existing friendship service accepts either a friend code or stable player ID; the same private reads, request/accept commands, action receipts and recovery journal serve both Friends and the room. Post-commit notifications invalidate each participant's read; reconnect, focus and the existing presence heartbeat recover missed notifications. Existing friends do not receive the automatic suggestion. Spectators and bots do not receive room friendship prompts.

A player admitted by `room:join` using its valid code has `joinedViaInvite: true` in the committed room member. Directory joins by room ID are false; caller-supplied attribution flags are ignored. The field is optional for historical records, so their canonical JSON and normal readiness/start transitions remain compatible. Existing membership cannot change its entry evidence; leaving and subsequently joining is a new membership. Bots and spectators cannot have true player invitation evidence. This field is written by the existing membership transaction and receipt path, not by an independent analytics write.

While reserving a game under the source-room lock, `createGameRun` copies invited human participant IDs into `GameRun.invitedPlayerIds` in the same transaction as the game and membership transfer. Retries return that original game. Source room cleanup cannot erase the game's evidence. Direct games and result rematches start with an empty list; they do not inherit the original conversion. The game runtime restores the field from GameRun, outside mutable board checkpoints. Participant snapshots expose only their own `enteredViaInvite` boolean, never the ID list. Old games default to an empty list because their room origin cannot prove how anyone joined.

The additive migration is `20260911140000_game_invitation_entry`. It adds the default-empty GameRun array; no historical attribution is inferred and no existing room JSON is rewritten. Local tests apply it only to the isolated test database. Production must apply this migration before starting the new Prisma client/server. See [deployment](deployment.md) and [first-session verification](first-session-verification.md#accepted-invitation-entry-and-game-attribution).

## Transitions

### Editable waiting rooms (11 September 2026)

The friend shortcut and Create Room use the same waiting screen, settings form, membership and readiness flow. New friend rooms are private, free, 60 seconds per turn, with spectators allowed and explicit readiness. Existing single-player auto-start rooms can switch to explicit readiness by saving settings.

`room:settings` uses the normal durable room command receipt and revision boundary. Only the current host can edit a waiting room while every player is unready. The transition cannot alter membership or start a game. Wagers require every seated player to be registered, human and able to afford the amount. Disabling spectators requires an empty spectator list. A stale settings form must reopen against the current snapshot. Targeted profile challenges retain their fixed invitation restrictions and remain unlisted.

`room:ready` with `ready: true` must include `expectedSettings` matching the accepted settings. This prevents a delayed click from consenting to a changed wager or timer without rejecting simultaneous ready clicks for unchanged settings. Unready never requires a settings match. Settings cannot change during readiness or game start.

The room directory now includes ordinary private rooms with a locked state. Its separate public projection omits invitation codes, links and QR images. Members receive those through their own snapshots. Joining or spectating a private room still requires its code, checked again inside the queued transition so a concurrent privacy change cannot admit a stale public join. Visibility changes retain the room identity, invitation and memberships; ordered directory updates carry the new visibility or closure. The Open filter excludes locked rooms.

`server/domain/roomState.js` owns canonical durable fields and the phase graph; existing `roomRules.js` supplies readiness/start rules. `shared/rooms.js` supplies invitation format and settings validation to the existing room actions, SSR invite page and repository.

| From | To | Required condition |
| --- | --- | --- |
| WAITING | WAITING | Valid roster/host, unique roles and available human claims |
| WAITING | STARTING | Both accepted players satisfy readiness/online policy; persist one start key and chosen colour order |
| STARTING | STARTING | Preserve players, host and accepted start identity |
| STARTING | PLAYING | Exact associated game, stakes and player-claim transfer commit together |
| STARTING | WAITING or CLOSED | Under the start-key lock, no game exists or cancellation is confirmed |
| PLAYING | PLAYING | Preserve game/player association; spectator/presence state may change |
| PLAYING | WAITING | Confirmed aborted, uninstalled start; refund and claim restoration commit together |
| PLAYING | CLOSED | Associated game is terminal or already settled/cancelled |
| WAITING | CLOSED | Release claims while retaining immutable room/invite identity |
| CLOSED | — | No further transitions; existing command receipts remain readable |

Origin and creation intent are immutable after creation; current settings change only through the host transition described above. Removing the final human closes the room. Offline human records require a valid disconnect deadline. Joining a wager room checks affordability; existing membership updates do not block departures or presence changes when a balance falls. Game creation independently validates and reserves the stakes.

## Live commands and recovery

The room snapshot publishes effective player readiness through the same predicate used by start admission. This projection does not overwrite stored manual ready flags. `readyToStart` and `canAddBot` express room-level availability and are false during pending updates; the command owner still checks the actor's host/session authority. The waiting-room UI consumes these fields and no longer interprets WAITING as proof of a failed game start.

Session commands, human pairing and reconnect restoration now use `sessionWork.js` to order overlapping participants before entering room work. Room creation rechecks its actor inside the transaction after account lookup and membership writes; obsolete creation rolls back, while an already committed creation identity can still be confirmed. Quick-play holds exact pool claims until durable admission or confirmed requeue; [first-session verification](first-session-verification.md) records cancellation, retry and wait-preservation evidence.

If both creation responses fail, confirmation reads under the creator/request lock before deciding whether the room exists. Changed intent cannot use that fallback to accept another room. Accepted records retry projection on temporary read failures. Unavailable confirmation keeps session work pending with one-to-ten-second backoff, releasing all database locks between attempts; shutdown interrupts the wait. A failed pair restores any other durable membership before releasing its claims back to search. The browser does not infer a failed write from a timeout.

`roomRuntime.js` serializes work per room, hydrates current account metadata and applies accepted records to sessions. The runtime map is a projection. `rooms.js` owns create/join/ready/bot/spectate/leave/kick/start/expiry policies. Its temporary `updating` presentation does not overwrite the accepted database status. Creation and member commands reuse durable request identities; uncertain responses confirm the saved record before publishing. A start uses its saved key and colour order, confirms a lost response automatically, and retains or cancels an unresolved attempt according to the game repository.

Bootstrap runs `restoreActiveGames`, then `restoreRooms`, before listening. Game recovery refunds uninstalled reservations and restores their room claims; room recovery resets accepted starts with no reservation, validates versions/shape/game association, closes terminal rooms and restores remaining player/spectator roles. QR images are derived from stored invite codes. Active-game players retain the game's recovery protocol; spectators attach to that same game.

Restored humans start offline with readiness cleared. Bots stay online/ready. A previously online human gets a two-minute deadline; an already offline member retains the original deadline across repeated restarts. One room-owned timer expires waiting players and spectators, transfers the host or closes a room with no humans, and retries failed cleanup. Presence persistence also retries after storage failures. Session timers handle active-game disconnect forfeiture only.

Reconnect reads durable membership and reconciles room presence before sending the connection's first snapshot or admitting its commands. Sync requests wait for that initialization too. A replaced connection cannot publish to its successor. A creation accepted before its runtime publication can therefore recover from its durable claim.

## Transaction and lock order

Mutation takes the database ownership fence, room row lock, involved game identity locks in sorted order, then ordered user locks. Reducers are synchronous and operate on a cloned draft. State, membership and command receipt commit or roll back together. Revision conflicts cannot overwrite a newer room. Unknown versions and noncanonical records require review. Domain handlers still authorize actions; the repository is not a public API for arbitrary reducers.

Creation serializes the creator/request key before user locks. Room admission and direct game creation share user locks and check each other's active claims, preventing a room join racing with a direct game from claiming the same person twice.

For room-backed games, `createGameRun` locks the source room before game identity and users, then checks the accepted key, colour order, settings, mode and origin. Stake debits, game claims, the room's PLAYING revision and deletion of its player-role room claims commit together. Spectator claims stay with the room. Repeating creation returns the existing run without another debit or transfer.

`abortGameStart` restores waiting-room state, resets human readiness, clears the game/start association and recreates human room claims in the same transaction as refunds and game-claim release. If creation commits after cancellation's initial association lookup, standalone cancellation retries its transaction once to acquire the newly known room lock first. A caller supplying an outer transaction receives the retry error and must retry that entire transaction; the repository cannot restart its caller's unrelated work.

## Verification and migration

`tests/roomRecords.test.js` has 15 PostgreSQL cases: creation/command retries, rollback, last-seat joins, exclusive spectator roles, room-versus-game races, handoff/cancellation and their rollbacks, stale starts, bots, guest protection, closed-code retention, malformed/unready state, ownership/version fencing and creation/cancellation interleaving.

The integrated full suite passed **536 tests across 55 files** (`.generated/tests-live-room-recovery-full.log`), and the production build passed (`.generated/build-live-room-recovery.log`). Eleven restoration/integration tests cover private invites, generated QR data, bots, spectator roles, repeated deadlines, uninstalled refunds, invalid versions, unaffordable existing members, lost responses, presence retry and the first snapshot from a fresh server process. Existing Socket.IO tests retain departure/refund/reconnect race coverage and now verify automatic recovery of lost starts. Local process tests do not establish Railway rolling-replacement behavior.

Migration `20260911070000_durable_rooms` was applied through isolated test setup. It adds empty room tables and a nullable source-room association; it does not synthesize records from old process memory. The Prisma client was regenerated. Further schema changes require another migration; do not edit an applied migration.

## Remaining lifecycle and release work

Departure, closure and their user notices commit together; [notice dismissal](session-notices.md) also survives restart. The [result lifecycle](result-lifecycle.md) now restores finished-result viewers, spectator result roles, original expiry timers and rematch consent. Membership is not inferred from historical replays. Owner browser and production replacement acceptance remain pending.

At rollout, old in-memory rooms have no stored record and cannot be reconstructed. Apply the migration before the new binary, drain old rooms or explicitly handle their loss, and retain the single-owner deployment constraint. Complete the owner acceptance pass and real Railway replacement/capacity checks before certifying production continuity.

Manual local/staging acceptance: create a private room, add a spectator, restart and reconnect through the same invite; confirm the URL and displayed role agree. Humans must ready again, and a bot must remain ready. Leave everyone disconnected for two minutes, including across another restart; the room must disappear. For an active game, both humans resume through the game's recovery control and the spectator sees that same board. The full roadmap remains unfinished.

## Terminal handoff to results

Terminal checkpoint commits close the source room and transfer spectator claims to the [result lifecycle](result-lifecycle.md). The runtime installs that closed revision before publication. A delayed older room projection cannot revive the room or a spectator who already dismissed its result. Result spectators leave through the same persisted result dismissal even after the source room is removed from the directory.
