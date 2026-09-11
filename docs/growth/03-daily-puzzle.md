# 03 — Daily puzzle

Implementation checkpoint, 10 September 2026: see [implementation-status.md](implementation-status.md) and the current operational notes in `docs/puzzles.md` / `docs/share-previews.md`. The following sections retain the original plan and baseline; they are not current absence/completion claims.

Owner decision: include the one-coin daily reward. The implemented policy awards a registered human once for an eligible solve of today's UTC puzzle; archive puzzles earn no coins. Revealing before solving disqualifies the attempt. The attempt, wallet credit and ledger entry commit together, and retries cannot award another coin.

Recovery audit, 11 September: the [requirement audit](requirement-audit.md) now maps current API/controller/recovery evidence and explicit remaining page/publication gaps. Server confirmations override conflicting local solves, sync errors have bounded retry recovery, reward writes share retirement locking, and failed midnight reloads remain retryable. The actual controller completes all 31 local buffer puzzles; this is not production publication or full-plan acceptance.

Operations checkpoint, 11 September: [puzzle-operations.md](../puzzle-operations.md) now defines the read-only status and maintenance commands, shared calendar coverage, exit codes and proposed Railway service. Reverification retains assigned URLs and fills holes rather than shifting dates as the original plan proposed. Production import, host activation and monitoring are not complete.

One new indexable page per day, generated offline from the existing minimax engine, published at `/puzzle/YYYY-MM-DD` inside the SSR marketing group, and solvable in the browser without a socket. Against the baseline in 00-overview.md (6 indexed pages, 60 impressions in 3 months, nothing to come back for) this is the only plan that compounds on its own: after 90 days the site has 90 more pages targeting "checkers puzzle" long-tail queries, a reason to return every day, and a spoiler-free share object that plan 05 and plan 06 can point at. It does not depend on having players, because the first puzzles come from bot self-play.

## Current state

