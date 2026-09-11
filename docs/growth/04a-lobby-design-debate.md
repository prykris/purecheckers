# 04a. Lobby design debate: first session and play someone nearby

Ruling on the four proposals, three skeptic passes and four revisions that answered the brief in `04a-lobby-design-brief.md`. Written 10 September 2026 from the debate transcript and source inspection of `src/lib/components/Lobby.svelte`, `lobby/*.svelte`, `SearchScreen.svelte`, `GameScreen.svelte`, `RoomBanner.svelte`, `server/domain/{rooms,roomRules,games,sessions,sessionCommands,snapshots}.js`, `server/socket/{index,presenceHandler}.js` and `src/routes/(app)/+layout.svelte`. Nothing here has been reproduced in a browser.

## Summary

The scannable code is drawn on exactly one screen, the host's waiting room, because that is the only place the snapshot says a room exists. The lobby gets one labelled door to it, "Play Someone Nearby", as the second of two full-width buttons on Quick Play. The scanner taps nothing inside the app: the layout creates a guest, joins by code, and a server-owned `autoReady` room setting starts the game inside the join. The lobby header loses four things and gains none. The game-over screen becomes a result state with a measured sheet instead of a stack on the board. Every next action from a finished game is one accepted command because the dispatcher treats a finished game as idle. Three scan surfaces, one welcome card with a Skip, no header icon, no tour, no word QR in visible copy, every count real.

Winner: the engineer's structure, with the simplicity persona's lobby and waiting room and the growth persona's naming and invite pre-check grafted on. Ranking out of 25: engineer 21, simplicity 20, growth 19, player 18.

## What the owner fixed in advance

| Constraint | How the final design honours it |
| --- | --- |
| Three tabs stay | Quick Play, Rooms, Bot unchanged in count and label; only the typography is reset so "Quick Play" fits a 109 px tab at 360 px |
| First visit lands on Bot, one bubble plus Skip, extendable | One card in normal flow on the Bot tab, "Skip to Quick Play" inside it; `src/lib/hints.js` seen-set with an ordered sequence |
| Find Opponent stays, fallback inside the search, server deadline | `matchmaking.fallbackOpen` in the snapshot, republished by a server timer; "Play a bot instead" sends `bot:play` from the matchmaking phase |
| Scan is zero taps, auto-ready, wheel, register offer after | `room.settings.autoReady`, `room:join` calls `startRoomGame`, auto-guest in the layout, "Save account" on the result sheet |
| Friendly surfacing, not many QR codes | Three surfaces: one button, one screen with the image, one result-sheet button |
| 360 px first | Every screen measured at 360 x 560 (Chrome with URL bar) |
| Sleek, not crowded, redesign the base if it does not fit | Header, Quick Play, waiting room and game over are rebuilt by subtraction; nothing is added to the header or tab row |

## The four proposals

| Persona | Two lines |
| --- | --- |
| Simplicity | "Invite a friend" is the one door; one-row header, tab row retyped, welcome card in flow, code-first waiting room with a fixed top bar. Post-game stack lives inside the board overlay; `game:next` and `matchmaking:play-bot` commands. |
| Growth | "Play Someone Nearby" primary in Quick Play; "Scan to play Chris" waiting screen; invite pre-check before guest creation; deferred token swap so registering never unmounts the board. Keeps the theme icon and a caret bubble under the tabs; uses the word QR. |
| Player | "Challenge a Friend" with emphasis following presence; wake lock, sticky readiness, plain card, in-board bottom sheet. Create Account leaves the game; keeps robot, heading, theme icon. |
| Engineer | `instantStart` room flag, canStartRoom relaxation, dispatcher finished-game rule, server republish at the deadline, result state that removes bars and shrinks the board, socket identity keyed on user id. Keeps a two-line user row. |

## What the attacks killed

