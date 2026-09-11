# 04 — First session on an empty server

Plans 02, 03 and 05 will send strangers to purecheckers.com while the live database is empty and the presence counter reads 1. A multiplayer site loses every one of those visitors unless the first session works with zero other humans. This plan makes the first five minutes good on an empty server: a bot game in three taps, an invite link in two, honest presence numbers, a search that ends in a game instead of a spinner, and a result screen that gives the player a next move. It does not add new game features; it re-orders what already exists and closes the dead ends found in the source inspection below.

Superseded in part on 10 September 2026: the owner kept the three lobby tabs, and a four-persona design debate produced the lobby, waiting room, search fallback and game-over design now recorded in 04a-lobby-design-debate.md. Where this file and 04a disagree (the merged Play tab, the header QR icon, the two-command post-game chains), 04a wins. The findings table, the matchmaking fallback analysis, the bot roster polish, the SSR invite page and the metrics below remain valid.

Written 10 September 2026 from source inspection only. Tap counts and timings come from the components cited; bot timings come from a self-play benchmark of the minimax in `shared/game.js` on a desktop CPU. Nothing here has been reproduced in a browser.

## Current state

### The first-run flow as it is

1. `/` (`src/routes/(marketing)/+page.svelte`, prerendered) — "Play Now — It's Free" links to `/auth`. Sub-copy: "No account required. Pick a nickname and go."
2. `/auth` — the `(app)` layout (`src/routes/(app)/+layout.svelte`, `ssr = false`) renders `AuthScreen.svelte` in `guest` view: a nickname input prefilled from `GET /api/guest/name` and one "Play" button. Sign-in and register are underlined text links. Tapping Play calls `POST /api/guest` (`server/routes/guest.js`), which creates a real `User` row with `isGuest`, `coins: 0`, `guestExpiresAt = now + 24h` and a 24h JWT.
3. Lobby (`Lobby.svelte` → `lobby/PlayTabs.svelte`) — three tabs: Quick Play (default), Rooms, Bot. Header shows a green dot and a bare number (`$presenceStats.online`, which includes the viewer, so a lone visitor sees "1"), plus "N searching" only when `lookingToPlay > 0`.
4. Quick Play tab (`lobby/QuickPlay.svelte`) — big rating "1000", "Find Opponent" (`matchmaking:join`), "Play vs Friend" (opens `RoomCreate.svelte` with `defaultPrivate`), then the global game log (`GameLog.svelte`).
5. Bot tab (`lobby/BotPlay.svelte`) — robot icon, Easy/Medium/Hard radio (default medium, remembered in `localStorage.checkers_bot_diff`), "Challenge" → `bot:play` (`server/domain/rooms.js`) → `startRoomGame` → `createGameDirect` (`server/domain/games.js`) → colour wheel (`ColorReveal.svelte`, about 3.8 s or Skip; bots auto-acknowledge) → board.
6. Game over (`GameScreen.svelte`) — "Victory!/Defeat/Draw", a breakdown that is empty for guests and bot games, one "Lobby" button, and for guests a text nudge "Create an account to keep your ELO and progress" that routes to the Profile tab.

Taps from landing today: bot game = 4 (Play Now, Play, Bot tab, Challenge) plus the wheel; invite link = 5 (Play Now, Play, Play vs Friend, Create Room, Copy Link); human search = 3 with no guaranteed end.

### Findings

Columns match `docs/player-experience-audit.md`. P1 items lose the visitor outright on an empty server; P2 items waste the visit or the invite; P3 items are trust and polish.

