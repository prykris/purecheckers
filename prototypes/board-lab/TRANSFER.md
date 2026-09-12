# Approved board interface: transfer contract

This committed prototype is the visual and interaction reference. Production
must use existing theme variables and equipped piece skins; its warm sample
palette is not a new product theme. Keep this reference runnable independently.

## Preserve
- Square canvas fills available width in portrait. Collapse supplementary UI before reducing it.
- Players and board form one visual group. In landscape, players form a narrow left rail; the board uses available height.
- Finished games become contextual replays at the exact final position after the final animation.
- Landscape results live in the right column, without consuming board height.
- Chat stays inline when space allows. Only collapsed chat gets a drawer shortcut; no redundant Conversation heading.
- Horizontal move history with accessible details. Ratings remain in history; board rating popups default off.
- A settled opponent-to-player handoff glows once, then retains a visible turn label and clock cue. No repeat on capture continuations or closing drawers.
- Focus mode stays inside the app viewport, preserves a square board, and retains turn, timer and exit controls. Button, Escape and two-finger tap toggle it.
- A second touch cancels dragging. Movement, long holds, cancellations and additional contacts cannot submit a move or toggle Focus.
- All interactions respect reduced motion and have button/keyboard alternatives.
- Player names open the existing contextual profile surface.
- Spectator identity, presence and reactions remain distinct from participant permissions; no invented production data.

## Preserve from production
Server authority, command validation and pending states; reconnect/recovery;
colour reveal; actual clocks; equipped skins/themes/emotes; owned-item rules;
chat history/unread/mentions; draw negotiation; result persistence errors;
rematch eligibility; sharing; guest upgrade; spectator permissions; saved replay
links and accessible board controls. No local demo opponent, simulated clocks,
fake profiles or cycling rating values may enter production.

## Boundaries
Layout allocates square space; BoardView paints and collects input intents;
BoardPresentation animates accepted positions; session/commands own authority.
Replay navigation changes presentation only. One shared responsive table layout
must serve player, spectator and replay contexts rather than parallel copies.

## Review matrix
Portrait 320x568 and 390x844; landscape 667x375 and 844x390; desktop resize
and reload; active turn and capture chain; Focus/exit at each size; final move
into replay; replay seek and play/pause; real clock and disconnect/recovery;
draw/resign/rematch; chat during typing and layout changes; profiles; spectator
join/leave/reactions; alternate equipped theme/skin; reduced motion.