| Finding | Consequence | Source |
| --- | --- | --- |
| The rules engine is complete and isomorphic: 8x8 board as `board[row][col]` of `{color, queen}`, forced captures, multi-jump chains via `chainPiece`, flying kings, backward man captures, promotion ends a chain, `clone()`, `_boardHash()` (64 chars + side to move) | Move generation, chain handling and position hashing can be reused as-is for a generator and for client-side validation | shared/game.js |
| Three copies of the same depth-limited minimax exist (ColonelBot, bot player, move analysis). All of them finish capture chains with `moves[0]` instead of branching, score a finished game with material only (`evaluate`), and have no quiescence | The search cannot tell "wins the game" from "wins a man", can mis-score multi-jump branches, and is horizon-prone in a forced-capture game. Good enough for a bot, not for proving a puzzle has one solution | shared/game.js `_finishChain`, server/services/botPlayer.js, server/services/moveAnalysis.js |
| `clone()` structured-clones `moveHistory` on every node. Measured: 62 us per clone with a 60-move history versus 2.8 us with an empty one; a depth-6 root search takes ~350 ms at ~30k nodes/s, ~72k nodes/s when the history is blanked | The generator must blank `moveHistory` in search clones; the live bots are unaffected | shared/game.js `clone()` |
| Bot search runs synchronously on the socket server's event loop, scheduled with `setTimeout`; analysis is the same | Anything that searches thousands of positions must run in another process. There is no job runner, no `scripts/` directory, no worker pool | server/domain/games.js `scheduleBotMoveIfNeeded`, server/index.js |
| Bot difficulties are search depths 2 / 4 / 6 | Self-play between registry depths gives graded, realistic blunders for puzzle sourcing | server/domain/botRegistry.js |
| Persistence is PostgreSQL through one Prisma client. There is no puzzle model. `Game.moveHistory` stores every finished game as a move list | Positions from real games can be replayed later with `CheckersGame`; today the log holds two bot games, so real games are not a source yet | prisma/schema.prisma, server/routes/leaderboard.js `/game/:id` |
| Guests are real `User` rows (`isGuest`, 24 h `guestExpiresAt`, JWT with `isGuest`). Expired guests with zero games are hard-deleted hourly | Any table referencing `User` from a guest must use `onDelete: SetNull` or the cleanup job starts failing. Visitors who only read marketing pages have no user row at all | server/routes/guest.js, server/services/guestCleanup.js, server/middleware/auth.js |
| The `(app)` group is `ssr = false`; the `(marketing)` group is SSR and mostly `prerender = true`. `/game/[id]` and `/player/[username]` already use `+page.server.js` that fetches the site's own API | The pattern for a dynamic, indexable, board-bearing page exists and needs no socket | src/routes/(app)/+layout.js, src/routes/(marketing)/game/[id]/+page.server.js |
| `ReplayBoard.svelte` renders the board as a CSS-grid of `div`s from a `CheckersGame` instance (SSR-safe). `BoardView.svelte` is a canvas sized from `window`, Svelte 4 syntax, event-dispatcher coupled to GameScreen | ReplayBoard is the right base for a puzzle board; BoardView is not. Neither loads an arbitrary position; `restoreGame()` does | src/lib/components/ReplayBoard.svelte, src/lib/components/BoardView.svelte, src/lib/boardSnapshot.js |
| `src/lib/api.js` reads the JWT from `localStorage.checkers_token` and marketing pages share the origin | A puzzle page can call `/api/*` with the player's token if they have used the app in this browser, with no session bootstrap | src/lib/api.js, src/lib/stores/user.js |
| Coins: ranked/bot wins are minted with `awardCoins`; the 2-coin daily bounty is paid from the vault with a pending-payout fallback; `CoinReason` has no puzzle value | A puzzle reward has two established mechanisms to copy | server/services/coins.js, server/services/vault.js, shared/constants.js |
| The sitemap is a static file with six URLs; robots.txt disallows `/game` (which also hides `/game/[id]`) but not `/puzzle` | Puzzle URLs will need the dynamic sitemap from plan 01; the `/puzzle` prefix is safe | src/static/sitemap.xml, src/static/robots.txt |
| The marketing layout emits hreflang `en`/`es`/`x-default` for `/` on every page | Puzzle pages would declare the home page as their alternate unless plan 01 scopes those tags | src/routes/(marketing)/+layout.svelte |
| The FAQ describes "English draughts" but the engine plays flying kings and backward man captures | Puzzle solutions will look illegal to a reader who trusts the FAQ. Puzzle pages must state the house rules; the FAQ needs correcting | src/routes/(marketing)/faq/+page.svelte line 35 |

## Plan

### Design — puzzle generation

**Sources.** Phase 1 uses self-play only: random opening (first 6 plies random), then registry depths playing each other (2 v 4, 4 v 6, 2 v 6) with the weaker side making a random move 15% of the time. A prototype of exactly this scanned 632 unique positions from 12 games in 44 s on a desktop and produced 40 candidates that pass the selection filter below at depth 6, of which 30 had a quiet first move, 5 a multi-jump solution and 8 a forced win. Yield is not the constraint; verification cost is. Phase 2 adds real games: replay `Game.moveHistory` with `CheckersGame`, scan every position after ply 8, and record `sourceGameId` so the page can say "from a game between X and Y" and link to `/game/:id`.

**Search.** Do not change ColonelBot or botPlayer (that would change bot strength and ratings). Add a generator-only search in `shared/puzzleSearch.js` that wraps `CheckersGame`:

- `fullMoves(game)` enumerates complete turns, branching at every chain continuation instead of taking `moves[0]`. A puzzle "move" is the whole chain.
- Terminal scores: `+(1000 - ply)` when `winner === color`, `0` for a draw, `-(1000 - ply)` otherwise, so a win by immobilisation outranks winning a man and shorter wins outrank longer ones.
- Quiescence: when depth reaches 0 and the side to move has captures, keep searching captures only (captures are compulsory, so this is cheap and removes the worst horizon effects).
- Clones blank `moveHistory` and `positionHistory` (2.4x faster on the same hardware). Draw-by-repetition and the 50-half-move rule are irrelevant inside a short tactical line.
- Iterative deepening with a node budget so verification never runs unbounded.

**Selection criterion.**