| Priority | Finding | Player consequence | Source / required treatment |
| --- | --- | --- | --- |
| P1 | Quick play queues indefinitely. `quickPlayPool.tryMatch` runs every 2 s, widens the ELO window (`MATCHMAKING_BASE_WINDOW` 100, `+50` per 10 s, max 500 in `shared/constants.js`) and never times out or falls back to a bot. `SearchScreen.svelte` shows "No other players searching right now" with only Minimize and Cancel | The most prominent button on the default tab leads to a spinner that can only be cancelled. On an empty server this is the visitor's last screen | `server/services/quickPlay.js`, `server/domain/games.js` (`startMatchmaking`), `SearchScreen.svelte`. Add a server-owned fallback deadline and a "play a bot instead" path (Phase 2) |
| P1 | Bots are the third tab and the default tab does not mention them. The landing page says "No one online? Practice against bots" but the lobby's primary CTA is "Find Opponent" | A first-time visitor who does not explore tabs never finds the only opponent that is guaranteed to exist | `lobby/PlayTabs.svelte`, `lobby/QuickPlay.svelte`, `lobby/BotPlay.svelte`. Bot-first default (Phase 1) |
| P1 | The invite link `SITE_URL/join/CODE` (`sanitizeRoom` in `server/domain/rooms.js`) resolves to `src/routes/(app)/join/[code]/+page.svelte` under a `ssr = false` layout. The served HTML is `src/app.html` with a description meta only: no `<title>`, no `og:title`, no `og:image`, no invite context | In WhatsApp, iMessage, Discord and Slack the invite unfurls as a bare URL or the generic site description. The friend does not see who invited them or that it is a game | `src/app.html`, `src/routes/(app)/+layout.js`, `src/lib/navigationPolicy.js` (`/join/` regex). SSR invite page with real OG tags (Phase 3) |
| P1 | Guest games and bot games are always `FRIENDLY` (`startRoomGame` and `sanitizeRoom.effectiveMode` in `server/domain/rooms.js`), and `FRIENDLY` persistence in `GameRoom.persistResult` awards no ELO and no coins. `COINS_BOT_WIN = 5` is defined in `shared/constants.js` and referenced nowhere | A guest never earns ELO or coins, against a bot or a human. The result screen shows a title and nothing else; the nudge "keep your ELO" refers to progress that does not exist. The landing page promises "earn ELO" | `server/domain/games.js`, `shared/constants.js`, `GameScreen.svelte`. Award `COINS_BOT_WIN` for bot wins with a daily cap; rewrite the guest nudge to what is actually kept (Phase 1 copy, Phase 2 rewards) |
| P1 | Game over offers one action, "Lobby". No rematch, no next difficulty, no invite, no search. The rematch protocol (`game:rematch-request`) has no UI (audit P2) | Every game ends in the lobby, where the visitor faces the same empty state they started from | `GameScreen.svelte` game-over block. Post-game prompts (Phase 4) |
| P2 | A disconnect while searching removes the player from the queue immediately (`handleDisconnect` case `matchmaking` → `forceIdle` in `server/domain/sessions.js`). No client feedback beyond the snapshot flipping to idle | A phone user who switches apps for ten seconds returns to the lobby with no explanation of why the search stopped | `server/domain/sessions.js`, `SearchScreen.svelte`. Either a short matchmaking grace (10 s) or a lobby notice "Search stopped while you were away" using the recoverable notice metadata proposed in the audit |
| P2 | The empty room list reads "No rooms available. Create one!" and the Rooms tab badge is hidden at zero. Live bot games do appear as public, watchable rooms because `bot:play` installs a non-private room with spectators allowed | Create-a-room is offered as the fix for emptiness, which produces a second waiting screen. The one thing that would populate the list, a bot game, is not suggested | `lobby/RoomList.svelte`, `lobby/PlayTabs.svelte`. Empty-state copy that points at bot and invite (Phase 1) |
| P2 | Presence pill is a green dot and a number that includes the viewer. `getStats` in `server/socket/presenceHandler.js` counts sessions with a connection; `lookingToPlay` also counts in-room players | "1" next to a pulsing dot reads as activity. The honest reading, "you are alone", is never stated, so the visitor learns it by waiting | `Lobby.svelte`, `presenceHandler.js`. Real counts excluding self, with fallback copy (Phase 1 copy, Phase 2 data) |
| P2 | Host leaves before the friend arrives: `removeMember` closes the room when no humans remain, `leaveRoom` deletes it. The friend's `room:join` by code is rejected "Room not found" and rendered as the top `session-error` bar over the lobby | The invited friend created a guest account for nothing and lands in an empty lobby with an error | `server/domain/roomRules.js`, `server/domain/rooms.js`, `src/lib/navigationController.js` (`joinInvite`). SSR page shows an expired state; in-app failure offers "start your own room and send the link back" (Phase 3) |
| P2 | The invited friend sees the generic AuthScreen ("Pick a name and play") before the join happens. The invite intent survives authentication (`navigation-contract.md`) but nothing tells the friend they were invited or by whom | The friend does not know the name they pick is for Chris's game, or that a game is waiting | `AuthScreen.svelte`, `navigationController.js` state. Expose the pending invite code and host name to the auth view (Phase 3) |
| P2 | Friend flow requires both players to tap "Ready Up" (`canStartRoom` in `roomRules.js`), and the host must tap through `RoomCreate` (buy-in, timer, private, spectators) before seeing a code | Five decisions stand between "play with a friend" and a shareable link, and a ready dance before the wheel | `lobby/QuickPlay.svelte`, `lobby/RoomCreate.svelte`, `lobby/RoomWaiting.svelte`. "Invite a friend" creates a private room with defaults directly (Phase 1); consider auto-ready for the host of a two-human private room (open question) |
| P2 | Guest identity expires after 24 h regardless of activity: the JWT (`server/routes/guest.js`) and `guestExpiresAt` are never extended. `cleanupExpiredGuests` (`server/services/guestCleanup.js`) deletes guests with zero games and renames the rest to `[Expired Guest N]`. Upgrade (`POST /api/auth/upgrade`) exists but is reachable only from the Profile tab card | A visitor who returns on day two is logged out and starts as a stranger; their games are attributed to `[Expired Guest 12]` in the public game log and on `/game/[id]` pages | `server/routes/guest.js`, `guestCleanup.js`, `ProfileScreen.svelte`. Sliding expiry on activity, 7-day guest JWT, inline upgrade at game over (Phase 2 and 4) |
| P2 | No GA4 events exist. `src/app.html` loads gtag with the base config only; the app navigates with `pushState`/`replaceState` | None of the success metrics below can be measured today | `src/app.html`, `src/lib/browserNavigation.js`. Add a small event helper and the events listed under Success metrics (Phase 1 onward) |
| P3 | Bots are named "Bot Easy", "Bot Medium", "Bot Hard" (`server/domain/botRegistry.js`, ratings 600/1000/1400, depth 2/4/6). Emote personalities exist per difficulty in `server/services/botEmotes.js` but emotes are sent with `username: 'Bot'`. `ColonelBot` ("The Colonel", depth 6) in `shared/game.js` is unused | The only opponents that are always available look like a settings menu, not like players | `botRegistry.js`, `botEmotes.js`, `games.js` (emote username), `shared/game.js`. Roster presentation (Phase 1), retire the dead class |
| P3 | Global chat opens from an edge toggle and shows "No messages yet"; the leaderboard panel shows "No ranked games yet" (`ChatPanel.svelte`, `LeaderboardPanel.svelte`); the game log shows "No games played yet" | Three more confirmations that nobody is here. None of them suggests what to do | `chat/ChatPanel.svelte`, `panels/LeaderboardPanel.svelte`, `GameLog.svelte`. Empty-state copy with one action each (Phase 1) |
| P3 | `server/services/matchmaking.js` (`rankedQueue`) is not imported by the server; `tests/matchmaking.test.js` tests it. The live pool is `quickPlay.js`, which has no dedicated unit test | Matchmaking changes in Phase 2 land on untested code | Retarget the test file to `quickPlayPool` and delete `matchmaking.js` (Phase 2) |
| P3 | In-game disconnect grace is 30 s (`handleDisconnect` case `in-game`), room grace 2 min, matchmaking 0 s; `lifecycle.js` forfeits on timeout. The chat system message and the `GameScreen` banner hard-code "30s" (audit P2) | Reasonable for phones switching apps mid-game; the number is right today but not derived from the server | `server/domain/sessions.js`, `GameScreen.svelte`. No change in this plan beyond noting the constant if the grace is tuned |