| Idea | Killed by | Why |
| --- | --- | --- |
| Header QR icon with a one-time expand animation | All four personas | Unlabelled glyph reads as "scan something"; tapping it must send `room:create`, a hidden duplicate; an explaining animation is a tour |
| Post-game actions in the row under the board | Visual and user skeptics | `BoardView` leaves 200 px of chrome on a 360 x 640 phone and `.actions` still holds Chat and emotes; nothing new fits |
| Vertical stack inside the 344 px board overlay | Visual skeptic | Seven rows fit only at 307 px with a compact rule; dense, not redesigned |
| Inline registration form at game over | User and engineering skeptics | Soft keyboard covers the board; the 60 s cleanup in `persistResult` tears down `GameScreen` mid-form; a token swap rebuilt the socket |
| Room code string on the waiting room | User skeptic | Nothing in the app accepts a typed code; `RoomList.svelte` declares `joinCode` and never renders it |
| `$user.gamesPlayed` as the in-session first-visit trigger | Engineering skeptic | `Lobby` stays mounted under `GameScreen`, so the value never refreshes; the hint is dismissed on the first in-game snapshot instead |
| Client-side "searching minus one" on the lobby | Engineering skeptic | The viewer is idle and not in that count; subtract only on the search screen |
| Fallback deadline as a static snapshot field | Engineering skeptic | No snapshot ticks during matchmaking; a server timer republishes at the deadline |
| Relaxing `bot:play` and `room:create` to in-game with per-action guards | Engineering skeptic | Guards inside three actions; replaced by one dispatcher rule |
| "Keep searching" and "Show me" buttons | Visual skeptics | Doing nothing already keeps searching; "Show me" duplicated the tab |
| Two-line user row at 8.6 px, pulsing dot next to "1" | Visual and user skeptics | Below legibility; a fake activity signal |
| Difficulty pills on the search fallback | Visual skeptic | Six controls for a two-way decision; difficulty is chosen on the Bot tab |
| "Challenge a Friend" and "Play a Friend" labels | User skeptics | Sit above a bottom-nav tab called Friends whose screen has no challenge action |

## The final design

### Lobby at 360 px, first visit

Guest, `gamesPlayed = 0`, hint `welcome-bot` unseen, viewport 360 x 560. Top to bottom:

```
 8   safe area
44   Pure Checkers                              Swift Fox 42   (dim text, not a control)
 8
44   Quick Play    |    Rooms    |    Bot                       (Bot active, title case, fs-body 600)
 8
112  +------------------------------------------------------+
     | Your first game is against a bot, so nobody has to   |
     | wait. Real people, and the friend next to you, are   |
     | under Quick Play.                [Skip to Quick Play]|   (44 px tap target)
     +------------------------------------------------------+
16
40   ( Easy )   ( Medium )   ( Hard )                          (Medium selected, labelled chips)
12
52   [                      Play                          ]    (btn-primary, full width)
     air (about 160 px)
56   Play | Treasury | Shop | Friends | Profile                (unchanged)
```

Removed from today's `Lobby.svelte`: the pulsing presence pill (it counts the viewer), the sun icon and its nine-chip theme picker (now an Appearance card on Profile), and the second row with ELO, coins and "N searching". Removed from `BotPlay.svelte`: the 64 px robot icon and the "Play vs Bot" heading; the active tab is the heading. Nothing added to the header or tab row. Interactive elements above the nav: 8 (today 9).

### Lobby at 360 px, returning player

Quick Play active, no card. Fixed order; only the colour follows the live count.

```
44   Pure Checkers                                    Chris
44   Quick Play    |    Rooms    |    Bot
24   Your rating 1240                                          (guest: Guest · unrated)
16
52   [                  Find Opponent                     ]    (matchmaking:join)
18     Nobody else is online right now                         (or: 3 online · 1 searching)
16
52   [               Play Someone Nearby                  ]    (room:create, autoReady defaults)
36     They scan your screen, or you send a link.
       No account needed.
24
     Recent games                                              (GameLog, bot games tagged "vs bot")
```