```
candidate(position P, side S):
  legal = fullMoves(P)
  if legal.length < 3: reject            # forced or near-forced; 21% of scanned positions
  if pieces(P) < 5 or ply(P) < 8: reject
  scores = [(m, search(m.after, SCAN_DEPTH=6)) for m in legal], sorted desc
  best, second = scores[0], scores[1]
  gap  = best.score - second.score       # uniqueness margin
  gain = best.score - evaluate(P, S)     # the move must achieve something
  if gap < 1.5 or gain < 1.5: reject     # 1.0 = one man; kings are 5
  if best.score < -3: reject             # "least bad" moves make bad puzzles
  line = principalVariation(best)        # player, reply, player, ...
  return {line, gap, gain, legal: legal.length}

verify(candidate):
  L = plies(line)
  for each player decision point in line, with depth = max(L + 2, 8) and quiescence:
    re-score every legal move; require the line's move to be unique best with gap >= 1.5
    require every opponent reply in the line to be that side's best defence (minimax already does this;
      also require that no opponent reply keeps the score below the threshold, or the line is cooked)
  reject if any decision point has two moves within 0.5 (the interactive validator would need to accept both)
  reject if positionHash(P) or positionHash(mirror(P)) already exists in Puzzle
  return verified line, verifiedDepth
```

The gap and gain units are the engine's own (`evaluate`: man 1, king 5, small positional bonuses), so a gap of 1.5 means "wins at least a man more than the next-best move". Forced wins score near 1000 and pass automatically.

**Difficulty.** Start from the number of player moves in the line (1 = easy, 2 = medium, 3+ = hard). Move one level up for a quiet first move, one up for a sacrifice (the first move loses material at ply 1 and regains it later), one down when `legal <= 3` (a guess is a third of the way there). Buckets `EASY`, `MEDIUM`, `HARD`. Publishing rotates E, M, M, H, E, M, H across the week so the archive has a predictable mix. For the first 30 puzzles, prefer single-move multi-jump captures and captures that end in a promotion: they are the most legible for a visitor who has never solved a checkers puzzle.

**Theme tagging**, derived from the verified line, stored as a string so new themes need no migration: `multi-jump` (first move has 2+ hops), `shot` (sacrifice, see above), `breakthrough` (a player piece promotes inside the line), `king-trap` (a captured piece is a king), `immobilise` (line ends with the opponent having no legal move), `quiet-move` (first move is not a capture and the material swing arrives later). One theme is primary; extras go in an array. Each primary theme has a hand-written 80–120 word explanation reused on every page with that theme (six paragraphs, written once).

**Buffer.** Puzzles are assigned a date at generation time: the next date after the latest existing row. The generator tops up until `max(date) >= today + 30`, so publishing never waits on the generator; a broken cron shows up as a shrinking buffer, not a missing page. A nightly pass re-verifies the next 7 days at `verifiedDepth + 2` and deletes any that fail (the rows behind it shift forward by re-dating, which is safe because unpublished dates have never been linked).

### Design — scheduling and publishing

- `scripts/generate-puzzles.js` (new directory) with flags `--target-buffer 30`, `--max-minutes 20`, `--seed`, `--dry-run`, `--source self-play|games`. It uses `server/db.js`, exits when done, and prints one summary line per puzzle written. `npm run puzzles:generate` in package.json.
- Where it runs, in order of preference: (1) a second Railway service from the same repo with a cron schedule (`0 2 * * *`) and start command `node scripts/generate-puzzles.js`; Railway cron requires the process to exit, which it does. (2) The developer's machine against the production `DATABASE_URL` once a month, which is what phase 1 should do before automating anything. (3) A fallback in-process timer beside `startGuestCleanup()` in server/index.js that spawns the script as a child process with `os.setPriority(child.pid, 19)` and a node budget. Never run the search on the socket server's own thread.
- Publish rule: the puzzle dated D is visible from 00:00 UTC on D. `todayUtc()` is one helper in `server/routes/puzzle.js`; the API returns 404 for any later date, so the buffer cannot be scraped. Yesterday and earlier stay at their URLs forever with the solution shown. The page states the UTC date so an evening visitor in the Americas is not confused by "tomorrow's" puzzle.
- Cache headers: past puzzles are immutable, `Cache-Control: public, max-age=86400`; today's and the hub, `max-age=300`. Set via `setHeaders` in the SvelteKit loads and `res.set` in the routes.

