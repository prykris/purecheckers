# Player experience and transition audit

Scope: source inspection of the gameplay journey, supporting room/lobby UI, recovery, spectator views, results and replay. This is an implementation inventory and proposed contract, not a claim that every scenario has been reproduced in a browser or fixed. Shop, treasury and account-management workflows need their own inventories before claiming full-app coverage.

The animation contract in animation-contract.md covers motion. This audit extends it to what the player can do, what feedback they receive, why a transition occurred, and what happens if it is interrupted.

Update, September 10: navigation now has one controller and a SvelteKit history adapter (see navigation-contract.md). The room banner remains visible until acknowledged departure; replay loading is generation-scoped and exposes errors. These address the original banner and obsolete replay-completion findings below. Board movement/capture/promotion/result sequencing is implemented with automated lifecycle coverage. Other findings below, including replay identifier correctness, remain open.

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
