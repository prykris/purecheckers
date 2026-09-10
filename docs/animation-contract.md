# Gameplay and animation transitions

Status: the board presentation controller now implements adjacent move slides, capture fade/shrink, promotion glow, ordered result reveal, bounded queuing and interruption. Screen entrances and room-status highlights below remain proposed. Automated lifecycle tests pass; the user is handling visual acceptance testing.

See player-experience-audit.md for the wider lifecycle inventory, concrete feedback gaps and implementation priorities.

## Ownership

The server owns room membership, readiness, board position, capture chains, clocks and results. A snapshot commits immediately in the session store. The frontend owns selection, dragging, animation progress and the visual timing of result panels. Animation completion never sends a gameplay command or changes authoritative state.

A snapshot is a state, not an absence of transitions. The pair of consecutive accepted snapshots describes a transition. Presentation observes that pair; it does not reconstruct authority from animation events.

## Gameplay graph

These are logical states, including room status and game-over status nested within the session phase. Bot Challenge may cross the room states so quickly that the client never displays them. Presentation must work from the snapshots it actually receives.

~~~mermaid
stateDiagram-v2
    [*] --> Lobby: authoritative idle snapshot
    Lobby --> Searching: matchmaking accepted
    Searching --> Lobby: cancel or disconnected search
    Searching --> WaitingRoom: paired
    Lobby --> WaitingRoom: create or join accepted
    WaitingRoom --> Starting: both players ready
    Starting --> Playing: game created
    Starting --> WaitingRoom: start failed
    WaitingRoom --> Lobby: leave, kick or room expiry
    Lobby --> Playing: bot challenge succeeds
    Searching --> Playing: intermediate room not observed
    Playing --> Playing: move / capture / promotion / turn change
    Playing --> Result: terminal snapshot
    Result --> Playing: rematch accepted
    Result --> Lobby: dismiss or result expiry
    Lobby --> SpectatingRoom: spectate accepted
    SpectatingRoom --> SpectatingGame: game starts
    Lobby --> SpectatingGame: join an active game as spectator
    SpectatingGame --> SpectatingResult: terminal snapshot
    SpectatingRoom --> Lobby: leave or room closes
    SpectatingGame --> Lobby: leave
    SpectatingResult --> Lobby: leave or result expiry
~~~

Connection status is independent of this graph. Disconnecting disables commands and marks recovery in progress; it does not fabricate a lobby transition. On recovery, the returned snapshot determines the real phase, including any game end or room expiry that happened while away.

## Presentation graph

~~~mermaid
stateDiagram-v2
    [*] --> Settled: initial snapshot, render directly
    Settled --> Entering: observed normal screen transition
    Entering --> Settled: entrance completes
    Settled --> Moving: adjacent accepted move
    Moving --> CaptureEffect: captured pieces
    Moving --> PromotionEffect: promotion without capture
    CaptureEffect --> PromotionEffect: capture also promotes
    Moving --> Settled: ordinary move complete
    CaptureEffect --> Settled: capture complete
    PromotionEffect --> Settled: promotion complete
    Moving --> ResultReveal: winning move complete
    CaptureEffect --> ResultReveal: winning capture complete
    PromotionEffect --> ResultReveal: winning promotion complete
    Settled --> ResultReveal: resignation, timeout or agreed draw
    ResultReveal --> Settled: result panel visible
    Entering --> Snap: recovery or incompatible newer snapshot
    Moving --> Snap: recovery, missing history or backlog limit
    CaptureEffect --> Snap: recovery or backlog limit
    PromotionEffect --> Snap: recovery or backlog limit
    ResultReveal --> Snap: recovery or context replacement
    Settled --> Snap: corrected or nonadjacent state
    Snap --> Settled: cancel visual work and render latest snapshot
~~~

These are visual states only. For example, while a winning capture is animating, the authoritative game is already over and input is disabled. ResultReveal delays only the panel's appearance, not result acceptance or server cleanup.

## Animation matrix

Durations below are initial design values, centralized as presentation configuration rather than scattered component timers.