### Design — data model

Add to prisma/schema.prisma and create one migration with `npm run db:migrate:dev` (tests run `migrate deploy`, so a schema change without a migration fails the suite).

```
model Puzzle {
  id               Int       @id @default(autoincrement())
  date             DateTime  @unique @db.Date        // publish date, assigned at generation
  positionHash     String    @unique                 // CheckersGame._boardHash()
  position         Json                              // { board: 8x8 of {color,queen}|null, currentPlayer }
  solution         Json                              // full line: [{fromRow,fromCol,toRow,toCol,captured,promoted}, ...]
  sideToMove       String                            // 'red' | 'black', denormalised for titles and queries
  difficulty       PuzzleDifficulty
  theme            String                            // primary theme key
  themes           String[]                          // extras
  solutionPlies    Int
  legalMoves       Int
  scoreGap         Float
  verifiedDepth    Int
  commentary       Json?                             // { position, solution, alternatives } text blocks
  sourceGameId     Int?
  generatorVersion String
  createdAt        DateTime  @default(now())
  attempts         PuzzleAttempt[]
}

model PuzzleAttempt {
  id        Int      @id @default(autoincrement())
  puzzleId  Int
  userId    Int?                                     // null for anonymous marketing visitors
  visitorId String?                                  // random id kept in localStorage, for solve-rate stats
  solved    Boolean
  attempts  Int
  hintUsed  Boolean  @default(false)
  timeMs    Int?
  rewarded  Boolean  @default(false)
  createdAt DateTime @default(now())
  puzzle Puzzle @relation(fields: [puzzleId], references: [id])
  user   User?  @relation(fields: [userId], references: [id], onDelete: SetNull)
  @@unique([puzzleId, userId])
  @@index([puzzleId, visitorId])
}

enum PuzzleDifficulty { EASY MEDIUM HARD }
```

`onDelete: SetNull` is required because server/services/guestCleanup.js hard-deletes guests with `gamesPlayed === 0`; without it the hourly job throws P2003 on the first guest who solved a puzzle. Guests are identified exactly as everywhere else: their JWT (`req.userId`, `req.isGuest` from verifyToken). Visitors with no token get a `visitorId` generated client-side; it is for statistics only and grants nothing.

### Design — routes and SEO

API, in a new `server/routes/puzzle.js` mounted at `/api/puzzle` in server/app.js next to the leaderboard router:

- `GET /api/puzzle/today` and `GET /api/puzzle/:date` (`^\d{4}-\d{2}-\d{2}$`, 404 if future or missing). Returns the puzzle, `prev`/`next` dates (next only if published), and aggregate stats (solve count, first-try rate).
- `GET /api/puzzle?limit=30&before=YYYY-MM-DD` for the hub and archive: date, theme, difficulty, side to move, solve rate.
- `POST /api/puzzle/:date/attempt` with an `optionalToken` middleware added to server/middleware/auth.js (verifyToken currently 401s without a header). Body `{ solved, attempts, timeMs, hintUsed, visitorId }`. Upserts on `[puzzleId, userId]`; anonymous rows insert once per visitorId. Awards the coin (below) only for today's date, registered non-guest users, `solved === true`, `rewarded === false`.

Pages, all in the `(marketing)` group with no `prerender` export (they read the database):

