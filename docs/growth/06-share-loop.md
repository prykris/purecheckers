# 06 — Share loop

Implementation checkpoint, 10 September 2026: see [implementation-status.md](implementation-status.md) and the current operational notes in `docs/puzzles.md` / `docs/share-previews.md`. The following sections retain the original plan and baseline; they are not current absence/completion claims.

11 September revalidation of Phase 3 item 2: the privacy toggle now uses revision-conditional writes and bounded, account-scoped confirmation/read recovery. A late older choice cannot overwrite a newer profile decision. Existing API, page and image privacy enforcement remains covered; browser/platform and production checks are still required. The contract is recorded in [profile-state.md](../profile-state.md#privacy-writes).

Once the site has players, the only distribution channel that costs nothing is players showing other people what they did: a win, a replay, a puzzle solved. Today nothing in the app invites that, and the pages a player could paste into a chat preview as bare text with a broken site image. This plan adds a share action to the result view, the replay page and the profile page, backed by a small server-side image service that renders a 1200x630 card per game, player and puzzle. It pairs with 03 (puzzle images) and 04 (invite links) and depends on 01 for the static fallback image. Against the baseline in 00-overview.md (0 backlinks, 4 clicks) the target is not search traffic but referral traffic: every shared card is a link into the site from a social or messaging surface.

## Current state

| Finding | Consequence | Source |
| --- | --- | --- |
| No share action exists anywhere in the app. The result view offers Lobby and a guest nudge only | A player who wants to show a win has to screenshot and describe it by hand | src/lib/components/GameScreen.svelte (the `.game-over` block inside the GameBoard slot) |
| All three `prisma.game.create` calls discard the returned row. `resultData.gameId` and the `global:game-ended` broadcast carry the in-memory timestamp ID (`this.id`), never the database `Game.id` | The client cannot build the correct `/game/[id]` URL after a game ends. GameLog's live rows call `openReplay(g.id)` with the wrong ID and the replay fetch 404s. This is the open P1 in player-experience-audit.md and it blocks sharing | server/domain/games.js `persistResult` (transactions in the ranked win, ranked draw and friendly branches; `resultData` and `broadcast` after them), server/domain/snapshots.js (`...gameRoom.getState()`), src/lib/components/GameLog.svelte `onGameEnded` |
| `/api/leaderboard/game/:id` returns id, both usernames, result, mode, moveHistory and startedAt. It omits `redEloChange`, `blackEloChange` and `endedAt` | The replay page and a share card cannot show the ELO swing without a schema-aware query | server/routes/leaderboard.js, prisma/schema.prisma `Game` |
| `Game.moveHistory` is the only board record. No final position is stored | The final board must be reconstructed by replaying moves through `CheckersGame.makeMove`, which is what ReplayBoard already does client-side and what an image renderer can do server-side in well under a millisecond per game | prisma/schema.prisma, shared/game.js, src/lib/components/ReplayBoard.svelte `replayTo` |
| Public pages `/game/[id]` and `/player/[username]` are SSR with text-only `og:title`, `og:description`, `og:url`. The layout supplies a site-wide `og:image` pointing at `/og-image.png`, which is not in src/static and returns 404 | Every link preview is either textless or broken. `twitter:card` is already `summary_large_image`, so the head only needs per-page image tags | src/routes/(marketing)/+layout.svelte, src/routes/(marketing)/game/[id]/+page.svelte, src/routes/(marketing)/player/[username]/+page.svelte, src/static/ |
| robots.txt has `Disallow: /game`, a prefix rule that also covers `/game/123` replay pages | Twitterbot and LinkedIn honour robots.txt when fetching card previews; replay links shared to X will show no card even after this plan ships unless plan 01 narrows the rule | src/static/robots.txt |
| Invite links `/join/[code]` live in the `(app)` group with `ssr = false` | No preview at all for invites. Plan 04 owns this; this plan only hands it the image endpoint | src/routes/(app)/+layout.js, src/routes/(app)/join/[code]/+page.svelte |
| No image-generation dependency is installed. The only rasteriser in the project is the browser canvas in BoardView.svelte | Server-side rendering needs a new dependency and a build check on Railway | package.json, src/lib/components/BoardView.svelte `drawPiece` |
| Fonts are already shipped as TTF files | The image service can load the same Poppins faces the site uses without a network fetch or system fontconfig | src/static/fonts/poppins-{400,500,600,700}.ttf |
| Express mounts `/api/*` routers, then static build output, then the SvelteKit handler. Vite proxies only `/api` and `/socket.io` in dev | An image route can live in Express with the shared Prisma client, but its prefix must be added to the dev proxy | server/index.js, server/app.js, vite.config.js |
| GA4 is loaded site-wide (`G-906GR0NE7N`) with no custom events | Share clicks are not measurable until an event is added | src/app.html |
| Guests expire after 24 hours; guests with games are tombstoned to `[Expired Guest N]` | A shared guest profile link dies within a day; a shared replay survives but the names on it change | server/routes/guest.js, server/services/guestCleanup.js |
| Bot opponents are ordinary users named Bot Easy / Bot Medium / Bot Hard | Bot games share through the same code path; the card reads "Chris beat Bot Hard" | server/domain/botRegistry.js |

## Design

### Share surfaces, in priority order

| # | Surface | Trigger | What is shared | Owner |
| --- | --- | --- | --- | --- |
| a | Result view "Share result" | Button in the `.game-over` block, enabled only when `resultData.replayId` is present; otherwise a disabled "Saving replay…" state, and hidden if persistence failed | `https://purecheckers.com/game/<replayId>?utm_source=share&utm_medium=result` with the game share text | This plan |
| b | Replay page share and copy link | Button row under ReplayBoard on `/game/[id]` | Same URL, `utm_medium=replay` | This plan |
| c | Profile share | Button next to the "Challenge" CTA on `/player/[username]`, plus a "Share my profile" entry in the in-app ProfileScreen | `/player/<username>?utm_source=share&utm_medium=profile` | This plan |
| d | Puzzle result share | Plan 03's solved state calls the same share helper | `/puzzle/<date>` with a no-spoiler text | Plan 03 owns the UX; this plan owns `/og/puzzle/<date>.png` |
| e | "Challenge me" from a profile | Deep link that creates or joins a room for that player | Plan 04's invite URL; the profile card only needs to link to it | Plan 04 |
| f | Waiting-room "Share link" (owner requirement, 10 September) | `navigator.share` on the host's waiting room, clipboard fallback | `https://purecheckers.com/join/<code>` with the text "Chris wants to play you at checkers. Tap to join, no account needed:"; the SSR `/join/[code]` page carries `og:image` = `/og/invite/<code>.png` | Plan 04/04a own the button and page; this plan owns the image |

Mechanics, shared by every surface:

- One helper, `src/lib/share.js`, exporting `shareLink({ title, text, url, surface })`. Where `navigator.share` exists and `navigator.canShare({ url })` is true, call `navigator.share({ title, text, url })`. Otherwise copy `text + '\n' + url` with `navigator.clipboard.writeText` and show a two-second "Link copied" state on the button. Do not open platform-specific intent URLs by default; the OS share sheet already lists the user's apps. A secondary "Copy link" is always present because Web Share on desktop Chrome and Firefox is inconsistent.
- The helper fires `gtag('event', 'share', { method, content_type: surface, item_id })` before opening the sheet (`method` is `web_share` or `clipboard`), and `share_cancel` if `navigator.share` rejects with AbortError.
- Share URLs always carry `utm_source=share` and `utm_medium=<surface>` so GA4 attributes the return visit. No `utm_campaign`.
- The result view button must not disturb the result reveal: mount it inside the existing `in:fade` block so it appears with the rest of the result, below the ELO and coin breakdown.

### Dynamic OG image service

Routes, all served by a new Express router `server/routes/og.js` mounted at `/og` in server/app.js before the SvelteKit handler, with `/og` added to the Vite proxy in vite.config.js:

| Route | Source data | Cache policy |
| --- | --- | --- |
| `GET /og/game/:id.png` | `prisma.game.findUnique` with both player usernames; final board from replaying `moveHistory` through `shared/game.js` | Immutable per game. `Cache-Control: public, max-age=31536000, immutable`; strong `ETag` = `"g<id>-t<TEMPLATE_VERSION>"` |
| `GET /og/player/:username.png` | `prisma.user.findUnique` with `elo, peakElo, wins, losses, gamesPlayed, createdAt`; activity strip from the last 12 weeks of games | Changes as the player plays. `Cache-Control: public, max-age=3600`; `ETag` = `"p<id>-n<gamesPlayed>-t<TEMPLATE_VERSION>"`. The page head references `?v=<gamesPlayed>` so crawlers see a new URL when the profile changes |
| `GET /og/puzzle/:date.png` | Plan 03's puzzle record for that date (position, side to move) | Immutable per date, same headers as games |
| `GET /og/invite/:code.png` | The live room from `findRoomByCode` in `server/domain/rooms.js` (same process, no database): host username, `buyIn`, `turnTimer`, `status` | Short-lived, `Cache-Control: public, max-age=60`; `ETag` = `"i<code>-h<hostId>-t<TEMPLATE_VERSION>"`. Rooms live in memory, so a gone room falls back to the static card like any other miss |
| Any error, missing row or invalid parameter | 302 to `/og-image.png` (the static card from plan 01), `Cache-Control: no-store` | Crawlers still get a picture; a 5xx leaves the preview blank and some platforms cache the failure |

Why Express rather than a SvelteKit `+server.js`: the router shares the single Prisma client in server/db.js, imports `shared/game.js` directly (the server already does), and sets headers without going through SvelteKit's fetch. A `+server.js` would have to call `/api/leaderboard/game/:id`, and that API omits ELO deltas.

Rendering options, with the trade-offs as they apply to adapter-node on a Railway hobby instance:

| Option | Assessment |
| --- | --- |
| (c) Serve SVG as `image/svg+xml` | Rejected as the delivered format. X, Facebook, LinkedIn, Slack, iMessage, WhatsApp and Discord do not render SVG `og:image`. SVG is still the right intermediate: hand-written as a template string, and optionally exposed at `/og/game/:id.svg` for in-app previews |
| (d) node-canvas | Rejected. Needs cairo, pango and a compile step; Railway's Node builder does not ship those and the failure mode is a broken deploy |
| (a) sharp | Works (prebuilt libvips, about 30 MB unpacked) and rasterises SVG, but its SVG text goes through librsvg and fontconfig, so Poppins is missing on a minimal container unless fontconfig is configured. Heavier than the job needs |
| (a) `@resvg/resvg-js` | Recommended. Prebuilt napi-rs binary chosen by optionalDependencies (linux-x64-gnu is about 9 MB, no toolchain), font files passed in directly (`fontFiles`, `loadSystemFonts: false`), renders a 1200x630 board card in roughly 15–40 ms warm. Pure Rust, no system deps, no cold start beyond the first `require` |
| (b) satori + resvg | Viable but not worth it here. satori adds a flexbox layout engine (yoga wasm, about 100 ms on first call) for text wrapping the card does not need: usernames are capped at 20 characters and every other string is fixed. Revisit only if the card grows paragraphs |
| (e) Generate at game end and store, or on request | On request. The container disk is ephemeral (docs/deployment.md), there is no S3, and storing 50–80 KB PNGs in Postgres is the wrong use of the hobby plan. Cache in memory instead. As an optimisation, `persistResult` fires a non-awaited warm-up render for RANKED games only, so the first crawler hit after a share is a cache hit |

Pipeline for a game card:

1. Validate `:id` is a positive integer; load the game with both usernames and ELO deltas in one query.
2. `new CheckersGame()` then `makeMove` over `moveHistory`. Games are bounded by the 50-half-move rule and 3-fold repetition; a 200-move game replays in under 1 ms. Read `board` for the final position. If a move fails to apply, render the initial position and log a warning; do not 500.
3. Build the SVG string in `server/og/templates/game.js`. The board is 64 `rect`s plus one `circle` per piece and a small `path` crown for kings, using the site's `--board-light #d4a76a`, `--board-dark #7c5e3c`, red pieces `#ef4444` with a `#b91c1c` stroke, black pieces `#3d3530` with `#1c1917`. No gradients, no filters, no `foreignObject`: resvg supports them but they cost time and add nothing at 1200x630.
4. `new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Poppins' } }).render().asPng()`.
5. Put the buffer in an LRU (`server/og/cache.js`, 200 entries or 16 MB, whichever comes first), set headers, send.

Template layout (1200x630, background `#1c1917`, 48 px padding):

- Left: the final board, 534x534 at x=48 y=48, 2 px `#3d3530` border, red at the bottom (the ReplayBoard orientation).
- Right column from x=630:
  - y=72: result line, Poppins 600, 52 px, `#fafaf9`: "Chris beat Bot Hard" or "Chris and Dana drew". The image does not know who is sharing, so the winner's name is always `#22c55e` and the loser's `#a8a29e`.
  - y=140: reason line, 26 px, `#a8a29e`: "by resignation · 34 moves · Ranked".
  - y=200: two player rows, 36 px, each with a 24 px piece disc, the username and an ELO chip (`+14` green, `-14` red, blank for friendly games).
  - y=440: date line, 22 px, `#78716c`: "10 September 2026".
  - y=560, right-aligned: wordmark "Pure Checkers" 32 px 700 in `#ef4444` and "purecheckers.com" 22 px 500 in `#a8a29e`.
- Player card: 96 px initials disc using the profile page's `hsl(hue, 45%, 35%)` rule, username 56 px, "ELO 1240 · Peak 1288" 30 px, "42 W / 31 L · 58% win rate" 30 px, a 12x7 activity strip (last 12 weeks, 20 px cells, `#22c55e` with opacity scaled by count) at y=380 with "Member since Mar 2026" to its right, wordmark bottom right.
- Puzzle card: the position on the left, "Red to move and win" 52 px, "Daily puzzle · 10 September 2026" 26 px, no move list, no highlighted squares, wordmark. The route reads only `position` and `sideToMove` from plan 03's record; the solution never reaches the template.
- Invite card: the starting position on the left (no game has been played, so the board is decorative and the same for every invite; render it once and reuse the SVG fragment); right column: the host's initials disc using the profile-page hue rule, "Chris wants to play you at checkers" 48 px, "Free · No account needed · Tap to join" 26 px, and, only when the room has a buy-in or a non-default clock, one line "Wager 20 coins · 30 s per move" so the invitee sees the stakes before tapping; wordmark bottom right. When the room is gone, `status` is not `waiting`, or the code is malformed, the route 302s to the static card, so a stale link in a chat still shows the site rather than a broken image. Chat apps fetch the preview once at send time, which is why the 60-second cache is enough and why the card must never depend on state that changes after the send (no player count, no countdown). Email and Snapchat do not unfurl links at all; the share text carries the invite there.
- Every card survives the 1.91:1 and 1:1 crops some apps apply: the board and the result line sit inside the central 630x630.

Timing budget: warm request under 300 ms end to end on the hobby instance. Expected: 5–15 ms Prisma, under 1 ms replay, about 2 ms template string, 15–40 ms resvg, so a cache miss lands near 60 ms and a hit under 5 ms. Log the miss time on the first deploy and record the numbers in this file.

Rate limiting and abuse: `express-rate-limit` is not installed; add a small in-memory token bucket in the router (60 requests per minute per IP, 429 with `Retry-After`, and 10 per minute per IP for misses so a script probing random usernames cannot drive Prisma). Reject usernames outside `^[\w .-]{2,20}$` before touching the database.

Head changes on existing pages (`og:image` must be absolute):

```html
<!-- src/routes/(marketing)/game/[id]/+page.svelte -->
<meta property="og:image" content="https://purecheckers.com/og/game/{g.id}.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:alt" content="Final position of the checkers game between {g.redPlayer} and {g.blackPlayer}. {resultText}." />
<meta name="twitter:image" content="https://purecheckers.com/og/game/{g.id}.png" />
<meta name="twitter:image:alt" content="Final position of the checkers game between {g.redPlayer} and {g.blackPlayer}. {resultText}." />
```

The layout's site-wide `og:image` stays as the default, but parsers disagree about whether the first or last tag wins. The safe route is a `data.ogImage` value: pages that have a card set it in their load function, and the layout emits `og:image` and `twitter:image` from `$page.data.ogImage ?? '/og-image.png'`, so every response carries exactly one image tag. Player page: `/og/player/{player.username}.png?v={player.gamesPlayed}`. Add `og:type` `article` on game pages and `profile` on player pages; keep `website` elsewhere.

### Share-text templates

Text is built client-side from data the surface already has. Keep it under 140 characters before the URL so it survives X's limit with the link attached. No hashtags by default; a single `#checkers` is appended on the puzzle surface only, where it is a discovery term rather than noise. No emoji.

| Surface | Template | Example |
| --- | --- | --- |
| Result, win | `I beat {opponent} at checkers in {moves} moves{eloPart}. Watch the replay:` where `eloPart` is ` (+{elo} ELO)` for ranked games | I beat Bot Hard at checkers in 34 moves (+14 ELO). Watch the replay: https://purecheckers.com/game/812?utm_source=share&utm_medium=result |
| Result, loss | `{opponent} beat me at checkers in {moves} moves. See if you can spot my mistake:` | Dana beat me at checkers in 41 moves. See if you can spot my mistake: https://… |
| Result, draw | `Drew with {opponent} at checkers after {moves} moves. Replay:` | |
| Replay page | `{red} vs {black} — checkers replay, {moves} moves, {resultText}:` | Chris vs Dana — checkers replay, 34 moves, Chris wins: https://… |
| Profile | `My checkers profile: ELO {elo}, {wins}W / {losses}L. Challenge me:` | Links to the profile until plan 04 provides a challenge deep link, then to that |
| Puzzle (plan 03) | `Daily checkers puzzle for {date}: {side} to move and win. Can you find it? #checkers` | Never includes the move count or any hint of the solution |

`title` passed to `navigator.share` is "Pure Checkers" on every surface; the text carries the specifics. The result view speaks in first person because the sharer is a player; the replay page uses third person because the sharer may be a spectator.

### Privacy and abuse

- Usernames are already public on `/player/[username]` and in the global game log, so the cards expose nothing new. Guest names are generated and expire: the profile card for a guest falls back to the static image after 24 hours, and replay cards regenerate with the tombstone name once the cache entry is evicted or the process restarts. Acceptable; note it in the FAQ.
- Chat is never read by any card or share text. The `/og` router queries `Game` and `User` only.
- Add `profilePublic Boolean @default(true)` on `User` (one migration) and a toggle in ProfileScreen. When false: `/api/leaderboard/player/:username` returns 404, the player page 404s, the player card falls back, the leaderboard still lists the name (it is a ranking, not a profile), and replay cards still show the name (the game is the opponent's record too). Say all of that in the toggle copy.
- Emit `<meta name="robots" content="noindex">` on player pages when `profilePublic` is false so search de-indexes them.
- The image endpoint is unauthenticated by design (crawlers cannot log in). Rate limit as above, render no user-supplied text other than the stored username, and escape it for XML in the template. Usernames pass the registration regex, but escape anyway.
- Nothing from the URL is rendered; every value on the card comes from the database row for that ID.

## Plan

### Phase 0 — replay-ID plumbing (effort: 1 day)

This is a blocker. Until the client knows the database `Game.id` of the game it just finished, every share URL from the result view would be wrong.

1. server/domain/games.js `persistResult`: capture the created row in all three branches (`const [, , saved] = await prisma.$transaction([...])` for the ranked win and draw branches; `const saved = await prisma.game.create(...)` for friendly). Set `this.replayId = saved?.id ?? null` and `this.persistError = err?.message ?? null` in the catch blocks.
2. Add `replayId` and `persistStatus` (`'saved' | 'failed'`) to `this.resultData` and to `getState()`. The snapshot in server/domain/snapshots.js spreads `getState()`, so player and spectator views receive it with no further change.
3. Change the `global:game-ended` broadcast to `id: this.replayId` and skip it when `replayId` is null (no row exists, so GameLog must not offer a replay). This closes the audit's P1 for GameLog.
4. Tests: extend tests/gameSocket.test.js so a finished bot game's `resultData.replayId` equals the `Game.id` served by `/api/leaderboard/game/:id`, and the `global:game-ended` payload carries the same value. Add a case where `prisma.game.create` is stubbed to throw and assert `persistStatus === 'failed'` and no broadcast.
5. Extend `/api/leaderboard/game/:id`, `/games` and `/player/:username` with `redEloChange`, `blackEloChange` and `endedAt`. Update tests/leaderboard.test.js.

Done when a player finishing a bot game sees `resultData.replayId` in the snapshot and GameLog opens the correct replay for a live-announced game.

### Phase 1 — share buttons and Web Share API (effort: 1 day)

1. Create src/lib/share.js with `shareLink` and `buildShareText(surface, data)`, unit-tested in tests/share.test.js (templates, URL building with utm parameters, clipboard fallback when `navigator.share` is absent).
2. GameScreen.svelte: add "Share result" and "Copy link" to the `.game-over` block. Derive the state from `gameOverData.persistStatus`: saved → enabled; missing → "Saving replay…" disabled; failed → hidden, with the result itself still shown.
3. src/routes/(marketing)/game/[id]/+page.svelte: add a share row below ReplayBoard using the same helper (marketing pages hydrate, so `navigator.share` is available).
4. src/routes/(marketing)/player/[username]/+page.svelte and src/lib/components/ProfileScreen.svelte: add "Share profile".
5. GA4: `share` and `share_cancel` events as specified; verify once in GA4 DebugView.

Done when a phone user can tap Share on a finished game and see the OS share sheet with the correct replay URL, and a desktop user sees "Link copied".

### Phase 2 — OG image service for games (effort: 2 days)

1. Add `@resvg/resvg-js` to dependencies. Confirm the Railway build downloads the linux-x64-gnu binary (check the deploy log for the optional dependency). If the builder uses musl, allow that optional target; do not add a compile step.
2. Create server/og/render.js (SVG to PNG, Poppins files from src/static/fonts loaded once at startup), server/og/cache.js (LRU by key with a byte budget), server/og/board.js (`finalPosition(moveHistory)` using shared/game.js) and server/og/templates/game.js (SVG builder; the board helper is reused by the puzzle template).
3. Create server/routes/og.js with `GET /game/:id.png`, headers, `If-None-Match` handling (304), rate limiter and fallback redirect. Mount at `/og` in server/app.js; add `'/og': 'http://localhost:3001'` to the Vite proxy.
4. Warm-up: in `persistResult`, after `resultData` is set, `if (this.mode === 'RANKED' && this.replayId) renderGameCard(this.replayId).catch(() => {})`, not awaited.
5. Introduce `data.ogImage` in the marketing layout and set it from the game page's load function (coordinate with plan 01, which owns the layout tags).
6. Tests: tests/og.test.js renders a known move list and asserts the PNG signature and 1200x630 in the IHDR chunk, a 302 for an unknown ID, a 400 for `abc`, a 304 on a matching ETag, and the ELO chip text in the intermediate SVG. Snapshot the SVG string, not the PNG.
7. Validate one real game URL with the Facebook Sharing Debugger, the X Card Validator and the LinkedIn Post Inspector; record the results in this file.

Done when pasting a replay link into Slack, WhatsApp and X shows the board card, and a cache miss logs under 300 ms on Railway.

### Phase 3 — player and puzzle images (effort: 1 day)

1. server/og/templates/player.js and `GET /og/player/:username.png`, with the activity strip built from the games-per-day query the profile API already runs (move that query into server/services/playerStats.js and share it).
2. `profilePublic` migration, enforcement in the API, page and route, ProfileScreen toggle, `noindex` when private.
3. server/og/templates/puzzle.js and `GET /og/puzzle/:date.png` reading plan 03's record. If plan 03 has not shipped, land the template against a fixture position and leave the route on the fallback until the puzzle table exists.
3a. server/og/templates/invite.js and `GET /og/invite/:code.png` reading the in-memory room; validate the code against the same `^[A-Z2-9]{6}$` rule the join path uses; 302 to the static card when the room is missing or not waiting. Ship this with plan 04 Phase 3 (the SSR `/join/[code]` page) rather than waiting for the rest of Phase 3, because the invite link is the first thing players share.
4. Player page head: `ogImage` with `?v={gamesPlayed}`, `og:type` `profile`, alt text.

Done when a profile link previews with the stats card and a private profile previews with the static site card.

### Phase 4 — in-app share prompts (effort: 1 day)

1. After a ranked win with a positive ELO delta, or any win against Bot Hard, the result view promotes Share to primary styling and adds one line ("Show someone this game"). Never a modal; the overlay priority in player-experience-audit.md stands.
2. When `coinBreakdown[myColor]` contains a `milestone` label (from `checkMilestones` in server/services/vault.js, driven by `ELO_MILESTONES` in shared/constants.js), show "You reached {name}" with a share whose text is `I just hit {name} ({elo} ELO) on Pure Checkers:` and the profile URL.
3. Frequency cap in localStorage: at most one prompt per day per surface, never on a loss.
4. GA4 event `share_prompt_shown` with `reason` (win, milestone) so the prompt's click-through can be compared against the plain button.

Done when the prompt appears once after a milestone and not again that day.

## Success metrics

| Metric | Where | 30 days after Phase 2 | 90 days |
| --- | --- | --- | --- |
| `share` events per 100 finished games | GA4 event report divided by the games count from `/api/leaderboard/games` | 3 | 6 |
| Sessions with `utm_source=share` | GA4 acquisition by source/medium | 20 | 150 |
| Sessions with a social or messaging referrer (t.co, reddit, facebook, whatsapp, discord) and no utm | GA4 referral report | 10 | 60 |
| Replay page views per finished game | GA4 page views on `/game/*` divided by games | 0.3 | 0.6 |
| k-factor proxy: new sessions with `utm_source=share` per `share` event | The two numbers above | 0.3 | 0.5 |
| `/og/*` cache-miss render time | Server log line per miss | p95 under 300 ms | same |
| Card validators | Facebook, X, LinkedIn debuggers | All three show the image on a game URL | same |

## Dependencies and risks

- Plan 01 must ship the static `/og-image.png` (the fallback target) and narrow `Disallow: /game` in robots.txt to the app screen only (`Disallow: /game$` and `Disallow: /game?`); otherwise Twitterbot will not fetch replay pages at all. The same applies to `/join/`: X and LinkedIn honour robots.txt when building link cards, so `/join/[code]` must stay fetchable (noindex by meta, not by robots) and `/invite/` is the path to disallow. Plan 01's block is corrected accordingly.
- Plan 01 owns the layout-level image tags; the `data.ogImage` change in Phase 2 must land on whatever plan 01 leaves there.
- Plan 03 supplies the puzzle record shape (`date`, `position`, `sideToMove`) that Phase 3 reads. Plan 04 supplies the challenge deep link the profile card should eventually point to.
- Phase 0 is a hard prerequisite for Phase 1. Until it lands, the result view has no correct URL to share.
- Native binary on Railway: `@resvg/resvg-js` ships prebuilt binaries as optional dependencies, so the risk is a lockfile generated on Windows that omits the Linux target. Mitigation: check that `@resvg/resvg-js-linux-x64-gnu` is in package-lock.json before deploying; the Phase 2 test fails loudly if the binary cannot load.
- CPU on the hobby instance: a burst of crawler fetches after a popular share is a few dozen renders at 40 ms each. The LRU absorbs repeats and the ranked warm-up moves the cost off the crawler path. If p95 exceeds the budget, simplify the template before adding infrastructure.
- Crawlers cache images by URL, some for weeks. Template changes must bump `TEMPLATE_VERSION` (part of the ETag); if the change matters for links already shared, also append `?t=<version>` to the head so the URL changes. Player images already carry `?v=<gamesPlayed>`.
- Memory: 200 cached PNGs at 60 KB is 12 MB; the byte budget in cache.js caps it regardless of count.
- Guest name churn: replay cards can show `[Expired Guest 123]` once regenerated. Acceptable for now; freezing names into the Game row is a schema change a later plan can take.
- Abuse of the public image endpoint is bounded by the rate limiter and the input regex; there is no user-controlled text beyond the stored username.

## Open questions

1. Should the result-view text name the opponent when the opponent is a human guest with a generated name? Proposed: yes; guest names are already public in the game log.
2. Should bot games be shareable from the result view, or only ranked human games? Proposed: all games. A win over Bot Hard is the most likely first share for a new player, and the card says it was a bot.
3. Does the private-profile toggle also hide the player from the public leaderboard? Proposed: no, but confirm before writing the toggle copy.
4. Is an `.svg` variant of each card worth exposing for in-app previews (for example inside the share confirmation)? It costs nothing server-side; the question is whether the UI wants it.
5. When plan 04 ships challenge links, should the profile card's CTA change to the live room code, or stay generic so the image stays cacheable for an hour? Proposed: stay generic.
6. Should ranked warm-up renders be skipped when the instance is under load (for example when the socket tick loop is behind)? Proposed: no gate for now; measure first.