## Plan

### The proposed first-session contract

Target: from the lobby, one tap to a bot game and two taps to a shareable invite link. From the landing page that is three and four taps respectively (Play Now, then Play on the name screen, are unavoidable while `/auth` is a separate step). A visitor should see a board with pieces moving within 30 seconds of landing on `/`.

| Step | Screen | What the player sees | Contract |
| --- | --- | --- | --- |
| 1 | `/` hero | "Play Now — It's Free" unchanged. Under it, when `GET /api/presence` (new, Phase 2) reports at least one human online: "3 playing now". At zero, nothing; never a fake number | Prerendered page fetches presence client-side after load; absence of the line is the honest empty state |
| 2 | `/auth` guest view | Prefilled nickname, "Play". Sub-copy: "Your first game is against a bot. Humans join when they are online." If a `/invite/CODE` intent is pending: "Chris invited you to a game — pick a name to join" | Reads the pending invite from navigation state; does not touch session commands |
| 3 | Lobby, Play tab (renamed from Quick Play) | Top card: a bot opponent with face, name, rating and record, difficulty chips (default Medium) and one primary button "Play now". Below: "Find a human" with the live count ("0 searching · 1 online"), then "Invite a friend". Then the game log | "Play now" sends `bot:play` with the selected difficulty — one tap. The Bot tab is removed; the Rooms tab stays |
| 4a | Bot game | Wheel, then board. Bot moves after 0.4–1.0 s (`scheduleBotMoveIfNeeded`) | Unchanged |
| 4b | Search | `SearchScreen` shows elapsed time and the real count of other searchers. At `botFallbackAt` (server deadline, 20 s after queue entry; immediately when nobody else is online) the screen changes to "Nobody is searching right now" with a primary "Play a bot instead" and a secondary "Keep waiting" | See matchmaking fallback below. No automatic navigation: the search stays a search until the player taps |
| 4c | Invite | "Invite a friend" creates a private room with defaults (free, 60 s, spectators on) in one command; `RoomWaiting` opens with the QR, the code, "Share" (`navigator.share` where available, copy otherwise) and "Copy link". While waiting the host can tap "Play a bot while you wait" only after leaving the room, and the screen says so | Two taps from the lobby to a link in the clipboard or share sheet |
| 5 | Game over | Result, rewards line, then up to four actions: "Play again" (bots: same or next difficulty), "Invite a friend", "Find a human (N online)", and for guests an inline "Save your progress" form. A single line "Tomorrow's puzzle is ready at 00:00 UTC" links to plan 03 once it exists | Bot rematch chains two acknowledged commands: `game:leave` (permitted in `in-game`) then `bot:play` (permitted in `idle`) after the idle snapshot arrives. The navigation controller projects each accepted snapshot; no local screen writes |

