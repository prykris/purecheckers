# Temporary mobile board lab
Run from repository root: `node prototypes/board-lab/serve.mjs`
Open http://localhost:5182 . Stop the terminal process to close it.

This folder is git-ignored. No production routes, login, API, sockets, database, storage or deployment changes. It reuses the real rules, board presentation controller, canvas piece painter, notation and modal action. PreviewBoard is a temporary copy of BoardView with isolated DPI, hints and pointer tweaks; all other production components are untouched.

Moves follow real rules; Emma replies locally using the first legal move. Ratings cycle through labelled samples: they are NOT engine evaluations. Timers, profiles, chat, draw offers and reactions are simulated. Settings last only until refresh. Audio is local Web Audio and only plays after enabling it. The Settings sheet contains feedback/capture/crown demos and reset.

## Conversation layout revision
The board uses nearly the full phone width at ordinary portrait sizes. Recent chat and an inline composer share the screen with the board; short screens reserve one readable chat line. Clocks use small SVG countdown rings. Hover or tap the eye icon in the conversation header to inspect Nora and Leo, open their sample profiles, and send a simulated spectator reaction. The lab toolbar switches player/spectator perspective. Spectator reactions originate at the eye, rise and fade; reduced motion keeps them near the icon, and reaction effects are bounded and cleared after use. All of this remains local sample behavior.


## Persistent table and responsive replay revision
Finish through Resign, an accepted draw, or Settings > Preview win/loss/draw.
After the final animation, the same board opens at its final position with replay
controls. Frames are recorded from actual local legal moves, including individual
capture jumps and custom demonstration positions. Seeking never mutates the live
game. Autoplay is cancellable and stops at the final frame.

Chat and the mutable spectator roster belong to the table, so neither is reset
on finish, replay seeking or role switching. Player results use personal wording
and Play again; spectator results name the winner and offer Leave table. The eye
popover includes a Leo leaves/returns simulation. This is a local UX demonstration,
not multi-client presence synchronization. Share replay copies a local demo link,
not a persisted or production replay.

Portrait layout uses a square board with only 3px of frame at each edge. Available
space around that square selects a roomy conversation, compact message preview,
or a focused board with secondary features in the table drawer. Landscape moves
controls and conversation beside a board sized to the available height. Document
scrolling stays disabled; chat, move trays and sheets own their scroll areas.


## Grouped play zone
The two player rails and board share one warm, outlined surface; history, chat,
and actions sit outside it on the darker table background. Landscape keeps the
same grouping. The board still uses the available portrait width. Move-rating
popups start off; Settings can enable them, while history retains rating details.
Explicit rating sample buttons remain available for previewing effects.

Design note: the local UX reference search did not return guidance specific to
visual grouping. The shared surface, connected edges and background separation
are design judgment for this prototype rather than a verified reference match.


## Turn handoff cue
Your player strip glows once for 1.8 seconds after a black-to-red turn handoff
has finished animating. A gold edge, avatar ring, brighter clock and dotted
Your turn label remain while it is your turn. This is independent of optional
move-rating popups. Reset, spectator view, replay and capture continuations do
not announce a new personal turn; opening or closing sheets does not retrigger
it. Reduced motion or disabled animations retain only the steady indicator.
Settings > Try turn change starts a legal local opponent move to preview the cue.


## Landscape replay details
In landscape, finished-game results join the right-hand column above the replay
controls; they no longer consume board height. Portrait keeps the result above
the board. Visible chat has no redundant Conversation heading or drawer button.
The compact layout retains its message-preview button because inline messages
and the composer are hidden there. Manual Focus mode is now available through the expand control and a two-finger tap.


## Landscape player rail
During play, both players stack vertically in an 84px rail attached to the left
of the board. Names, profiles, captures, clocks and the personal turn cue stay
with that rail. Board sizing reserves width for the rail and supporting controls
rather than subtracting player-row heights. Portrait still uses player rows
above and below the board. Finished landscape results stay in the right column.


## Distraction-free mode
The header expand button and a stationary two-finger board tap toggle Focus.
It stays inside the current app/preview viewport; it does not request browser
fullscreen or expand the simulated phone frame. The board is square and sized
to the available width/height, reserving a compact turn/timer/exit strip below
it in portrait or beside it in landscape. Clocks remain simulated like the rest
of this local demo. Replay Focus includes play/pause and the current position.
Escape, the collapse control, or a second two-finger tap restores the layout.
Finishing a live game restores the contextual result screen automatically.

A second touch cancels the current drag and consumes both releases. The gesture
requires two contacts within 180ms, less than 10px movement, and release within
450ms. Third contacts, movement, long holds and cancellations cannot toggle or
submit a game move. The existing touch-action behavior on the canvas remains.
The local check-focus.mjs uses real Chrome DevTools touch events to check this
integration. Run a dedicated headless Chrome on port 9337 with its temporary
profile outside the watched project, then run that script; it closes only that
separate browser. The old in-project test-profile path is excluded from watching.
