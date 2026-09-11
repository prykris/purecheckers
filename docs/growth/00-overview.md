# Organic growth plan — overview

Current implementation and acceptance evidence: [implementation-status.md](implementation-status.md) and [launch-readiness.md](launch-readiness.md). The baseline and execution estimates below are retained from the original planning pass. They do not establish current production readiness. The owner approved the one-coin daily puzzle reward; the implemented rules remain Pure's 8x8 rules, explained in the current rules guide. All six owner decisions are now recorded in [owner decisions](owner-decisions.md), including no open-source licence and GitHub Issues feedback; they supersede the original open questions below.

The [requirement audit](requirement-audit.md) maps plan 01 and plan 02's pipeline/current article evidence, with editorial and external checks explicitly open. Equivalent audits of plans 03–06, 04a and the reliability matrix are still required; historical checkpoints do not prove full completion.

Written 10 September 2026 from Google Search Console and Ahrefs data plus a source inspection of the whole site. Each numbered file in this folder is a standalone plan for one growth item, written to the structure in `_template.md`. This file holds the shared baseline, the decisions the owner has to make before work starts, the cross-plan wiring (who owns which file or pattern), and the merged order of execution, so the individual plans do not repeat them.

## Baseline (3 months to 10 September 2026)

| Signal | Value | Reading |
| --- | --- | --- |
| Total clicks (GSC) | 4 | Effectively zero organic traffic |
| Total impressions (GSC) | 60 | The site barely appears in results |
| Average CTR | 6.7% | Fine for the position; the problem is volume |
| Average position | 18.3 | Page two |
| External backlinks (GSC) | 0 | No authority at all |
| Referring domains (Ahrefs) | 379, all appearing in one spike this week, DR 0 | Automated domain-stats and scraper sites; Google ignores them. Do not disavow unless the Backlink profile tab shows spam anchor text |
| Organic keywords (Ahrefs) | 0 | Nothing ranks |
| AI responses (Ahrefs) | 1 page cited once in Copilot | The site is crawlable by AI search; the strategy content will feed that channel too |
| Internal links | 25 across 6 pages | Only the nav; no content graph |
| Queries seen | "strategy checkers" (3 imp, 0 clicks), "pure check" (2 imp, 0 clicks) | Google will show /strategy for strategy queries; the page is a one-line stub |

Live database was reset with the PostgreSQL migration on 10 September 2026. The public leaderboard API returns an empty list and the game log holds two bot games. Any plan that depends on user-generated pages pays off only after the site has players.

## Diagnosis

The site is not held back by technical ranking factors alone. It is held back by having almost nothing to index and nothing linking to it, and by a set of defects that make the six pages it does have look worse than they are. Google sees six marketing pages, two of which say "coming soon". The head term "free online checkers" is owned by established sites and is not winnable in the near term. The long tail (rules questions, strategy questions, puzzles) is winnable, and Search Console already shows Google testing the site for a strategy query.

Starting from zero is an advantage in three places: no content ranks yet for the wrong rules, no URL structure needs preserving, and the first ten real links will move Domain Rating visibly because nothing dilutes them.

## Findings that came out of the planning pass

These were found while writing the six plans and were not in the original brief. Each is recorded in the plan that owns it; they are listed here because they change the order of work.

| Finding | Effect | Owner |
| --- | --- | --- |
| Every JSON-LD block on the site is emitted as literal `{JSON.stringify(...)}` text (Svelte does not interpolate inside `<script>`). Confirmed live on `/` and `/faq` | No page has ever had valid structured data. One shared component fixes all of them | 01 |
| The engine plays pool-style rules (men capture backwards, kings fly, free choice among captures); the FAQ, home page and every launch draft say "standard English draughts" | Rules articles, puzzle commentary and community posts would all be wrong until the rules decision below is made | 02, 03, 05 |
| `persistResult` discards the database `Game.id`; the client and the `global:game-ended` broadcast carry the in-memory ID | No share button can link to the correct replay; GameLog opens the wrong game. Independent one-day fix | 06 Phase 0 |
| "Find Opponent" searches forever with no timeout and no bot fallback; bots are the third tab | On an empty server the primary button is a spinner. Launch traffic would be lost | 04 |
| Guest and bot games award nothing; `COINS_BOT_WIN` is unused; the landing page promises "earn ELO" | The result screen is empty for every new visitor | 04 |
| `robots.txt` `Disallow: /game` is a prefix rule that also blocks `/game/[id]` replay pages, for Googlebot and for social card crawlers | Replay pages cannot be indexed or previewed | 01 |
| The marketing layout emits hreflang for `/` and `/es/` on every page, and `/es/` is a redirect to `/es` | Every page claims the home page as its language alternate; the ES canonical points at a redirect | 01 |
| Hard bot (depth 6) blocks the event loop for up to 0.5 s per move on a desktop CPU, likely over a second on the hobby host | Concurrent Hard games stall every socket. Must move to a worker before launch traffic | 04 (mitigation), scheduled below |
| `github.com/prykris/purecheckers` is public with no README and no LICENSE | Reads as abandoned; excluded from open-source venues | 05, owner decision |
| No GA4 events exist anywhere; only the base tag loads | None of the success metrics in any plan can be measured today | 04 creates the helper |

