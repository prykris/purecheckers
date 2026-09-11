# Player experience and transition audit

11 September pairing recovery checkpoint: [first-session verification](first-session-verification.md) records shared command/pair/reconnect ordering, exact search claims, preserved partner wait time and confirmation of failed or uncertain room creation. These locally tested boundaries do not certify the complete first-session matrix, production replacement or capacity.

11 September puzzle recovery checkpoint: [daily puzzle recovery](puzzles.md#recovery-verification--11-september-2026) now validates confirmations, bounds requests, preserves pending work and reconciles server reveal history over conflicting local solves. Account retirement shares the wallet lock, and failed midnight page reloads remain retryable. The full 793-test suite and the final 32-test puzzle run pass, including controller playthroughs of all 31 launch puzzles. This closes those source-confirmed recovery gaps; the full plan 03 page/publication and broader browser acceptance audit remains open.

11 September profile privacy checkpoint: roadmap revalidation found an unconditional setting write and unbounded/stale component completion path. [Profile privacy writes](profile-state.md#privacy-writes) now require the accepted profile revision, reject older choices and re-read the authoritative account after confirmation or uncertainty. Shared deadlines, generation/disposal guards and explicit failed-read recovery cover the browser path. This is a scoped closure for plan 06 Phase 3 item 2, not a completed full-app or roadmap audit.

11 September piece appearance checkpoint: [piece-appearance.md](piece-appearance.md) supersedes the earlier open skin-rendering finding. Equipped skins now use a coherent authenticated projection and shared palette across live/spectator/app replay rendering, with bounded read recovery and account lifecycle guards. Standard pieces are selectable through the existing equipment journal/receipt transaction. Theme policy/application, browser contrast/layout acceptance and production verification remain open.

11 September Friends checkpoint: [friends-state.md](friends-state.md) supersedes the older open Friends implementation findings below. Accepted/incoming/outgoing lists share one server read and the common browser lifecycle. Request/accept/remove use durable receipts, shared account locks and an unordered database constraint; old confirmations cannot recreate/remove newer relationships. Presence reads the current session connection and phase. Browser acceptance and production migration/capacity remain open, as do cosmetic rendering, the theme-policy decision and broader launch gates.

11 September emote checkpoint: [emotes.md](emotes.md) records server-owned entitlement/content, acknowledged transient sends, attempt limits and lifecycle guards. Current game membership and connection are rechecked after lookup; the browser recovers its list and ignores obsolete sends/events. Local socket coverage includes forged/unowned payloads and asynchronous failures. Emote browser acceptance, equipped cosmetic rendering and Friends recovery remain open.

11 September shop checkpoint: [shop-state.md](shop-state.md) covers coherent catalogue/inventory reads, view recovery and durable equipment commands using the existing wallet journal/receipts. Old selection retries cannot undo newer choices. Cosmetic rendering remains incomplete: equipped skins/themes are not consumed by the renderer/picker, and the owner theme-policy question is pending. Game emote entitlement/read lifecycle and Friends state/presence are also still open; these are not cosmetic polish deferrals.

Scope: source inspection of the gameplay journey, supporting room/lobby UI, recovery, spectator views, results and replay. This is an implementation inventory and proposed contract, not a claim that every scenario has been reproduced in a browser or fixed. Shop, treasury and account-management workflows need their own inventories before claiming full-app coverage.

11 September treasury checkpoint: [treasury-state.md](treasury-state.md) now defines one committed overview, personal pending rewards, server-provided claim availability and a tested browser read/claim controller. It fixes funded-but-disabled claims, mixed-transaction totals, missing deferred-payment totals and omitted wager reservations. Loading errors offer Refresh; obsolete reads and claim completions cannot revive a previous account/view. Browser acceptance and Friends/Shop resource lifecycles remain open.

11 September profile checkpoint: User writes now share a transactional revision, and a single browser account owner prevents stale or cross-generation profile replacement. Friends no longer assigns independent reads; Treasury no longer adds a historical claim receipt to local coins. Privacy, confirmations, reconnect, settlement and focus use one refresh path. Repeated five-second revision hints now refresh connected recipients after remote tips/admin changes and recover missed notifications or failed reads. [profile-state.md](profile-state.md) records evidence, latency limits and manual checks. Other resource-list ordering, browser acceptance and production capacity remain open work.

11 September administration checkpoint: coin adjustments, rating/stat resets and permission changes now use current transactional authorization and durable receipts. Coin changes create ledger entries; resets preserve reward history and wait for gameplay/result departure and settlement. Admin and wallet controls share one journal mechanism for uncertain responses, reload and account replacement. See [admin-actions.md](admin-actions.md) for policy, rollout and manual acceptance; immediate target-profile broadcasts and browser acceptance remain outside the verified scope.

11 September browser checkpoint: the friends walkthrough reproduced a standard-room freeze caused by non-idempotent chat visibility/read publication. That loop is fixed at ChatClient, with a reentrant-subscriber regression and successful two-guest create/join/ready/move/result checks. Shared dialogs explicitly center despite the global margin reset. Unavailable sharing now exposes the actual invitation URL, verified with clipboard denial; see [strategy verification](strategy-verification.md) for scoped browser evidence. This is not a full-app or production acceptance claim.

The animation contract in animation-contract.md covers motion. This audit extends it to what the player can do, what feedback they receive, why a transition occurred, and what happens if it is interrupted.

Update, September 10: navigation now has one controller and a SvelteKit history adapter (see navigation-contract.md). The room banner remains visible until acknowledged departure; replay loading is generation-scoped and exposes errors. These address the original banner and obsolete replay-completion findings below. Board movement/capture/promotion/result sequencing is implemented with automated lifecycle coverage. Persisted replay identifiers and persistence failure status are now implemented and covered by gameSocket tests. The table below retains the original findings, not a current list of exclusively open issues; remaining rows need individual revalidation before closure. See [the documentation-to-code review](growth/implementation-status.md#documentation-to-code-review--10-september-2026-before-the-work-above) for the broader roadmap status and confirmed remaining discrepancies.

## Revalidation checkpoint — 10 September, later pass

The latest [room-departure checkpoint](room-departure.md) confirms cancellation/refunds before leave, kick, expiry or failed bot-room cleanup discards membership. Pending and failed changes retain an actionable room; spectators do not affect stakes. Both reconnect timings and retry after storage failure have socket coverage. The full 447-test suite and production build passed. Durable room lifecycle and the wider remaining roadmap are still open; prior checkpoint paragraphs below retain their historical scope.

A later [membership checkpoint](game-membership.md) now enforces one unfinished game per human in PostgreSQL, with atomic creation/stakes and release at terminal/cancellation commits. Delayed settlement cannot remove a newer membership, and a browser retry after an uncertain uninstalled bot start cancels the orphan before proceeding. Startup rebuilds claims under ownership. The full 438-test suite and build passed; immediate abandoned-room cancellation and the wider room/session lifecycle remain open. The earlier checkpoint below describes the status at its own verification date.

Subsequent startup recovery now restores unfinished checkpointed games and human game sessions before accepting connections. The browser shows a saved board, paused clocks and explicit Resume game readiness, separate from the colour wheel. Connection replacement invalidates readiness; unattended recovery cancels/refunds without statistics or rewards. The 427-test full run, final 15-test restoration suite and production build passed, including fresh-server human and bot socket recovery. See [game-restoration.md](game-restoration.md) for exact semantics and three manual checks. Waiting-room, spectator, rematch/notice and finished-result lifecycle persistence, durable membership uniqueness, account cleanup and actual Railway/concurrency acceptance remain open. The checkpoints below retain their historical verification scope.

A subsequent settlement pass moved replay, ratings, rewards, vault operations and reward eligibility into one transaction with a durable deduplication receipt. Pending claims now retain an idempotent receipt. See [game-settlement.md](game-settlement.md) for the 347-test/build checkpoint and explicit limits: live state and wager reservation still lack durable restart recovery; terminal retry intent is now persisted once its enqueue commits; purchase/tip gaps were addressed in the subsequent [wallet-actions checkpoint](wallet-actions.md), while other economy paths remain under audit. The original broad persistence exclusions below are historical, not a claim that no settlement improvements exist.

The findings table below is historical. The later pass implemented and tested immediate command feedback, acknowledged chat delivery/recovery, versioned room-directory reads, forced-transition notices, reconnect deadlines, spectator names/counts and the unlimited-clock draw cooldown. RoomBanner now labels the operation Leave, including when ownership transfers. Starting-room and result persistence/rematch views were rechecked in source; persisted replay IDs and delayed result details have socket coverage.

Draw responses now display confirmation and disable repeat requests. Resignation is invalidated by terminal state, a received draw offer or lost readiness. Native dialogs share focus containment/return and respect pending operations; side panels yield to gameplay context changes and required decisions. The canvas board and puzzles share arrow-key navigation, with named squares and native button activation. Board motion already respects reduced motion; dialog/panel motion now does too. Unused move-rating decoration and stale canvas/spectator CSS are absent.

Automated verification: 313 tests passed before the final accessibility edits; focused keyboard/modal/navigation/bootstrap/puzzle tests and the subsequent build passed. These do not replace the manual checks below. Strategy-article diagrams now cancel pending work and use the shared worker scheduler in the browser; their manual reset/motion checks and editorial verification remain pending. Shop, treasury, persistence across server restarts and result-settlement atomicity remain outside a completion claim.

Manual acceptance still required:

1. Use Tab, arrows, Enter and Space to select and move on the board as both colors; verify mandatory chains and a reconnect while focused.
2. Open/close room creation, resign, draw, account saving and both side panels with the keyboard. Focus must remain inside the active modal and return to a connected trigger or the board after closure.
3. Receive a draw offer while another dialog is open, and finish a game while a decision is pending. No stale controls should obscure the result.
4. Watch an unlimited game, disconnect/reconnect a player near the deadline, and check the countdown and spectator badge. End the game and recover the spectator view after room cleanup.
5. Exercise chat retries, history and channel switches using docs/chat-recovery.md. Switch room filters during updates and reconnect; no wrong-filter or revived closed room should appear.

## Findings to resolve before adding visual polish

| Priority | Finding from current source | Player consequence | Source / required treatment |
| --- | --- | --- | --- |
| P1 | RoomBanner sets a local leaving flag before acknowledgement; it resets only when activeRoom disappears | A rejected/offline leave can hide the room banner indefinitely while the player still belongs to the room | src/lib/components/RoomBanner.svelte. Derive pending feedback from the command lifecycle; retain the authoritative room until departure is accepted |
| P1 | Offline/busy send failures return a rejected result without publishing session.error; several callers ignore that result | Some buttons can appear to do nothing | src/lib/sessionClient.js, QuickPlay.svelte, RoomWaiting.svelte. Define one consistent action feedback contract for immediate rejection, pending, accepted and failed |
| P1 | The resignation confirmation is local state, independent of gameOver and connection status | A terminal snapshot can reveal a result behind a stale confirmation dialog | GameScreen.svelte. Modal validity and priority must be derived from current context |
| P1 | Room removal produces idle with no retained reason | The same screen change cannot distinguish being kicked, expiry, closure or voluntary departure | server/domain/rooms.js, sessions.js, snapshots.js. Preserve relevant server-originated reasons in recoverable snapshot metadata; do not infer them from animation |
| P1 | The live game-ended notification uses the in-memory game ID while replay fetches a database Game ID | Opening a newly announced game can request the wrong replay; GameLog silently catches the error | server/domain/games.js and src/lib/components/GameLog.svelte. Carry the persisted replay identifier and expose loading/failure feedback |
| P1 | Chat immediately inserts a message with no persisted ID, skips the sender's echo, and has no delivery acknowledgement | Rejected/rate-limited sends can look delivered; reconnect replaces those local messages with actual history | chat/RoomChat.svelte, socketService.js and server/socket/chatHandler.js. Treat message delivery as its own acknowledged workflow, separate from gameplay commands |
| P2 | Waiting-room controls do not use room.status to show starting/failed-start states | Controls and hints can remain misleading while the server reserves and starts a game | lobby/RoomWaiting.svelte. Display starting status and server-derived action availability |
| P2 | Room-list starting status falls through to Full; initial loading looks like an empty list | Players cannot distinguish loading, full, starting and unavailable | lobby/RoomList.svelte. Separate read lifecycle from room lifecycle |
| P2 | RoomBanner assumes the second seat is always the opponent; host departure is labelled Close Room even when ownership can transfer | Wrong name or consequence can be shown | RoomBanner.svelte, lobby/RoomWaiting.svelte, server/domain/roomRules.js. Identify participants by user ID and label the actual server operation |
| P2 | Draw offers are still shown as an action against bots; pending draw responses have no distinct presentation | The player can select an action that the server always rejects, or cannot tell whether a response is confirming | GameScreen.svelte and domain/games.js. Add explicit permitted actions/availability reasons to the presentation model |
| P2 | Result data can arrive after the terminal board snapshot, but the first result view substitutes zero/empty rewards | No distinction between pending result details, zero rewards and persistence failure | GameScreen.svelte and domain/games.js. Model result-detail availability explicitly; animation must not make persistence look successful |
| P2 | Rematch requests exist in the protocol but no matching result UI consumes them | The rematch branch has no complete player journey | domain/games.js, sessionCommands.js, GameScreen.svelte. Specify request, opponent waiting, acceptance, failure and cancellation/expiry |
| P2 | Opponent disconnect text always says 30 seconds; no server deadline is exposed | It looks like a fresh full grace period even after reconnecting near expiry | GameScreen.svelte, domain/sessions.js and snapshots.js. Use a server deadline for a recoverable countdown |
| P2 | Spectator names fall back to Red/Black when the room record is removed, even if the game remains available | A result/recovery view can lose participant names | domain/snapshots.js. Use the game roster after room cleanup |
| P2 | Player spectator count reads activeRoom, but in-game snapshots have game data and no room projection | The game-screen spectator badge lacks the authoritative count it needs | stores/app.js, GameScreen.svelte, domain/snapshots.js. Include the needed audience summary with the game snapshot |
| P2 | Room timer labels show 0s for unlimited games | The room description implies a zero-length turn | lobby/RoomWaiting.svelte and RoomList.svelte. Use consistent unlimited-clock presentation |
| P2 | Search joinedAt is regenerated during serialization rather than representing queue entry | An elapsed-search display cannot survive snapshots or recovery correctly | domain/snapshots.js. Store the actual transition timestamp at queue entry |
| P2 | Keyboard board interaction, reduced-motion handling and focus restoration are not defined in the current gameplay components | Motion and pointer-only controls exclude part of the audience; modal dismissal can strand focus | BoardView.svelte, GameScreen.svelte, RoomCreate.svelte, panels/SlidePanel.svelte. Include accessible interaction in every transition contract |
| P2 | Replay loads silently fail; the async request can complete after the user has moved to another context | A slow response can produce a stale replay navigation intent | GameLog.svelte and stores/gameScreen.js. Bind the request to its origin context and cancel/discard obsolete completions |
| P3 | Move-rating CSS remains but move-analysis notifications are no longer consumed by the game screen | Rating decoration has no data pipeline | GameScreen.svelte and domain/games.js. Decide whether to restore analysis as optional presentation data or remove that feature coherently |

P1/P2 here prioritize the player-experience work; they do not assert production incident frequency. Some findings are architectural data gaps, others are directly observable code paths. Each needs a regression test or browser scenario when implemented.

## Four coordinated dimensions

Do not build one enormous state machine containing every combination. Keep each dimension explicit, with a single composition point deciding the visible controls and overlays.

~~~mermaid
flowchart TB
    Snapshot[Accepted server snapshot] --> Domain[Authoritative phase and context]
    Transport[Connection and command outcome] --> Availability[Permitted input and action feedback]
    Domain --> Availability
    Snapshot --> Diff[Presentation transition planner]
    Diff --> Motion[Bounded animation controller]
    Domain --> Overlay[Valid overlays and priority]
    Availability --> Overlay
    Intent[Local selection, dialogs and panel preferences] --> Overlay
    Motion --> View[Rendered player experience]
    Overlay --> View
    Availability --> View
~~~

- Domain: lobby, searching, waiting, starting, live game, terminal game and spectator equivalents.
- Connection/action: synchronizing, ready, confirming, uncertain, recovering, rejected and replaced.
- Motion: stable, entering, moving, capture, promotion, result reveal and snap/cancel.
- Interaction/overlays: selected square, dragging, mandatory chain, confirmation, draw response, chat and other panels.

These are not four copies of game state. Domain values are read-only projections of the authoritative snapshot. The other dimensions hold only information that the snapshot does not own, such as focus and elapsed animation time.

## Full transition coverage inventory

For every row, define entry feedback, permitted actions, visual behavior, cancellation, recovery behavior and an acceptance test. A fade alone does not complete a row.

| Journey | Cases to cover |
| --- | --- |
| Bootstrap | No token; restored token; authentication loading/failure; first snapshot; stale stored identity; replaced session |
| Lobby reads | Loading room list; empty result; failed refresh; room added/updated/removed; changed filter; reconnect refresh |
| Matchmaking | Request pending; accepted search; no opponent; long wait; minimize/restore; cancellation pending/rejected; pairing wins cancellation race |
| Invitations | Copy success/failure; invite opened before login; invalid code; full/private/started/expired room; existing membership when opening another invite |
| Room membership | Join pending; joined; peer joins/leaves; bot provision pending/failure; host transfer; kick; spectator joins/leaves; room closure |
| Readiness | Ready/unready pending; peer ready; readiness reset after disconnect or seat change; bot permanently ready; both ready |
| Game start | Reservation/starting; debit/start failure; waiting-room retry; direct Bot Challenge; color assignment; rematch entry; spectators carried into play |
| Board interaction | Hover; select; deselect; valid targets; compulsory capture guidance; drag; valid drop; invalid drop; tap outside; keyboard selection |
| Move delivery | Send pending; accepted; invalid/stale rejection; duplicate acknowledgement; reply lost; connection lost before/after acceptance |
| Board motion | Ordinary slide; capture; multi-capture continuation; promotion; promotion plus capture; terminal move; fast consecutive bot moves |
| Clocks | Initial grace; turn reset; ordinary tick; low-time threshold; timeout; unlimited mode; reconnect near deadline; background-tab return |
| Draw/resignation | Open/close confirmation; offer pending; offer received; accept/decline pending; cooldown; game ends while dialog open; request rejected |
| Results | Win/loss/draw reason; result details pending/available/failed; rewards update; rematch request/wait/start/failure; dismiss; automatic expiry |
| Spectating | Join waiting room; join active game; first board; live motion; flip during motion; recovery after room deletion; finished game; leave |
| Navigation/panels | Minimize/restore room or search; tab change; panel open/close; focus return; game starts behind an open panel; terminal result overrides obsolete dialog |
| Chat/notifications | Initial history; pagination; send pending/sent/failed; deduplication; unread/mentions; channel switch; reconnect history; notice dismissal |
| Replay | Request loading/failure; stale request completion; next/previous/seek; interrupted animation; close; return to origin context |
| Disruption/accessibility | Offline; reconnect; new server epoch; replaced tab; reduced motion; resize/orientation; hidden tab; keyboard/focus; component disposal |

## Modal and feedback priority

Proposed precedence: replaced/authentication failure > terminal result or recovery notice > still-valid draw/resign decision > optional panels. A lower-priority panel may remain open as a preference, but it must not obscure required feedback, keep focus behind an overlay, or intercept gameplay input after its context changes.

A terminal snapshot invalidates a resignation dialog immediately. Recovery disables gameplay actions immediately while keeping the last board visible. The presentation controller may finish a bounded winning-move animation before revealing the result, but no old confirmation remains actionable during it.

## Snapshot differences cannot explain every cause

Comparing two snapshots is sufficient for board motion when the intervening move is present. It is not sufficient to infer why a player went from a room to idle. Voluntary leave, kick, expiry and room closure can have the same resulting state.

For those cases, define bounded server-authored transition/notice metadata in the snapshot: a stable notice ID, context, reason code and occurrence time. It must survive reconnect long enough to explain the relevant outcome. The client deduplicates presentation by notice ID. Do not restore a parallel stream of imperative screen-changing events, and never require acknowledgement of an animation to advance gameplay.

Other facts belong in their owning snapshot: participant names, opponent type, permitted actions, server deadlines, result-detail status and persisted replay ID. Derive visual labels from those facts; do not reproduce bot eligibility, wager or result-settlement rules inside canvas or transport code.

## Implementation order

1. Close correctness/feedback gaps: pending/rejected actions, obsolete modal invalidation, recoverable reasons, correct replay identity and explicit result status.
2. Define the composed presentation model and small transition catalog, including permissions and overlay priority.
3. Implement one cancellation-safe animation controller, with reduced motion and bounded catch-up.
4. Add board and screen animations through that controller, including complete capture/promotion/result sequences.
5. Verify interruptions across the journey. Protocol unit tests are necessary but cannot replace browser tests of frame progression, focus, pointer handling and stale overlays.

Completion means every relevant row has behavior and verification, not merely that the normal two-player move animates successfully. The broader persistence/restart and reward-settlement audit also remains distinct from presentation work; passing motion tests must not be described as proving those guarantees.

## Result lifecycle checkpoint - 11 September 2026

Finished-result membership, dismissal, original expiry deadlines and rematch consent now use persisted domain transitions. Terminal/source-room handoff, navigation release, reconnect before the first snapshot, bot rematches, retained spectators and startup restoration have local integration coverage. Delayed room hydration cannot restore a dismissed spectator, and shutdown drains settlement after a result runtime retires. See [result-lifecycle.md](result-lifecycle.md) for the contract, test scope and owner acceptance checks. This closes the implementation gap for result/rematch restoration; it does not establish that every presentation scenario above or Railway replacement has been accepted.