When `presenceStats.searching === 0`, Play Someone Nearby is red and Find Opponent is dark; otherwise the colours swap. While the session is minimized in a search or a room, the action area of every tab is replaced by one line and one button: "You're searching for an opponent [Open search]" or "Your room is open [Open room]"; the Bot tab while searching offers chips and "Play the bot instead". No button the session cannot accept is ever shown.

### Scan surfaces

| # | Where | Trigger | Label |
| --- | --- | --- | --- |
| 1 | Quick Play, second button (`lobby/QuickPlay.svelte`) | Always while idle | Play Someone Nearby, caption "They scan your screen, or you send a link. No account needed." |
| 2 | Waiting room, host projection (`lobby/RoomWaiting.svelte`), the only screen with the image | In-room, `settings.autoReady`, host alone | "Scan to play Chris", 200 px image, camera caption, Share link |
| 3 | Result sheet (`GameResult.svelte`) | `game.origin` is `bot`, or `quickplay` for registered players | Play Someone Nearby |
| not counted | `RoomBanner.svelte` pill | Room minimized, host alone | "Waiting for a friend" (copy change only) |
| not counted | Welcome card | First visit | "…and the friend next to you, are under Quick Play." |

Total: 3.

### Onboarding

One card, in flow, no pointer, no overlay, no animation. Copy: "Your first game is against a bot, so nobody has to wait. Real people, and the friend next to you, are under Quick Play." One control inside it, bottom-right, 44 px: "Skip to Quick Play", which dismisses the card and switches the tab. Also dismissed by tapping the Quick Play tab and by the first in-game snapshot of any kind (`hints.js` subscribes to the session phase, which covers the scanned guest whose lobby mounted with `gamesPlayed = 0`). Hidden while an error or notice bar is showing. Mechanism: `src/lib/hints.js` (seen ids in `localStorage.checkers_hints`, `seen`, `dismiss`, `dismissAll(sequence)`) and `src/lib/components/Hint.svelte`. Later steps append ids to an ordered sequence; a `User.hintsSeen` column can mirror the set without changing the component API.

### Search fallback

Server-owned and server-delivered. `matchmaking:join` stores `matchmakingJoinedAt` and `matchmakingFallbackAt` on the session (`joinedAt + MATCHMAKING_BOT_FALLBACK_MS`, 20000, or `joinedAt` when `getStats().online <= 1`) and arms a timer that re-checks the phase and calls `publishUser` at the deadline; `clearContext()` cancels it. `snapshots.js` publishes `matchmaking: { joinedAt, botFallbackAt, fallbackOpen }`, which also fixes `joinedAt` being regenerated on every serialization.

| State | Screen |
| --- | --- |
| `fallbackOpen` false | Spinner; "Looking for an opponent…"; "Nobody else is searching" or "1 other searching" (`searching` minus self); Minimize, Cancel |
| `fallbackOpen` true (same screen, first render on an empty server) | "No one's searching right now"; inline spinner line "Still in the queue. A match starts on its own if someone shows up."; primary "Play a bot instead · Medium"; Minimize, Cancel |

"Play a bot instead" sends `bot:play`, now permitted in `['idle', 'matchmaking']`; the action awaits prisma first, then removes the pool entry and clears the timer, and force-idles on failure so no session is stranded. No Keep waiting button, no auto-start, no difficulty pills.

### Game over

`GameScreen.svelte` enters a result state: the player bars, status line, Resign/Draw/Chat row and move strip are not rendered, the canvas scales down (non-interactive at game over), the in-board overlay is removed, and `GameResult.svelte` sits at the bottom as a sheet. At 360 x 560 the sheet is 236 px (288 with the conditional third button) and the board keeps 300 px (248); at 640 the board keeps its 344 px. Desktop puts the sheet in the right column.