- `/puzzle` — `src/routes/(marketing)/puzzle/+page.server.js` fetches today and the last 30. The page embeds today's board, the streak, a 200-word evergreen section ("How the daily puzzle works", house rules: captures compulsory, men capture backwards, kings fly, promotion ends a chain) and an archive list. Canonical `https://purecheckers.com/puzzle`. Title "Daily Checkers Puzzle — Pure Checkers".
- `/puzzle/YYYY-MM-DD` — `src/routes/(marketing)/puzzle/[date]/+page.server.js` + `+page.svelte`. Title `Checkers Puzzle for 10 September 2026 — Red to move and win`. Meta description: `A {difficulty} {theme label} puzzle: {Red} to move. Find the only move that {wins a man | wins a king | wins the game}. Solve it on the board, then see the solution.` Canonical to itself. `<link rel="prev">`/`rel="next">` to the adjacent dates. `og:title` = title, `og:description` = meta description, `og:image` = the per-puzzle image from plan 06 at `/og/puzzle/YYYY-MM-DD.png` showing the position only (never the solution); until plan 06 ships, the site default. No hreflang on puzzle pages (English only), which requires plan 01 to move the layout's hreflang tags out of the shared layout.
- JSON-LD: `WebPage` (name, datePublished = the puzzle date, isPartOf the site) plus `BreadcrumbList` (Home > Daily Puzzle > date). Do not use `Quiz` or `Question`/`Answer`: Google's Q&A rich results are limited to specific site types and a hidden answer is exactly what a puzzle has to keep hidden for a day. Revisit `Quiz` only if Google's guidelines change.
- Internal links: "Daily Puzzle" under Explore in the sidebar, the mobile menu and the footer of `src/routes/(marketing)/+layout.svelte`; a "Today's puzzle" teaser on the home page after `#how-to-play` with a small inline-SVG board (server-rendered, no image pipeline needed); every strategy article from plan 02 links to `/puzzle`; each puzzle page links its theme to the matching plan 02 article when one exists.
- Sitemap: plan 01's dynamic `sitemap.xml` endpoint adds `/puzzle` (changefreq daily, lastmod today) and every `Puzzle` with `date <= today` as `/puzzle/YYYY-MM-DD` with `lastmod` = date + 1 day (when the solution was revealed). Nothing else in the sitemap design changes.
- Notation for text: chess-style `a1`–`h8` with `a1` = `board[7][0]` (dark, red's bottom-left). Kept in `src/lib/puzzle/notation.js` and used by the generator for commentary, so server and client agree.

### Design — solving UX

New `src/lib/components/PuzzleBoard.svelte`, built from ReplayBoard's grid (not BoardView): the position renders as real HTML on the server with an `aria-label` per piece ("red king on c3"), and pointer handling ported from BoardView's `pointerDown`/`pointerUp` logic is attached on hydrate. The position loads with `restoreGame(new CheckersGame(0), puzzle.position)` (turn time 0 = no clock). Highlights come from `getValidMovesFor`; the local `makeMove` handles chain continuation through `chainPiece`.

- Header: "Red to move and win", difficulty pill, theme pill, date, the house-rules link.
- Tap-to-select then tap-to-move, or drag; both dispatch the same move, as in the app.
- Validation is client-side against `puzzle.solution`: the attempted full move (all hops) must equal the next player move in the line. Right: the piece settles, the opponent's reply from the line auto-plays after 400 ms, and the next decision point opens or the puzzle completes. Wrong: the piece snaps back, the attempt counter increments, "Not that one — try again". A wrong first hop of a multi-jump is judged when the chain ends, not on the first hop.
- Hint: highlights the piece to move (attempt counter +1, `hintUsed`). Reveal: plays the whole line with the same 220 ms slide ReplayBoard uses and shows the commentary; marks the puzzle unsolved for the streak.
- Streak: `localStorage.checkers_puzzle` holds `{ history: { date: { solved, attempts, hintUsed } }, streak, lastSolved }`; the day boundary is UTC, the same as publication. With a token present the page also POSTs the attempt and, on login, uploads any local history once; the server streak is derived from consecutive solved dates in `PuzzleAttempt`. Note that the daily bounty uses server-local midnight (`setHours(0,0,0,0)` in vault.js), a different boundary; puzzles do not inherit that.
- After solving or revealing: "Play a real game" CTA to `/auth` (plan 04's bot-first flow), prev/next links, and Share.
- Share, Wordle-style and spoiler-free: `Pure Checkers puzzle for 10 Sep 2026 — solved in 2 tries. Can you find the move? https://purecheckers.com/puzzle/2026-09-10`. `navigator.share` when available, else clipboard with a "Copied" toast; GA4 event `puzzle_share`. The text never names a square.
- Yesterday's page shows the solution and commentary by default with the board still playable; today's page hides the commentary until solved or revealed.

**Spoilers.** The full solution is in the page payload for every date, including today, so the board works offline and needs no round trip. It is not rendered as text until the day has passed or the visitor solves or reveals, so neither a crawler nor a share preview shows it. View-source cheating is accepted: there is no puzzle leaderboard in this plan. If one is added later, move validation into `POST /attempt` and ship only the hint square and a hash for today.

**Text per page (thin-content defence).** Each page needs about 150 words that exist nowhere else. Sources: the theme paragraph (shared per theme), a generated position summary (material count, king count, which side is pressing), a generated solution narration from the line in notation ("Red jumps c3xe5, taking the man on d4; Black must recapture f6xd4; now b2-c3 ..."), and "why the obvious move fails" from the two best alternatives and what they lose, which the generator already has from the root scores. Store all of it in `Puzzle.commentary` at generation time. The generator writes drafts; five minutes of hand-editing per puzzle is the cheapest way to keep pages from reading as templates, and the buffer gives 30 days to do it.

### Design — economy hook

Recommend one coin for the first solve of today's puzzle, registered non-guest accounts only, once per user per puzzle, minted with `awardCoins` the way `COINS_BOT_WIN` is (not from the vault, which is empty on a fresh database and would only queue pending payouts). Add `PUZZLE_SOLVE_COINS = 1` to shared/constants.js and `PUZZLE_SOLVE` to `CoinReason`. Scale check: a ranked win mints 10, a bot win 5, the daily bounty is 2; a maximum of one coin per account per day cannot move the closed economy, and archive solves earn nothing, so a new account cannot farm 30 coins on day one. Guests get nothing, which is consistent with guests holding zero coins everywhere else. If the owner prefers no new faucet at all, the streak alone is the retention hook and the reward can be dropped without touching the model.

### Phase 1 — generator, search wrapper, model (effort: 3 days)

1. `shared/puzzleSearch.js`: `fullMoves`, terminal scoring, quiescence, budgeted iterative deepening, `principalVariation`, `mirror`, `positionHash`. Tests in `tests/puzzleSearch.test.js`: a chain where `moves[0]` is the wrong branch, a win by immobilisation with equal material, a known two-move shot.
2. Prisma: `Puzzle`, `PuzzleAttempt`, `PuzzleDifficulty`, `CoinReason.PUZZLE_SOLVE`, migration.
3. `scripts/generate-puzzles.js`: self-play, selection, verification, difficulty, themes, notation, commentary drafts, dedupe, date assignment, top-up loop, flags. `npm run puzzles:generate`. A `--dry-run --seed 1` test asserts a deterministic first puzzle.
4. Run locally against the production database until the buffer holds 30 puzzles; eyeball every position on a local page before phase 2 ships. Done: 30 rows, none with a second solution at `verifiedDepth`.

### Phase 2 — API and SSR pages (effort: 2 days)

1. `server/routes/puzzle.js`, `optionalToken` middleware, mount in server/app.js. Supertest coverage in `tests/puzzle.test.js`: today, a past date, a future date (404), malformed date (400), attempt upsert, guest deletion leaves the attempt row.
2. `src/routes/(marketing)/puzzle/+page.server.js`, `+page.svelte`, `[date]/+page.server.js`, `[date]/+page.svelte` with head tags, JSON-LD, prev/next, static board render (no interactivity yet), commentary shown for past dates. Done: a past puzzle page validates in Rich Results Test and the rendered HTML contains the board and 150+ words without JavaScript.

### Phase 3 — interactive board (effort: 2 days)

1. `src/lib/components/PuzzleBoard.svelte` with select/drag, chain handling, right/wrong feedback, hint, reveal with the replay slide, reduced-motion respect, keyboard selection (the P2 accessibility finding in docs/player-experience-audit.md applies here too).
2. Wire validation against `puzzle.solution`, opponent auto-reply, completion state. Done: every puzzle in the buffer is solvable by following its own line, checked by a vitest that drives the validator programmatically.

### Phase 4 — streaks, attempts, sharing, coins (effort: 1.5 days)

1. `src/lib/puzzle/streak.js` (localStorage, UTC boundary), `share.js`, POST attempt with optional token, one-time history upload on login, coin award in the route, GA4 events `puzzle_solve`, `puzzle_reveal`, `puzzle_share`.

### Phase 5 — hub, navigation, sitemap, images (effort: 1 day + plan 06)

1. Sidebar, mobile menu, footer and home-page teaser links; the home-page inline-SVG board.
2. Sitemap entries through plan 01's endpoint; OG images through plan 06's renderer; retire the site-default `og:image` on puzzle pages when it lands.
3. Correct the FAQ rules answer (or hand it to plan 02) so the puzzle pages and the FAQ describe the same game.

Total: about 10 developer-days.

## Success metrics

| Metric | Where | 30 days | 90 days |
| --- | --- | --- | --- |
| Indexed `/puzzle/*` pages | Search Console, Pages report filtered by path | 20 | 80 |
| Impressions on `/puzzle/*` | Search Console, Performance, page filter | 100 | 1,000 |
| Clicks on `/puzzle/*` | Same | 10 | 100 |
| Returning visitors on `/puzzle` | GA4, Retention, filter landing page | 15% of puzzle sessions | 25% |
| Share clicks | GA4 event `puzzle_share` / `puzzle_solve` | 3% | 5% |
| Solve rate per puzzle | `PuzzleAttempt`, weekly query | 40–75% (retune difficulty outside that band) | Same |
| Buffer size | Generator log | Never below 14 days | Same |

## Dependencies and risks

- Plan 01 must ship the dynamic sitemap and scope the layout hreflang tags before puzzle pages are worth crawling; plan 06 provides per-puzzle OG images; plan 05's launch post should link to `/puzzle`, so the buffer must exist before that post.
- Engine correctness. A puzzle with two solutions, or one whose "solution" loses to a reply beyond the horizon, is embarrassing and hard to retract once shared. Mitigations: never trust the depth-6 scan, verify at `max(L + 2, 8)` with quiescence and full chain branching, re-verify the next seven days nightly at two plies deeper, reject positions with near-equal alternatives, and add a "Report a problem" link that emails the owner with the date. Keep `generatorVersion` on every row so a search bug can be traced to the puzzles it produced.
- CPU on a $5 host. The prototype ran at 72k nodes/s on a desktop; expect 15–25k on Railway's shared CPU, so a depth-10 verification can take a minute per puzzle. Run the generator off-box or in a cron service, never inside the socket server, and cap it with `--max-minutes`.
- Thin pages. One board and a title is a thin page and Google will drop it. Every page carries the theme paragraph, position summary, narrated solution and alternatives, and the hub carries evergreen text; hand-edit where possible. Watch the "Crawled – currently not indexed" count in Search Console for `/puzzle/*`.
- Rules variant. The engine's flying kings and backward captures are not English draughts. Every puzzle page names the rules; the FAQ must stop saying otherwise, or the first visitor who knows checkers will think the puzzles are wrong.
- Spoilers for today's puzzle live in the payload, not the rendered text. Acceptable until there is a leaderboard.
- Guest cleanup. Without `onDelete: SetNull` on `PuzzleAttempt.userId` the hourly cleanup breaks; the test in phase 2 guards it.
- Time zone. Publishing at 00:00 UTC is simple and canonical-friendly but means US evenings see the next day's puzzle. Accept and label the date as UTC.

## Open questions

1. **Resolved:** the owner approved one coin for the first eligible solve of today's UTC puzzle, for registered humans only; archive puzzles earn no coins.
2. Should today's puzzle validate on the server from day one (no solution in the payload) in anticipation of a puzzle leaderboard, at the cost of a round trip per attempt?
3. Who runs the generator in the first month: the developer's machine against production, or a Railway cron service immediately?
4. Does the FAQ rules answer get corrected in this plan or in plan 02, and should the marketing copy start calling the variant by a name?
5. Hand-edit commentary for every puzzle (5 minutes a day) or accept generated text and spot-check weekly?
6. Notation: chess-style `a1`–`h8` as proposed, or the numbered 1–32 squares used in checkers literature?
7. Should archive puzzles allow an "unlimited retries, no streak" mode so old pages still convert visitors, or stay identical to the day-of experience?