## Decisions the owner must make first

Three decisions gate the content and launch work. Everything else in the plans can proceed on the recommendation given.

1. **Rules variant.** Keep pool-style rules and say so everywhere, switch the engine to English rules (forward-only man captures, one-step kings), or offer both per room. Recommendation: switch the default to English rules. Every target query, venue, federation and the FAQ already assume it, there are no players whose games or ratings would change, and it removes an "On Pure Checkers" caveat from every rules article and puzzle. Bot strength will shift slightly and the three bot accounts' records restart from zero either way. Decide before article 1, puzzle generation, or any community post.
2. **Licence for the public repository.** MIT or AGPL unlocks Show HN "source" links, awesome-selfhosted and the open-source framing; no licence keeps it source-available. A README is needed regardless.
3. **New coin faucets.** Plan 04 proposes `COINS_BOT_WIN` for bot wins with a daily cap, guests included; plan 03 proposes one coin per first solve of today's puzzle for registered accounts. Both are small, both are new mints in a closed economy. Accept both, one, or neither.

Smaller decisions are listed under Open questions in each plan; the recommendations there are safe defaults.

## The six plans

| # | Plan | What it delivers | Effort | Depends on |
| --- | --- | --- | --- | --- |
| 01 | [Technical SEO fixes](01-technical-seo-fixes.md) | Valid JSON-LD via one component, OG image, `/es` canonical, scoped hreflang, robots fix, noindex on stubs and app screens, encoded canonicals, dynamic sitemap, public `/leaderboard` and `/games`, breadcrumbs, 404 page | 3 days | Nothing. Do first |
| 02 | [Strategy content hub](02-strategy-content-hub.md) | mdsvex article pipeline, `DiagramBoard` with SSR markup and optional play-against-bot mode, hub at `/strategy`, `/blog` 301, twelve articles with outlines and target queries, Spanish designed but deferred | 3 days + 4–6 h per article | 01 Phase 1; rules decision |
| 03 | [Daily puzzle](03-daily-puzzle.md) | Generator-only search wrapper (full chain branching, terminal scores, quiescence), `Puzzle`/`PuzzleAttempt` models, 30-day buffer, `/puzzle` and `/puzzle/YYYY-MM-DD` SSR pages, interactive board, streaks, spoiler-free share | 10 days | 01 Phases 1–2; rules decision; 06 for images |
| 04 | [First session on an empty server](04-first-session-empty-server.md) and the ruling in [04a](04a-lobby-design-debate.md) | Three tabs kept; first visit lands on Bot with one in-flow welcome card; one-row header by subtraction; Quick Play as two labelled buttons with honest captions; "Play Someone Nearby" as the single door to a scan-to-play room (`autoReady`, zero taps for the scanner, auto-guest); server-republished search fallback; game over rebuilt as a result sheet; SSR invite page; bot-win coins; 7-day guest expiry; GA4 helper | 12 days (04a estimate, tests included) | 01 OG image for the invite page; owner decisions in 04a |
| 05 | [Backlinks and distribution](05-backlinks-distribution.md) | 22 venues with verification status, three ready-to-post drafts, outreach email, directory blurbs, six-week calendar with gates, rules of engagement, links log | 1 day prep + 1 h per weekday for six weeks | 01, 03, 04 shipped; README; rules decision reflected in drafts |
| 06 | [Share loop](06-share-loop.md) | Replay-ID plumbing (Phase 0), `share.js` with Web Share API and clipboard fallback, `@resvg/resvg-js` OG image service at `/og/{game,player,puzzle}/….png` with LRU cache and static fallback, `profilePublic` opt-out, milestone share prompts | 6 days | 01 static OG image and robots fix; 03 record shape for puzzle cards |

## Cross-plan wiring

Where two plans touch the same file or pattern, this table says who owns it. The other plans reference it rather than redefining it.