| Case (`game.origin`, guest?) | Rows |
| --- | --- |
| Bot | Verdict + reason; "vs Marge · Friendly · no rating change"; [Play again] (`bot:play`); [Play Someone Nearby] (`room:create`); [Find Opponent · 1 searching] only when searching > 0 (`matchmaking:join`); Lobby, guests also Save account |
| Quick play, registered | Verdict; stakes line or ELO rows; [Rematch] with labels Waiting for Chris… / Accept rematch / Chris left from `rematchRequests` and `opponentLeft`; [Play Someone Nearby]; [Find Opponent · N] when N > 0; Lobby · Chat |
| Room (scanned friend and host) | [Rematch]; host: Lobby · Chat; guest: [Save account / Keep Bold Owl 7 and your games] then Lobby · Chat. No Play Someone Nearby, the friend is there |

Every button from a finished game is one accepted command: the dispatcher accepts a command permitted in idle from a finished game, force-idles, then runs it. `UpgradeSheet.svelte` is mounted at layout level so it survives the cleanup; the socket identity is keyed on the user id so an in-place upgrade keeps the connection. The cleanup timer becomes `GAME_OVER_LINGER_MS = 180000`.

### Room model

One room type, one server-owned flag, two doors. `room:create` accepts `autoReady` (default false, rejected with a buy-in). `canStartRoom` treats a human as ready when the flag is set, so the ready flags that `resetReadiness` and `disconnect()` clear stop mattering. `room:join` calls `startRoomGame` inside the join; `tryStartRoom` runs after `restoreMembership` on the host's reconnect; a failed start shows "Couldn't start. [Start game]" which sends `room:ready`. Play Someone Nearby creates `{ buyIn: 0, turnTimer: 60, isPrivate: true, allowSpectators: true, autoReady: true }` with no form; Rooms > Create Room keeps `RoomCreate.svelte` and the ready dance.

`RoomWaiting.svelte` gets a base layout of a fixed 44 px top bar (Back, title) over a scrolling column and three projections of the snapshot:

```
44   Back                 Scan to play Chris
16
200  [ scannable image on white ]                              (alt: Scannable code to join this game)
12
54   Point a phone camera at this. No account needed.
     The game starts the moment they join.
16
52   [                    Share link                      ]    (navigator.share, clipboard fallback)
16
18   (spinner) Waiting for your friend…
16
18   Close room                                                (dim accent link)
```

519 px including padding; shorter viewports scroll; the screen holds a wake lock. Removed while the host is alone: settings tags, the Room Code label and string, the URL string, both player slots, the three unlabelled colour-dot chips, Ready Up, both hints, the 180 px chat box. Friend projection: "Joining Chris's game…" or "Chris is reconnecting…" with Leave. Standard projection: today's layout with one labelled "Add a bot · Medium" button instead of the dot chips.

Zero-tap scan: when the layout mounts with an invite location and no valid token it calls `GET /api/rooms/invite/:code` first (no guest row for crawlers or dead links), shows "Joining Chris's game…", creates the guest, and lets `joinInvite` do the rest. The ack of `room:join` is already an in-game snapshot.

### Copy