The contract keeps every rule in `docs/navigation-contract.md`: the server owns membership, the browser only submits intents and commands, `/invite/CODE` is an explicit join intent that waits for synchronization and attempts once, and no step relies on a URL to grant membership.

### Matchmaking fallback: what the session model allows

The brief asked for "no opponent in 20 s → play a bot, keep searching in the background". The second half cannot be done as stated:

- A session has exactly one phase (`VALID_TRANSITIONS` in `server/domain/sessions.js`) and every command is bound to a phase (`COMMAND_PHASES` in `server/domain/sessionCommands.js`). `matchmaking → in-game` is a valid transition, so starting a bot game from a search is allowed. Being in a game and in the queue at the same time is not representable.
- Leaving a stale pool entry behind is actively harmful: `createQuickPlayRoom` in `server/domain/rooms.js` calls `forceIdle` on any paired player whose phase is not `matchmaking`, which would tear down a live bot game.
- `projectNavigation` in `src/lib/navigationPolicy.js` projects `in-game` to a full-screen `/game?game=…` with no `search=1`, so there is no place to show a background search either.

Proposal, in two parts:

1. Fallback (Phase 2). Store the queue-entry time on the session when `matchmaking:join` is accepted (this also fixes the audit finding that `snapshots.js` regenerates `joinedAt` on every serialization). Publish `matchmaking: { joinedAt, botFallbackAt }` in the snapshot, where `botFallbackAt = joinedAt + MATCHMAKING_BOT_FALLBACK_MS` (new constant, 20000) or `joinedAt` when `getStats().online <= 1`. Add a command `matchmaking:play-bot` permitted in `['matchmaking']` that removes the pool entry and then runs the `bot:play` path with the requested difficulty. The client shows the fallback controls when `serverTime >= botFallbackAt`. The search ends when the bot game starts; the result screen offers "Find a human" again.
2. Notification, not membership (later, optional). Keep a `wantsHuman` flag on the session for the duration of the bot game. When another human enters the pool, `notifyUser` sends a non-authoritative `matchmaking:human-available` notice; the game screen shows "A player is looking for a game" with no action other than finishing or resigning. Notifications never mutate gameplay or session state, which is the rule the audit sets for notices.

Until Phase 2 ships, Phase 1 gives the search screen an immediate client-side "Play a bot instead" that sends `matchmaking:leave` and, after the idle snapshot, `bot:play`. That is two accepted commands and one visible intermediate lobby frame; acceptable for a week, not as the final state.

### Bot roster polish

The bots are the only opponents guaranteed to exist, so they should look like opponents. Everything below is presentation; registry keys and account identity stay exactly as `docs/bot-registry.md` specifies.