| Shared thing | Owner | Consumers | Rule |
| --- | --- | --- | --- |
| `src/static/robots.txt` | 01 | 04 and 06 need `/join/` fetchable for link-card crawlers and `/invite/` blocked; 06 needs `/game/` allowed | One file, one block; 01 Phase 1 step 5 is the source of truth |
| Marketing layout `<svelte:head>` (`og:image`, `og:type`, `og:locale`, hreflang) | 01 | 02 (per-article `og:type=article`, hreflang later), 03 (no hreflang on puzzles), 06 (`data.ogImage`) | 01 Phase 1 scopes hreflang and `og:locale` to the two home pages and introduces the `data.ogImage` pattern from plan 06 (layout emits exactly one `og:image`/`twitter:image` from `$page.data.ogImage ?? '/og-image.png'`) and a `data.ogType` with the same fallback to `website`, so 02, 03 and 06 set them from load functions |
| `src/lib/components/JsonLd.svelte` | 01 | 02 (Article, BreadcrumbList, FAQPage), 03 (WebPage, BreadcrumbList), 06 (none) | Every JSON-LD block goes through it; the `<` escape is load-bearing |
| Dynamic `sitemap.xml` (Express route) | 01 Phase 2 | 02 (articles from the content index), 03 (`/puzzle` and dated pages), 04 (`/join/*` never listed) | One route, three groups plus articles and puzzles |
| GA4 event helper `src/lib/analytics.js` | 04 Phase 1 | 02 (`play_cta_click`), 03 (`puzzle_*`), 06 (`share`, `share_cancel`, `share_prompt_shown`) | No direct `gtag()` calls outside the helper |
| OG image routes | 06 | 03 references `/og/puzzle/<date>.png`; 04's SSR `/join/[code]` page references `/og/invite/<code>.png` (owner requirement, ships with 04 Phase 3) | Paths as in plan 06 |
| Board notation in text | Standard checkers 1–32 square numbering | 01 (replay move list), 02 (openings are named in it: 11-15, 9-14), 03 proposed `a1`–`h8` | Use 1–32 everywhere; plan 03's open question 6 is closed by this row. Explain once, in the rules pillar, that red on this site is the side that moves first |
| Bot presentation names (Pip, Marge, The Colonel) | 04 | 06 cards, 01 public pages, 03 self-play commentary | Display names only; account usernames unchanged unless the owner runs the one-off rename |
| `/blog` | 02 | 01 noindexes it until then; 05 never links to it | 301 to `/strategy`; the dev.to canonical points at `/changelog` |
| Guest lifetime | 04 (7-day sliding expiry) | 01 and 06 note the 24 h tombstone behaviour | Once 04 Phase 2 ships, the tombstone risk in 01 and 06 shrinks; the noindex rules stay |
| Public game visibility | 04 (in-app: keep bot games visible, tagged) and 01 (SEO: noindex bot and thin games) | 06 shares any game | Both rules apply; they do not conflict |

## Order of execution

Effort is developer-days for one person. Content hours are separate.

| Step | Work | Days | Gate |
| --- | --- | --- | --- |
| 1 | 01 Phase 1 (JSON-LD, OG image, `/es`, hreflang scope, robots, noindex, `app.html`, hooks) and 06 Phase 0 (replay ID) | 2 | None |
| 2 | Owner decisions: rules variant, licence, coin faucets. Update FAQ and home copy to match the rules decision | 0.5 | Step 1 not required |
| 3 | 04 Phases 1–2 (bot-first lobby, fallback, presence, bot-win coins, guest expiry, GA4 helper) and 02 Phase 1 (mdsvex, DiagramBoard, hub, `/blog` redirect) in parallel | 5 | Rules decision for 02 diagrams |
| 4 | 01 Phases 2–3 (dynamic sitemap, `/leaderboard`, `/games`, breadcrumbs, 404 page) | 2 | Step 1 |
| 5 | 02 articles 1–4 (one per week) and 03 Phases 1–3 (generator, API, SSR pages, interactive board) | 7 + 20 h | Rules decision; step 4 sitemap |
| 6 | Bot search into a `worker_threads` pool with a time budget (from 04 risks; not yet a phase in any plan) | 1–2 | Before step 8 |
| 7 | 06 Phases 1–2 (share buttons, game OG cards) and 04 Phases 3–4 (SSR invite page, post-game actions) | 4 | Steps 1, 3 |
| 8 | 05 Phase 0 gates, README, links log; then the six-week calendar | 1 + ongoing | Steps 1–7; puzzle buffer of 30 days; no open P1 bug |
| 9 | 03 Phases 4–5, 06 Phases 3–4, 02 articles 5–12, Spanish when three articles show impressions | 4 + 40 h | Step 8 running |

Roughly 30 developer-days plus about 60 hours of article writing over 90 days.

## Shared conventions for the plans

- Every plan cites source files by path so it can be executed without re-deriving the inventory.
- Effort is given in developer-days for one person, rounded up.
- Success metrics are things Search Console or Google Analytics can actually report; none exist until 04 Phase 1 adds the GA4 helper.
- Anything a plan needs from another plan is listed under Dependencies, not assumed; ownership conflicts are resolved by the wiring table above, which wins over the individual plans.