| Element | Text |
| --- | --- |
| Header name | Swift Fox 42 / Chris |
| Welcome card | Your first game is against a bot, so nobody has to wait. Real people, and the friend next to you, are under Quick Play. |
| Card dismiss | Skip to Quick Play |
| Bot button | Play (pending: Starting…) |
| Quick Play buttons | Find Opponent / Play Someone Nearby |
| Find Opponent caption | Nobody else is online right now / 3 online · nobody searching / 3 online · 1 searching |
| Nearby caption | They scan your screen, or you send a link. No account needed. |
| Non-idle line | You're searching for an opponent [Open search] / Your room is open [Open room] |
| Rooms empty state | No open rooms yet. Play the bot, or play someone nearby from Quick Play. |
| Waiting room heading | Scan to play Chris |
| Under the image | Point a phone camera at this. No account needed. The game starts the moment they join. |
| Share button | Share link, then Link copied |
| Share sheet text | Chris wants to play you at checkers. Tap to join, no account needed: {joinUrl} |
| Link preview (`/join/CODE`, plan 06 invite card) | Title: Chris wants to play you at checkers. Description: Free, no account needed. Tap to join. Image: host initials, the line above, the board, Free · No account needed · Tap to join |
| Waiting status | Waiting for your friend… |
| Friend projection | Joining Chris's game… / Chris is reconnecting… / Leave |
| Room pill | Waiting for a friend |
| Scanner splash and notice | Joining Chris's game… / You're in as Bold Owl 7. Playing Chris. |
| Invite gone | This invite is no longer open. Ask for a new one, or start your own. [Start your own] |
| Scanner busy | Finish what you're in first, then scan again. |
| Search state 2 | No one's searching right now / Still in the queue. A match starts on its own if someone shows up. / Play a bot instead · Medium |
| Result stakes line | vs Marge · Friendly · no rating change |
| Rematch labels | Rematch / Waiting for Chris… / Accept rematch / Chris left |
| Guest button | Save account / Keep Bold Owl 7 and your games |
| Upgrade sheet | Keep Bold Owl 7 / Name, Email, Password / Save account, Not now / Saved. Welcome, Bold Owl 7. |

### Three stories

Solo visitor from Google. Tap 1 "Play Now" on the landing page. Tap 2 "Play" on `/auth` with the prefilled name; guest created, socket, idle snapshot. Lobby opens on Bot: header, tabs, the card, chips, red Play. Tap 3 "Play": `bot:play`, wheel, board, bot replies in half a second; the in-game snapshot marks the hint seen. Game ends: bars vanish, board shrinks, sheet: "Defeat no moves left", "vs Marge · Friendly · no rating change", [Play again], [Play Someone Nearby], "Lobby · Save account". Tap 4 "Play again": one command, wheel, no lobby frame. Later "Lobby": Quick Play, no card, Play Someone Nearby red, Find Opponent dark with "Nobody else is online right now". A curious "Find Opponent" lands on the fallback in the first snapshot; "Play a bot instead" is one tap and one command.

Friend scans. Chris taps Play Someone Nearby (one tap): "Scan to play Chris", the image, Share link, "Waiting for your friend…"; wake lock on. Ben opens his camera, points, taps the OS banner (not our tap). `/join/K7M2PX` mounts, the layout checks the invite, shows "Joining Chris's game…", creates Bold Owl 7, connects, `joinInvite` sends `room:join`, `autoReady` starts the game inside the join. Both phones show the wheel; Ben sees "You're in as Bold Owl 7. Playing Chris." Zero taps in the app for Ben. If Chris's phone had locked, Ben waits on "Chris is reconnecting…" and the game starts on Chris's reconnect. After the game Ben's sheet reads [Rematch], [Save account / Keep Bold Owl 7 and your games], "Lobby · Chat"; the sheet survives the window and keeps the socket. Both tap Rematch: Chris's button reads "Waiting for Bold Owl 7…", Ben's flips to "Accept rematch", new game with swapped colours. If the room was closed first, Ben sees the invite-gone page and no guest row was created.

Returning on day three. Token still valid (7-day JWT re-issued by `/auth/me` under 3 days left; `guestExpiresAt` slides on every game). Tap 1 "Play Now": lobby on Quick Play, no card, "Your rating 1240", one other person searching, so Find Opponent is red with "1 online · 1 searching". Tap 2: pairing within 2 s, wheel, board. If nobody searches, the server republishes at 20 s and the fallback appears; Minimize shows "You're searching for an opponent [Open search]" in the lobby. After the game: Rematch, Play Someone Nearby, Find Opponent, "Lobby · Chat", with "Chris left" shown honestly. At lunch, Play Someone Nearby and a coworker's camera: story two again.

## Server and client changes