- Add presentation fields to `BOT_REGISTRY` in `server/domain/botRegistry.js`: `displayName`, `avatar` (an inline SVG id or emoji), `tagline`, `style`. Suggested: Easy "Pip" (600, "learning the ropes"), Medium "Marge" (1000, "solid and patient"), Hard "The Colonel" (1400, "does not forgive blunders"), reusing the name already in `shared/game.js` and deleting the unused `ColonelBot` class. Usernames on existing accounts are not renamed; `bot-registry.md` says names are defaults and provisioning preserves renamed accounts. If the owner wants the account usernames to match, that is a one-off script, not a registry change.
- Expose `GET /api/bots` (new, in `server/routes/leaderboard.js` or a small `server/routes/bots.js`): registry presentation fields plus `gamesPlayed`, `wins`, `losses` from the bot User rows. Those counters already increment for `FRIENDLY` games (`persistResult`), so the bots accumulate real records and the roster reads "Marge · 1000 · 14 W / 9 L · last game 3 m ago" without any new persistence. Bot ELO never changes in `FRIENDLY` mode, so display it as a fixed rating.
- Lobby Play tab renders the three as opponent cards; the selected card is the "Play now" target. `RoomWaiting`'s bot chips use the same faces.
- Send bot emotes with the bot's display name instead of `'Bot'` (`notifyChannel` calls in `server/domain/games.js`).
- Public game log: keep bot games visible in-app. They are the proof that the site is alive, they are watchable rooms while running, and hiding them makes the lobby emptier. Tag them "vs bot" in `GameLog.svelte` and in `/api/leaderboard/games` (add `isBotGame` from the players' `isBot` flags). Plan 01 owns the SEO side: `noindex` on `/game/[id]` for bot games and on `/player/Bot…`. Also render tombstoned guests as "Guest" in the log and replay pages rather than `[Expired Guest 12]`.

### Presence honesty

Options: show real counts (which will read zero for weeks), or hide counts and let the search speak for itself.

Recommendation: real counts, excluding the viewer, with fallback copy. Reasons: the site's whole pitch is a person being straight with players; a fake or ambiguous number is the one thing that would contradict it. Hiding the count does not hide emptiness, it only moves the discovery to the search spinner, which is the worst place to learn it. A real zero, stated plainly next to a working alternative, turns the empty state into a decision: "You're the first one here — challenge a bot or invite a friend." When the count is positive the same line reads "3 players online · 1 searching", and the "Find a human" button gains a real reason to exist.

Implementation: `getStats` in `server/socket/presenceHandler.js` already excludes bots (they have no sessions). Add `humansOnline` and keep `online` for compatibility; the client subtracts itself. The `presence:stats` broadcast on phase change and every 10 s is sufficient. Do not count spectators or in-room players as "searching".

### Phase 1 — copy and defaults (effort: 1 day)

1. `src/lib/components/lobby/PlayTabs.svelte`: rename Quick Play to Play, remove the Bot tab, keep Rooms.
2. `src/lib/components/lobby/QuickPlay.svelte` and `BotPlay.svelte`: merge into one Play panel — bot opponent card with difficulty chips and "Play now" (`bot:play`), then "Find a human" with the live count, then "Invite a friend" sending `room:create` with `{ buyIn: 0, turnTimer: 60, isPrivate: true, allowSpectators: true }` directly. Keep `RoomCreate` for the Rooms tab.
3. `src/lib/components/Lobby.svelte`: presence pill becomes text: "You're the first one here" at zero others, "N online · M searching" otherwise.
4. `src/lib/components/SearchScreen.svelte`: elapsed time, honest count, immediate "Play a bot instead" (client-side chain until Phase 2), "Keep waiting".
5. `src/lib/components/lobby/RoomWaiting.svelte`: "Share" via `navigator.share` with copy fallback; hint text "Your friend does not need an account".
6. `src/lib/components/GameScreen.svelte`: guest nudge copy → "Create an account to keep your game history and unlock ranked play"; bot games show "Friendly · no rating change" instead of an empty breakdown.
7. Empty states: `lobby/RoomList.svelte` ("No open rooms. Play a bot or invite a friend"), `chat/ChatPanel.svelte` for global ("Quiet in here. Say hi — players see this between games"), `panels/LeaderboardPanel.svelte` ("Ranked games between registered players appear here").
8. GA4: a `track(event, params)` helper in `src/lib/analytics.js` calling `gtag` when present; fire `guest_created`, `game_start`, `first_move`, `game_end`, `invite_link_shared`.

Done when: a new guest reaches a bot game in three taps from `/`, an invite link in four, and every empty state names bot or invite as the next action.

### Phase 2 — matchmaking fallback and online counter (effort: 2 days)

1. `server/domain/sessions.js`: store `matchmakingJoinedAt` on the session in `matchmaking:join`; clear on leave. `server/domain/snapshots.js`: publish `matchmaking: { joinedAt, botFallbackAt }`.
2. `shared/constants.js`: `MATCHMAKING_BOT_FALLBACK_MS = 20000`. `server/domain/sessionCommands.js`: `'matchmaking:play-bot': ['matchmaking']`. `server/domain/rooms.js`: implement it by removing the pool entry and reusing the `bot:play` body with the phase check relaxed to `matchmaking`.
3. `server/socket/presenceHandler.js`: add `humansOnline`; `server/app.js`: `GET /api/presence` for the landing page; `src/routes/(marketing)/+page.svelte`: client-side fetch and the "N playing now" line, hidden at zero.
4. Rewards: award `COINS_BOT_WIN` in the `FRIENDLY` branch of `persistResult` when the opponent is in `room.botIds` and the winner is human, capped at three bot-win rewards per day per user (reuse the `lastDailyWin` pattern or a small counter). Guests included, so the result screen has a number on it.
5. Guest lifetime: `server/routes/guest.js` JWT to 7 d; extend `guestExpiresAt` by 7 d on every persisted game in `persistResult`. `guestCleanup.js` unchanged.
6. Tests: retarget `tests/matchmaking.test.js` to `quickPlayPool`, delete `server/services/matchmaking.js`; add socket tests in `tests/gameSocket.test.js` for the fallback deadline in the snapshot and `matchmaking:play-bot` from the `matchmaking` phase; a `userState` test that a stale pool entry can no longer reach `forceIdle` on an in-game player.

Done when: a lone searcher sees the fallback within one snapshot of joining, a searcher with company sees it at 20 s, and the bot game starts from the search screen without passing through the lobby.

### Phase 3 — SSR invite page with OG tags (effort: 1 day)

SvelteKit cannot host `/join/[code]` in both route groups, so the app route moves and the marketing group takes the public URL. The QR and `joinUrl` in `server/domain/rooms.js` keep pointing at `/join/CODE`; nothing printed or shared breaks.

1. New `server/routes/rooms.js` mounted at `/api/rooms`: `GET /api/rooms/invite/:code` reads `findRoomByCode` from `server/domain/rooms.js` (same process, in-memory) and returns `{ hostName, status, playerCount, buyIn, turnTimer }` or 404. No player IDs, no join code echo beyond the request.
2. New `src/routes/(marketing)/join/[code]/+page.server.js` loading that endpoint, and `+page.svelte` rendering: title "Chris wants to play you at checkers", `og:title` the same, `og:description` ("Free, no account needed. Tap to join."), `og:url`, `og:type` `website`, `og:image` = `https://purecheckers.com/og/invite/CODE.png` with width, height, type and alt ("Chris invites you to a game of checkers on Pure Checkers"), `twitter:card` `summary_large_image`, `twitter:image` the same URL, and `<meta name="robots" content="noindex">`. The image route is plan 06 step 3a and ships with this phase; until it exists the page falls back to the site card through the layout's `data.ogImage` default. States: waiting → "Join game" button to `/invite/CODE`; playing → "Game already started" with "Watch" (also `/invite/CODE`, spectate handled in-app) and "Start your own"; missing → "This invite has expired. Start your own game and send the link back."
3. A three-line inline script: if `localStorage.checkers_token` exists, `location.replace('/invite/' + code)` so returning users skip the interstitial. Crawlers and first-time friends see the page.
4. Move `src/routes/(app)/join/[code]/+page.svelte` to `src/routes/(app)/invite/[code]/+page.svelte`; change the regex in `parseLocation` (`src/lib/navigationPolicy.js`) from `^/join/` to `^/invite/`; update `tests/navigation.test.js` (23 controller/policy cases cite `/join/`).
5. `src/lib/navigationController.js`: include `invite: { code }` in published state while an invite intent is pending; `AuthScreen.svelte` reads it and, via `GET /api/rooms/invite/:code`, shows the host name.
6. `robots.txt` in `src/static`: add `Disallow: /invite` to the block plan 01 owns (do not rewrite the file here). `/join` stays crawlable but `noindex`.

Done when: pasting an invite link into a chat client shows the host's name and the site image, a friend without an account reaches the waiting room in two taps (Join game, Play), and an expired link explains itself instead of showing an error bar over the lobby.

### Phase 4 — post-game prompts (effort: 1 day)

1. `GameScreen.svelte` game-over block: replace the lone "Lobby" button with the action set from step 5 of the contract. Bot "Play again" chains `game:leave` then `bot:play`; after a win it preselects the next difficulty. "Find a human" sends `game:leave` then `matchmaking:join` and shows the live count on the button. "Invite a friend" sends `game:leave` then the private `room:create`.
2. Extract the upgrade card from `ProfileScreen.svelte` into `src/lib/components/UpgradeCard.svelte` and render it inline for guests at game over, collapsed behind "Save your progress" so it does not push the board.
3. "Tomorrow's puzzle" line links to the plan 03 route; hidden until that route exists.
4. GA4: `rematch_bot`, `post_game_invite`, `post_game_search`, `guest_upgraded`.
5. Keep "Lobby" as a small text link. The 60 s post-game cleanup timer in `persistResult` (`forceIdle` for players who never dismissed) is unchanged; the prompt must not depend on the game room surviving longer than that.

Done when: a bot game ends with a next action on screen, guests can upgrade without leaving the result, and every button issues session commands only.

### Files touched, by phase

| Phase | Create | Change | Delete |
| --- | --- | --- | --- |
| 1 | `src/lib/analytics.js` | `lobby/PlayTabs.svelte`, `lobby/QuickPlay.svelte`, `lobby/BotPlay.svelte`, `Lobby.svelte`, `SearchScreen.svelte`, `lobby/RoomWaiting.svelte`, `lobby/RoomList.svelte`, `GameScreen.svelte`, `chat/ChatPanel.svelte`, `panels/LeaderboardPanel.svelte`, `GameLog.svelte` | — |
| 2 | `server/routes/bots.js` (or extend `leaderboard.js`) | `shared/constants.js`, `server/domain/sessions.js`, `server/domain/snapshots.js`, `server/domain/sessionCommands.js`, `server/domain/rooms.js`, `server/domain/games.js`, `server/domain/botRegistry.js`, `server/socket/presenceHandler.js`, `server/app.js`, `server/routes/guest.js`, `src/routes/(marketing)/+page.svelte`, `tests/matchmaking.test.js`, `tests/gameSocket.test.js`, `tests/userState.test.js` | `server/services/matchmaking.js`, `ColonelBot` in `shared/game.js` |
| 3 | `server/routes/rooms.js`, `src/routes/(marketing)/join/[code]/+page.server.js`, `src/routes/(marketing)/join/[code]/+page.svelte`, `src/routes/(app)/invite/[code]/+page.svelte` | `server/app.js`, `src/lib/navigationPolicy.js`, `src/lib/navigationController.js`, `AuthScreen.svelte`, `src/static/robots.txt`, `tests/navigation.test.js` | `src/routes/(app)/join/[code]/+page.svelte` |
| 4 | `src/lib/components/UpgradeCard.svelte` | `GameScreen.svelte`, `ProfileScreen.svelte`, `src/lib/analytics.js` | — |

### Manual acceptance

Run each on a phone and a desktop against a server with no other humans connected, then once more with a second browser as the friend.

1. Fresh browser, `/` → bot game: three taps, wheel, first bot move visible. Result screen shows a next action and, for guests, the inline upgrade.
2. Fresh browser, lobby → "Invite a friend": two taps to a shared link; paste it into a chat client and confirm the host name and image unfurl.
3. Friend opens the link with no account: sees the host name on the interstitial and on the name screen, lands in the waiting room, both ready, game starts.
4. Host closes the room before the friend taps Join: friend sees the expired state, not an error bar over the lobby.
5. "Find a human" alone: fallback offered within one snapshot; tap it; bot game starts without a lobby frame. With a second human searching: fallback appears at 20 s, and pairing still wins if it happens first.
6. Search, switch apps for 15 s, return: the lobby says why the search stopped.
7. Reload, Back, Forward and minimize/reopen during each of the above, per `navigation-contract.md`.

## Success metrics

None of these exist today; Phase 1 adds the GA4 events, and the server's `[UserState] Phase:` log lines in `server/domain/sessions.js` already carry the transitions needed for the server-side numbers.

| Metric | Source | 30-day target | 90-day target |
| --- | --- | --- | --- |
| New sessions that start any game | GA4 `game_start` / new users | 60% | 70% |
| New sessions that finish a game | GA4 `game_end` with `first_session = true` | 40% | 50% |
| Time from landing to first move | GA4 `first_move` timestamp minus session start; median | under 60 s | under 45 s |
| Search abandonment | Server log: `matchmaking -> idle` transitions without a following `-> in-game` | under 30% | under 20% |
| Fallback uptake | GA4 `game_start{source: fallback}` / searches that reached `botFallbackAt` | 50% | 60% |
| Invite link conversion | GA4 page views of `/join/*` → `game_start{source: invite}` | 40% | 50% |
| Guest → account upgrade | GA4 `guest_upgraded` / guests with at least one `game_end` | 5% | 8% |
| D1 / D7 return | GA4 retention for users whose first event was `guest_created` | 15% / 5% | 20% / 8% |

Search Console is not relevant to this plan except that `/join/*` must not appear in the index (check Pages report after Phase 3).

## Dependencies and risks

- Navigation and session contract. Everything here issues session commands and lets the server-authored snapshot drive the screen (`docs/navigation-contract.md`). The one new command, `matchmaking:play-bot`, is bound to a phase like all others and uses a transition that `VALID_TRANSITIONS` already permits. "Background search during a bot game" is rejected for the reasons given above; do not implement it by leaving pool entries alive.
- Bot CPU on a $5 host. `chooseBotMove` runs synchronously on the event loop. Self-play benchmark on a desktop CPU: Easy (depth 2) average 0.8 ms, max 4.6 ms; Medium (depth 4) average 16.5 ms, max 78 ms; Hard (depth 6) average 92 ms, max 511 ms per move. A small VPS is two to three times slower, so one Hard game can stall every socket on the server for over a second at a time, and ten concurrent Hard games make the site feel broken. Mitigations in order of effort: keep Medium as the default and never auto-select Hard; add an iterative-deepening time budget (300 ms) to `botPlayer.js`; move the search into a `worker_threads` pool with the serialized `CheckersGame` state. The first is free and is part of Phase 1; the third is out of scope but should be scheduled before plan 05 sends traffic.
- Guest cleanup deleting histories people expected to keep. Today a guest who plays on Monday and returns on Wednesday is a stranger, and their Monday games read `[Expired Guest 12]` in the public log. Phase 2's sliding 7-day expiry and Phase 4's inline upgrade reduce this; the tombstone rename to "Guest" in the log removes the visible artifact. The public `/game/[id]` and `/player/[username]` pages (plan 01) must not link to tombstoned guests.
- Plan 01 must ship `og-image.png` before Phase 3 has anything to unfurl; the marketing layout already references it.
- Plan 03 owns the puzzle route referenced by the post-game line; the line stays hidden until the route exists.
- Plan 06 (share loop) owns per-game OG images; this plan uses the site image for invites.
- Rooms live in memory (`gameRooms` in `server/domain/rooms.js`), so every deploy invalidates every outstanding invite. The SSR page's "expired" state covers it; a persistent invite is out of scope.
- Rewarding bot wins with coins opens a farming path. The daily cap and the existing `MIN_WAGER_MOVES` / `MIN_WAGER_DURATION_MS` checks (`shared/constants.js`) apply; bot games stay `FRIENDLY` so ELO is untouched.
- Audit items that this plan touches but does not fix: rematch UI for humans (audit P2), server deadline for the disconnect countdown (audit P2), pending/rejected feedback on `QuickPlay` and `RoomWaiting` buttons (audit P1). Phase 1 should at least render `$session.pending` on the new buttons so "Play now" cannot look dead.

## Open questions

1. Coins for bot wins: award `COINS_BOT_WIN` with a daily cap (proposed), award nothing and show "practice game" honestly, or award only to registered users to make the upgrade worth something?
2. Guest ELO: keep guests at `FRIENDLY` forever (proposed), or let guest-vs-human games be rated so "earn ELO" on the landing page is true before registration?
3. Fallback behaviour at the deadline: require a tap (proposed) or auto-start the bot game after a further 10 s?
4. First-game difficulty: Medium for everyone (proposed), or Easy for the very first game with a "that was easy — try Marge" prompt?
5. Bot naming: presentation-only display names (proposed) or rename the three accounts' usernames once so replays and player pages match?
6. Landing-page presence line: fetch and show real counts when positive (proposed), or keep the prerendered page fully static?
7. Host auto-ready in a two-human private room: skip the ready step for the host who created the room and start when the friend taps Ready?
8. Guest lifetime: sliding 7 days (proposed), fixed 7 days, or 30 days with the same cleanup rules?
9. Should bot games stay listed as watchable rooms in the Rooms tab (today's behaviour), or be hidden there and shown only in the game log?
10. Should the SSR invite page auto-forward returning users (proposed) or always show the interstitial so the OG page is what everyone sees?