| Observed change | Presentation | Duration | Input |
| --- | --- | --- | --- |
| Lobby to search or room | Fade and slight vertical movement of the incoming panel | 180 ms | Derived from latest session and pending command |
| Ready or member status changes | Highlight the changed status; preserve layout | 150 ms | Server permissions remain authoritative |
| Room/search/lobby to a newly started game | Board entrance and brief color/turn cue | 350 ms | Board waits for its bounded entrance; server clock continues |
| Acknowledgement pending | Confirming indicator; selection feedback | Until acknowledged/recovered | No second gameplay command; no speculative board move |
| Adjacent accepted ordinary move | Slide the piece between squares | 220 ms | Board selection resumes when presentation catches up |
| Accepted capture | Slide, then fade/shrink captured pieces | 220 + 100 ms | Same rule; chain permission comes from latest snapshot |
| Accepted promotion | Slide/capture first, then crown glow | Additional 120 ms | Same rule |
| Capture-chain continuation | Animate each observed adjacent step | Same per-step durations | Never infer that a chain has finished from animation completion |
| Turn change | Crossfade active-player indicator | 120 ms | Current player is read from latest snapshot immediately |
| Winning move | Finish the bounded move/capture/promotion presentation, then reveal result | Result fade 180 ms | Disabled immediately on terminal snapshot |
| Resignation, timeout or agreed draw | Reveal result directly; no invented board movement | 180 ms | Disabled immediately |
| Game/result to lobby | Incoming lobby fade | 180 ms | No outgoing component may retain actionable controls |
| Spectating an existing game | Render the current board directly | None | Spectator permissions remain unchanged |
| Clock-only snapshot | Update clock text/bar, without restarting board animation | None on the board | Unchanged |
| Command rejection | Show reason, clear pending feedback; retain accepted board | Optional 120 ms feedback | Latest snapshot decides |
| Reconnect, initial load, changed server or missing history | Cancel presentation and render latest snapshot | None | Enabled only after synchronization |
| Reduced motion | Immediate board/state changes; optional subtle opacity feedback | 0–80 ms | Same permissions |

## Interruption and ordering rules

1. Accept and validate the server snapshot before planning presentation. Never delay the authoritative store behind a visual queue.
2. Compare game identity and move-history length, not only snapshot sequence: clock snapshots also advance sequence.
3. A duplicate, rejected or stale packet produces no new visual transition. A new clock snapshot updates clocks without canceling a move.
4. Animate a move only when its predecessor is available and the history extends by exactly one step. Initial load, recovery and missing history snap to the newest board.
5. Keep any visual queue bounded: at most two pending move targets and 600 ms of estimated remaining board animation. Beyond either limit, cancel and snap. This avoids long replay backlogs after a background-tab pause or rapid bot capture chain.
6. Pending targets contain immutable accepted snapshots. The renderer must not call makeMove to determine the live board or change the session store when an animation completes.
7. A terminal move is eligible for animation. A duplicate terminal/result-persistence snapshot must not restart it. New rewards update the visible result data independently.
8. Disconnect, a different game/server, component disposal or reduced-motion activation cancels scheduled frames and queued targets. Cancellation renders current authority and clears visual input locks.
9. Every scheduled callback belongs to a presentation generation. A callback from a canceled generation cannot touch the new screen or clear its current animation.
10. CSS/canvas animations have a bounded completion path. Correctness must not depend on receiving animationend, a sound ending, or the tab continuing to render frames.
11. Commands include the latest authoritative game ID and expected ply. A visually older board never authorizes a move; board input remains disabled until it catches up.

## Implementation boundaries

- server/domain: gameplay decisions and lifecycle rules; no animation timings or UI acknowledgement requirements.
- src/lib/sessionClient.js: transport recovery and snapshot acceptance; no visual queue or gameplay rules.
- Pure presentation planner: compares accepted snapshots and classifies screen, move, capture, promotion and result changes.
- Presentation controller: owns cancellation, bounded ordering and reduced motion. It exposes visual progress and completion, never writable session state.
- BoardView and screen components: render the plan. They do not independently interpret socket events or accumulate recovery patches.

`gamePresentation.js` classifies accepted changes and defines the timing values. `boardPresentation.js` owns the frame loop, bounded queue, deadline and generation cancellation. `GameBoard.svelte` supplies connection, visibility, orientation and reduced-motion inputs. `BoardView.svelte` renders each supplied frame without scheduling gameplay or animation work. Player and spectator result panels wait for visual settlement, while authority and clocks update immediately.

Implemented board timings are 260 ms movement, 120 ms capture removal, 160 ms promotion and 180 ms result reveal. The matrix above retains proposed timings for future screen work. Resize redraws the current frame in board coordinates without restarting its timeline. Orientation changes cancel presentation. No component-specific recovery animation queue remains.

## Required verification

Test ordinary and terminal moves, captures, capture chains, promotion, clock snapshots during animation, duplicate result snapshots, rapid arrivals beyond the queue bound, rejection, game replacement, disconnect/reconnect during every visual stage, tab suspension, reduced motion and disposal. Assert both that the displayed board converges to the newest snapshot and that no visual callback mutates authoritative state. Verify frame progression and cancellation in a real browser in addition to testing the pure planner.