| File | Change |
| --- | --- |
| `server/domain/sessionCommands.js` | `createSessionDispatcher(session, actions, { finishedGame, release })`: idle commands accepted from a finished game after `release`; `bot:play` in `['idle', 'matchmaking']` |
| `server/socket/index.js` | Inject `finishedGame` and `forceIdle`; `tryStartRoom(room).catch()` after `restoreMembership` |
| `server/domain/rooms.js` | `autoReady` on create and in `sanitizeRoom`; `room:join` awaits `startRoomGame`; export `tryStartRoom`; `bot:play` handles the matchmaking phase (await first, pool remove, force-idle on failure) |
| `server/domain/roomRules.js` | `canStartRoom` treats humans as ready when `autoReady` |
| `server/domain/sessions.js` | `matchmakingJoinedAt`, `matchmakingFallbackAt`, `fallbackTimer`; `clearContext()` clears them |
| `server/domain/games.js` | Fallback timer on join; `publishGame` after `game:rematch-request` and `game:leave`; rematch rejects "Your opponent has left"; `endedAt`; `GAME_OVER_LINGER_MS`; guest expiry slide in `persistResult` |
| `server/domain/snapshots.js` | `matchmaking: { joinedAt, botFallbackAt, fallbackOpen }`; in-game `mode`, `origin`, `opponentLeft`, `endedAt` |
| `shared/constants.js` | `MATCHMAKING_BOT_FALLBACK_MS = 20000`, `GAME_OVER_LINGER_MS = 180000` |
| `server/socket/presenceHandler.js` | `searching` (matchmaking phase only) |
| `server/routes/rooms.js` (new), `server/app.js` | `GET /api/rooms/invite/:code` |
| `server/routes/guest.js`, `server/routes/auth.js` | 7-day guest JWT; `/me` re-issue under 3 days; `/upgrade` updates the live session and publishes |
| `server/routes/leaderboard.js` | `isBotGame` on `/games` |
| `docs/navigation-contract.md` | One rule: a finished game accepts idle commands; the server releases first |
| `tests/gameSocket.test.js`, `tests/userState.test.js`, `tests/navigation.test.js` | Cases listed in the ruling: fallback republish, `bot:play` from matchmaking and from a finished game, autoReady join and reconnect start, retry, `opponentLeft`, rematch publish, invite pre-check |
| `src/lib/components/Lobby.svelte` | One-row header; theme picker to `ProfileScreen.svelte` |
| `src/lib/components/lobby/PlayTabs.svelte` | Tab typography; default tab from the hints store |
| `src/lib/hints.js`, `src/lib/components/Hint.svelte` (new) | Seen-set, phase subscription, sequence |
| `src/lib/components/lobby/BotPlay.svelte` | Card, chips, full-width Play; no icon, no heading; phase-aware |
| `src/lib/components/lobby/QuickPlay.svelte` | Two buttons with captions; emphasis by `searching`; non-idle replacement |
| `src/lib/components/lobby/RoomList.svelte` | Empty state, "vs Bot" rows, non-idle replacement |
| `src/lib/components/lobby/RoomWaiting.svelte` | Top bar plus scrolling column; three projections; Share link; wake lock; Start game retry |
| `src/lib/components/RoomBanner.svelte` | "Waiting for a friend" |
| `src/lib/components/SearchScreen.svelte` | Two states from `fallbackOpen`; "Play a bot instead · Medium" |
| `src/lib/components/GameScreen.svelte`, `GameResult.svelte` (new) | Result state, sheet, action matrix |
| `src/lib/components/UpgradeSheet.svelte` (new), `src/routes/(app)/+layout.svelte`, `src/lib/socket.js` | Layout-level sheet; identity keyed on user id; invite pre-check and auto-guest; notice bar; auth as a function |

Effort: five to seven developer days server side and six to seven client side, about two and a half weeks for one developer including tests and a phone pass. Shippable in order: room model and scan path, lobby, search fallback, result sheet, guest lifetime.

## Risks

