# Board table transfer — 12 September 2026

The approved, disconnected prototype is preserved in commit `a426239` under
`prototypes/board-lab`. Run `npm run dev:board-lab` to compare it with the app.
Its [transfer contract](../prototypes/board-lab/TRANSFER.md) records the details
that must survive future work. The app uses existing theme variables and
server-confirmed equipped skins, not the prototype's sample palette.

## Component boundaries

- `TableLayout` and `tableLayout` allocate square space and own responsive
  collapse, the player rail, chat visibility and contained Focus mode.
- `BoardView` paints the canvas and emits input intents. It receives its edge
  length from its owner. `canvasPiece` is the shared painter for stationary,
  moving, captured and dragged pieces. Renderer changes do not require edits
  to the page or table layout.
- `GameBoard` connects the canvas to `BoardPresentation`, which animates only
  accepted positions, preserves capture chains and snaps on recovery.
- `ReplayBoard` validates and reconstructs history through the same game engine,
  then uses `GameBoard` for display. Seeking changes presentation only. It also
  exposes the same replay controls to the finished table; public replay pages
  retain their server-rendered metadata, player links and accessible board.
- `GameScreen` receives the accepted game view from the app boundary. It keeps
  existing commands, reveal/recovery/draw dialogs and chat/emote clients.
  Spectators use that same screen with viewer permissions. Passing the view
  avoids reading a cleared global game store during leave/rematch teardown.
- `GameResult` owns the existing result-action matrix and supplies summary and
  actions to the table. Finished viewers keep their session, chat and presence;
  opening replay does not navigate to a separate public page.

Board settings persist independently of gameplay authority. Rating popups
start disabled. Ratings display actual analysis events tagged with their
recorded ply; missing analysis remains unknown, including after a reload.
The settled turn cue does not repeat on clock updates or capture continuations.
Spectator identity/count come from one server projection. Reactions use owned
catalogue items and revalidate membership, connection, runtime and terminal
state after asynchronous inventory reads.

## Verification

- Production Linux build succeeds, including Prisma generation and Svelte SSR.
- The Linux suite passed 1,165 of 1,167 tests before the final spectator-result
  regression was added. The two failures are the pre-existing source-certificate
  hashes in `strategyDiagrams.test.js`. The engine is unchanged from checkpoint
  `a426239`: SHA-256 `5a86af73f0572f64da9046612c76185bf55bab90fd337746e1d4544d50855eeb`
  (LF source); the certificates expect `a1cc65c301ea57fa9c59cc94b4da8f901e47faebbc61e5269247a0a2c7128893`.
  Certificates were not rewritten to suppress the failure.
- All 82 focused tests across six files pass on Windows and Linux. They cover result actions, spectator permissions, replay validation,
  sequential capture animations, recovery, turn cues, geometry and multi-touch
  cancellation. Socket tests check roster changes and canonical emote delivery.
- Browser checks on a real local bot game cover a bot-first start, moves and
  replies, portrait/landscape layouts, identical chat input/draft after resize,
  contained Focus with real turn/clock, resignation, replay to the exact final
  position, play again and leaving the old game without runtime errors.
- Synthetic pointer checks in the connected browser verify two-finger entry/
  exit, movement/cancellation suppression, unchanged board state and drag
  submission. Pointer capture was stubbed only for these synthetic events.
  Physical-phone gestures and the virtual keyboard still need device testing.

Local evidence is in `.generated/board-transfer-*`. Linux verification used
separate temporary containers and a private test database. Nothing was deployed.

## Responsive layout refinement

`tableLayout` gives landscape priority whenever width exceeds 1.2 times height,
including on desktop. This preserves the approved vertical player rail and
full-height board. Nearly square desktop windows (at least 900 × 650 CSS
pixels) use full player rows only when the sidebar fits without shrinking the board
relative to the centered vertical layout; otherwise they stay stacked. Tall
tablets also retain the centered vertical table.
The play-zone hugs the canvas frame plus the player rail where applicable.

Finished games use a dedicated result layout within the shared table. Replay
controls sit directly beneath the board at the same width in every layout.
There is no room-chat composer or chat shortcut in this view. Spectator counts,
reactions and contextual result actions remain available. Results and actions
sit beside the player in landscape, or above/below it in portrait. Only the
actions region scrolls if its content exceeds the available space.

The live-to-result handoff uses a named board View Transition after the
presentation controller settles the terminal snapshot. It changes presentation
only; server authority and action gating remain immediate. Opening an already
finished game, disabled animations, reduced motion and hidden tabs skip it.
Browsers without View Transitions still render results immediately. Component
teardown skips an in-flight transition and prevents a late presentation update.

Initial refinement checks: 87 focused tests passed; browser measurements cover 390 × 844,
844 × 390, 768 × 900 and 1152 × 720 CSS pixels. Both desktop player rows measure
56px with identical padding, the group and frame widths match, and no document
horizontal overflow occurs. A real bot-game resignation completed the named
transition from the live board to the final replay board without console errors.

Replay-layout correction: 74 focused geometry/presentation/result tests pass,
and the Vite production build succeeds. Browser checks confirmed the 84px
player rail and full-height live board at 1440 × 900, playback controls attached
below the board at desktop and 844 × 390 landscape sizes, and no replay chat
composer. The reported 833 × 980 result layout now separates actions from
the board and playback controls.

Sidebar breakpoint regression: 24 layout/presentation tests pass. Tall windows
at 900 × 980, 908 × 982 and 980 × 1100 remain stacked. Width sweeps check that
the first switch from stacked to desktop never reduces the board size.

Outcome artwork is a decorative SVG component supplied by GameResult through
the table decoration slot. It consumes the existing participant result; spectators
receive a neutral winner motif, not a personal victory/defeat. It has no input
handlers, is hidden from assistive technology, and only renders visibly in the
side-by-side result area. Theme variables control its color. Sidebar content uses
a shared 520px maximum width (500px for the composer inside 10px gutters).
Browser measurements confirmed all four live sidebar regions share one center.
The production build and 41 focused result/layout tests pass after this polish.