- Auto-start pulls a minimized host into the wheel without a tap; the pill says "Waiting for a friend".
- Browsers without `wakeLock` can still lock during a slow scan; the reconnect start makes it a delay, not a dead room.
- A screenshot of the image lets a stranger join: private, one seat, the host sees who joined and can resign.
- The dispatcher allowance means a rejected follow-up lands the player in the lobby with the error, as `game:leave` plus a failure would.
- The 3-minute window is still a fuse; the lobby offers the same actions minus Play again.
- Emphasis follows the searching count; a colour flip while the player is looking is possible and rare.
- Connection-time closures hold the guest name after an in-place upgrade until reconnect; only chat labels can lag.
- Hard bot CPU on a small VPS is untouched; Medium is the default everywhere.
- Rooms are in memory; a deploy kills every code on screen; the invite-gone page covers it.
- A Bot-only first-timer meets the scan control first on the result sheet, later than a header icon would show it.

## Follow-up after owner review, 10 September 2026

Recorded from the conversation after the ruling.

1. **Share sheet and invite card (owner requirement).** The waiting room's "Share link" button uses the OS share sheet (`navigator.share`, clipboard fallback) so the host can send the invite through WhatsApp, iMessage, email, Snapchat or anything else installed. The link is `/join/CODE`, the SSR page from plan 04 Phase 3, and it unfurls with a generated card at `/og/invite/CODE.png` showing the host's name, "wants to play you at checkers", the board and "Free · No account needed". Plan 06 owns the image (step 3a), plan 04 owns the page head, plan 01's robots block now disallows `/invite/` instead of `/join/` so X and LinkedIn can fetch the preview. Email and Snapchat do not unfurl links; the share text carries the invite there.
2. **Room code only, recommended and awaiting the owner's confirmation.** A zero-tap scan needs defaults, so the code exists only on a room that has them; there is no roomless code in the play flow. A personal code that encodes the user's existing `friendCode` (`server/routes/friends.js`, `FriendsScreen.svelte`) is a separate feature with the verb "add a friend", to be built later on the Friends screen; it should not be merged with the play flow because it adds four or five taps and a wait between two people standing together.
3. **Auto-friend after a scanned game, recommended.** At join when the scanner is already registered; for a guest, fold it into the register offer on the result sheet ("Save account and add Chris as a friend"), because a friendship row pointing at a tombstoned guest is junk.
4. **No in-room settings editing, recommended.** Changing a wager or clock after someone joined is fair only if it un-readies both players (`resetReadiness` in `server/domain/roomRules.js` exists for that), but it is unnecessary: the host chooses between "defaults now" (Play Someone Nearby, auto-ready) and "settings first" (Rooms, Create Room, then the same waiting room shows the same code, and the joiner's single Ready tap is the consent) before anyone scans. Two room types, one code, no editing after the fact.

## Decisions for the owner

| Decision | Options | Recommendation |
| --- | --- | --- |
| Button label | Play Someone Nearby / Invite a friend / Challenge a Friend | Play Someone Nearby; it says what happens and does not collide with the Friends tab |
| The word QR in copy | Use it / avoid it | Avoid it; the code string is gone so "code" is no longer ambiguous, and the camera sentence needs no noun |
| Quick Play emphasis | Fixed red on Nearby / colour follows the searching count / position follows it | Colour follows the count, positions fixed |
| Skip label | Skip / Skip to Quick Play | Skip to Quick Play |
| Next action from a finished game | Dispatcher rule / `game:next` command / two-command chain | Dispatcher rule; no new command names, one contract line |
| Fallback delivery | Server republish at the deadline / frozen deadline with client clock | Republish; the snapshot stays the only source of truth |
| Post-game window | 60 s / 180 s | 180 s |
| Auto-start rule | `autoReady` flag / any free room joined by code | The flag; Create Room keeps the ready dance as consent |
| Bot link on the waiting room | Keep "Nobody coming? Play the bot instead" / cut | Cut; Back and the Bot tab cover it |
| Name in the header | Dim text / nothing | Dim text; a guest must know the name a friend will see |
