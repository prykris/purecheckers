# 01 — Technical SEO fixes

11 September 2026: the [requirement audit](requirement-audit.md) maps all 24 numbered implementation items to current source/test/built-app evidence and explicitly open production checks. The baseline findings and original verification examples below are historical; in particular, strategy is now populated and indexable rather than a temporary noindexed stub.

This plan removes the defects that make the six indexed pages look worse than they are and that hide the two page types the site already generates for free (player profiles and game replays). None of these fixes will produce traffic by themselves; the baseline in 00-overview.md is 4 clicks on 60 impressions because there is almost nothing to index. What they do is make sure that when plans 02, 03 and 06 add pages, Google can find them, render them correctly and show a preview when someone shares them. The biggest finding beyond the brief is that every JSON-LD block on the site is emitted as raw Svelte source, so the structured data the changelog advertises has never been valid.

## Current state

Verified on 10 September 2026 against the source tree and with curl against https://purecheckers.com. The marketing routes live in `src/routes/(marketing)/`, are prerendered (`export const prerender = true` in each `+page.js`), and are served in production by `express.static(build/prerendered)` followed by the adapter-node handler in `server/index.js`. The SPA lives in `src/routes/(app)/` with `ssr = false` (`src/routes/(app)/+layout.js`). Static assets are served from `src/static` (mapped in `svelte.config.js` `kit.files.assets`) and copied to `build/client/`.

| Finding | Consequence | Source |
| --- | --- | --- |
| All three JSON-LD blocks render as literal `{JSON.stringify({...})}` text. Svelte does not interpolate expressions inside `<script>` elements in markup; the home page even gets a scoped `class="svelte-…"` on the script tag. Confirmed in `build/prerendered/index.html`, `faq.html` and live `/player/Bot%20Medium` | WebApplication, FAQPage and ProfilePage schema are all invalid JSON. Rich Results Test reports nothing. The changelog entry "structured data for Google rich snippets" is not true | `src/routes/(marketing)/+page.svelte`, `faq/+page.svelte`, `player/[username]/+page.svelte` |
| `og:image` and `twitter:image` point at `https://purecheckers.com/og-image.png`, which returns 404. The same URL is the WebApplication `screenshot`. `src/static/` holds only `favicon.svg`, `manifest.json`, `robots.txt`, `sitemap.xml`, `fonts/`, `sounds/` | Every share on Discord, Slack, X, LinkedIn, WhatsApp, Reddit renders without an image; `summary_large_image` degrades to a text card. Plan 05 and 06 depend on this | `src/routes/(marketing)/+layout.svelte` lines 10-16, `src/routes/(marketing)/+page.svelte` |
| `/es/` 308-redirects to `/es`. Cause: no `trailingSlash` config exists in `svelte.config.js`, so SvelteKit defaults to `never`, prerenders `build/prerendered/es.html`, and adapter-node's `serve_prerendered()` redirects the slashed form (`build/handler.js` lines 1323-1347). Yet the ES canonical, `og:url`, the layout hreflang, four nav/footer links and both sitemap entries use `/es/` | Canonical points at a redirect; hreflang cluster references a URL that is not the indexed one; Search Console already lists the page as `/es`. Google will pick its own canonical and may drop the hreflang pair | `src/routes/(marketing)/es/+page.svelte` lines 16 and 19, `+layout.svelte` lines 18, 78, 226, 252, `src/static/sitemap.xml` lines 7, 12, 14 |
| The hreflang block (`en` → `/`, `es` → `/es/`, `x-default` → `/`) sits in the marketing layout, so it is emitted on `/faq`, `/blog`, `/strategy`, `/changelog`, `/player/*` and `/game/*` as well as on the home page. Only the home page has a Spanish twin | Every non-home page claims the home page as its English alternate. Hreflang must be reciprocal per page; on these pages it is simply wrong and Google ignores it, but it also mislabels the pages as translations of `/` | `src/routes/(marketing)/+layout.svelte` lines 17-19 |
| `robots.txt` has `Disallow: /game`. Robots rules are prefix matches, so this also blocks `/game/1`, `/game/2`, and every future `/game/<id>` replay page, which are the public SSR pages, not the SPA screen | The replay pages can never be crawled, whatever else this plan does. (`/profile` does not collide with `/player`; the other rules are fine.) | `src/static/robots.txt` line 5, `src/routes/(marketing)/game/[id]/` |
| `/blog` and `/strategy` are one-sentence "coming soon" stubs, prerendered, canonicalised, in the sitemap and in the nav. Search Console shows Google testing `/strategy` for "strategy checkers" | Two of six indexed pages are thin. Each impression that lands on them ends with a bounce, and Google learns the site does not answer the query | `src/routes/(marketing)/blog/+page.svelte`, `strategy/+page.svelte`, `src/static/sitemap.xml` |
| `/player/[username]` and `/game/[id]` are SSR (`+page.server.js` fetches `/api/leaderboard/...`), have title, description, canonical and OG tags, but nothing links to them except each other, they are not in the sitemap, and there is no public `/leaderboard` or `/games` page. Live `/leaderboard` and `/games` return 404 | The only pages that scale with usage are orphans. Google discovers them only if a player shares a link | `src/routes/(marketing)/player/[username]/`, `game/[id]/`, `server/routes/leaderboard.js` |
| Player canonical and `og:url` are built as `https://purecheckers.com/player/{player.username}` without encoding. Live `/player/Bot%20Medium` emits `<link rel="canonical" href="https://purecheckers.com/player/Bot Medium">`. Game pages link to `/player/Quick Crown 35` the same way | A canonical containing a space is not a valid URL and is ignored. Usernames with spaces are the norm for guests ("Quick Crown 35") | `player/[username]/+page.svelte` lines 58 and 62, `game/[id]/+page.svelte` lines 36-39 |
| The player API returns guests and bots (`/api/leaderboard/player/:username` has no `isGuest`/`isBot` filter), and `guestCleanup.js` renames expired guests with games to `[Expired Guest N]` | Guest profiles are indexable today and will 404 within days; game titles change from "Quick Crown 35 vs Bot Medium" to "[Expired Guest 12] vs Bot Medium". Indexing them creates churn and thin pages | `server/routes/leaderboard.js`, `server/services/guestCleanup.js` |
| The FAQ renders only the open answer (`{#if openIndex === i}`), so the prerendered HTML contains one of ten answers; the JSON-LD (even once fixed) claims ten | Google requires FAQ text to be present on the page. Nine answers are invisible to the crawler and to text search on the page | `src/routes/(marketing)/faq/+page.svelte` lines 80-88 |
| `/game/[id]` has no `<h1>`; its visible text is a breadcrumb, mode, date and two player links. The replay board is a 64-cell grid at the starting position; the move list is only navigable with JS | Replay pages are near-empty documents to a crawler even when the game is worth indexing | `game/[id]/+page.svelte`, `src/lib/components/ReplayBoard.svelte` |
| `src/app.html` hard-codes `<meta name="description">`, `<meta name="theme-color">` and `<html lang="en">`. Marketing pages add their own description, so every marketing page ships two descriptions (verified on live `/game/1`); the layout adds a second `theme-color`; `/es` is served with `lang="en"` | Duplicate description is a lint-level issue but it is the app.html copy that sits first in the head. Wrong `lang` on the Spanish page weakens the language signal that hreflang is supposed to give | `src/app.html` lines 2, 8, 9; `(marketing)/+layout.svelte` line 16 |
| Viewport is `width=device-width, initial-scale=1.0, user-scalable=no` | Lighthouse and Search Console mobile usability flag it. The board already uses `touch-action: none` (`BoardView.svelte` line 250, `GameScreen.svelte` line 289), so the viewport restriction is not needed for drag | `src/app.html` line 5 |
| Home `<h1>` is the wordmark "Pure Checkers" (`hero-logo`); the ES page likewise. Real headings are h2 ("Why Pure Checkers Exists", "What You Get", "How to Play Checkers", "About") | The one h1 on the most important page carries no query terms. Body copy is decent; the heading hierarchy wastes it | `src/routes/(marketing)/+page.svelte` line 39, `es/+page.svelte` line 24 |
| Sitemap is a static file with six URLs, `changefreq`/`priority` (ignored by Google) and no `lastmod` | Google cannot tell what changed; no dynamic pages can ever be listed without a rebuild | `src/static/sitemap.xml` |
| No `src/error.html` and no `+error.svelte`. Live `/this-does-not-exist`, `/leaderboard` and `/player/nobody-xyz` return a correct 404 status but the body is SvelteKit's bare "404 Not Found" inside the app shell | Status codes are right (no soft 404s), which is what matters for indexing. The page is just unbranded and has no way back | `src/routes/`, `src/app.html` |
| The (app) group has no `<title>` anywhere and no robots meta or header. `/auth` is the "Play Now" target on every marketing page; `/replay`, `/search`, `/join/[code]`, `/room-waiting`, `/treasury` are not in robots.txt at all | `/auth` is heavily linked yet crawl-blocked, the classic "Indexed, though blocked by robots.txt" case. The unblocked SPA routes render an empty shell to Googlebot and can be indexed as empty pages; `/join/<code>` links are shared by design | `src/routes/(app)/+layout.svelte`, `src/routes/(app)/+layout.js`, `src/static/robots.txt` |
| `manifest.json` has `start_url: /auth`, `orientation: portrait` and a single SVG icon with `sizes: any` | No PNG icons means no Android install prompt and no 192/512 icon for Search's favicon crawler to fall back on. Not a ranking factor; listed for completeness | `src/static/manifest.json` |
| Google Analytics `G-906GR0NE7N` loads in `app.html` on every route, before `%sveltekit.head%` | Present and working. Confirm the GA4 property is linked to the Search Console property so the metrics below can be read in one place | `src/app.html` lines 11-17 |
| `site/` is a leftover Astro project (`astro.config.mjs` targets `../dist/site`, its own `robots.txt` points at `sitemap-index.xml`, 15 tracked files plus a 200 KB lock file). Nothing in `package.json`, `Procfile` or `svelte.config.js` references it | Dead code. It does not affect the live site but confuses anyone auditing SEO files, and `git grep sitemap` returns the wrong robots.txt | `site/` |
| `build/` is in `.gitignore` but 316 build artefacts are still tracked (see `git status` at the top of this session) | Stale prerendered HTML and old asset hashes live in the repository. Harmless for Railway, which rebuilds, but `git rm -r --cached build` should happen with the first commit of this plan so the diff stays readable | `.gitignore`, `build/` |

Things that are already right and should not be touched: every marketing page has a unique title, description, canonical, `og:title`, `og:description` and `og:url`; `og:site_name`, `og:type` and `twitter:card` are set once in the layout; 404s return 404; fonts are self-hosted; the server sits behind Cloudflare with correct `Content-Type` on `robots.txt` and `sitemap.xml`.

## Plan

Three phases, each independently deployable. If Phase 1 has to be split across deploys, ship in this order:

| Priority | Steps | Why first |
| --- | --- | --- |
| P1 | 1 (JSON-LD), 2 (OG image), 3 (`/es`), 5 (robots `/game`) | These are the defects that affect pages Google has already indexed, or that block pages it cannot reach at all |
| P2 | 4 (hreflang scope), 8 (noindex stubs), 9 (encoded canonicals, guest noindex) | Stop sending wrong signals before Phase 2 and 3 add hundreds of URLs that inherit them |
| P3 | 6, 7, 10, 11, 12 | Hygiene; each is small and none is urgent on its own |

### Phase 1 — head and crawl fixes (effort: 1 day, most items are minutes)

1. **Fix JSON-LD emission.** Create `src/lib/components/JsonLd.svelte` that takes a `data` prop and renders `{@html '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</scr' + 'ipt>'}` inside `<svelte:head>`. Replace the three inline `<script type="application/ld+json">` blocks in `+page.svelte`, `faq/+page.svelte` and `player/[username]/+page.svelte` with `<JsonLd data={...} />`. Done when `curl -s https://purecheckers.com/faq | grep -o '"@type":"Question"' | wc -l` prints 10 and the Rich Results Test parses all three pages without "unparsable JSON".
2. **Ship the OG image.** Add `src/static/og-image.png`, 1200x630, under 300 KB. Design brief: dark background `#1c1917` matching `theme-color`; a checkerboard occupying the left 40% at the starting position using the site's red (`#ef4444`) and black pieces; the wordmark "Pure Checkers" in Poppins Bold on the right with "Free online checkers. No ads, no paywalls." beneath it in the dim text colour; keep all text inside a 1080x540 safe area because LinkedIn and WhatsApp crop edges. Also add `og:image:alt` ("Pure Checkers — free online checkers board") and `og:image:type` `image/png` in the layout. Done when `curl -sI https://purecheckers.com/og-image.png` returns `200 image/png` and the Facebook Sharing Debugger, LinkedIn Post Inspector and a pasted link in Discord show the image (see Verification).
3. **Make `/es` consistent.** Change every `/es/` to `/es`: canonical and `og:url` in `es/+page.svelte`, the hreflang href and the three nav/footer links in `(marketing)/+layout.svelte`, and the sitemap (or delete the sitemap, Phase 2). Do not add `trailingSlash = 'always'`; every other URL on the site has no slash and Search Console already knows `/es`. Done when `curl -sI https://purecheckers.com/es/` still 308s, `curl -s https://purecheckers.com/es | grep canonical` shows `/es`, and no `/es/` string remains under `src/`.
4. **Scope hreflang to pages that have twins.** Remove the three `<link rel="alternate" hreflang>` tags from the layout. Put `en` + `es` + `x-default` on `+page.svelte` and `es/+page.svelte` only. Add the reciprocal `og:locale:alternate` (`es_ES` on `/`, `en_US` on `/es`) and move `og:locale` out of the layout so the ES page does not emit both `en_US` and `es_ES`. Done when `/faq` has no hreflang tags and `/` and `/es` each carry all three.
5. **Fix `robots.txt`.** Replace `src/static/robots.txt` with the block below. Drop `Disallow: /auth` and instead let step 7 noindex it, so Google can see the directive on the one SPA URL every page links to. The `$` anchor plus `Allow: /game/` covers crawlers with and without wildcard support (Google and Bing pick the longest matching rule, so `/game/` beats `/game` for `/game/123`). Never block `/_app/`; Googlebot needs the JS and CSS to render. Do not block `/join/`: invite links are shared into WhatsApp, iMessage, X and LinkedIn, and the last two honour robots.txt when they build link cards, so the SSR `/join/[code]` page from plan 04 must stay fetchable and carries `<meta name="robots" content="noindex">` instead; the app-side route that plan 04 moves to `/invite/[code]` is the one to disallow. Done when the Search Console robots.txt report shows `/game/1` and `/join/ABC123` allowed and `/game` and `/invite/ABC123` blocked.

   ```
   User-agent: *
   Disallow: /api/
   Disallow: /lobby
   Disallow: /game$
   Allow: /game/
   Disallow: /shop
   Disallow: /friends
   Disallow: /profile
   Disallow: /replay
   Disallow: /search
   Disallow: /invite/
   Disallow: /room-waiting
   Disallow: /treasury

   Sitemap: https://purecheckers.com/sitemap.xml
   ```
6. **Clean `app.html`.** Remove the hard-coded `<meta name="description">` and the duplicate `<meta name="theme-color">` (keep the one in the marketing layout). Change the viewport to `width=device-width, initial-scale=1`. Change `<html lang="en">` to `<html lang="%lang%">`. Done when `curl -s https://purecheckers.com/faq | grep -c 'name="description"'` prints 1 and Lighthouse no longer reports "user-scalable=no".
7. **Add `src/hooks.server.js`.** One `handle` that (a) sets `%lang%` to `es` when `event.url.pathname` starts with `/es` and `en` otherwise via `resolve(event, { transformPageChunk })`, and (b) sets `X-Robots-Tag: noindex` on responses whose `event.route.id` starts with `/(app)`. Both run at prerender time too, so `build/prerendered/es.html` gets the right `lang` without runtime work. Add a `<title>Pure Checkers</title>` to `src/routes/(app)/+layout.svelte` so the SPA at least has a tab title. Done when `curl -sI https://purecheckers.com/auth | grep -i x-robots` prints `noindex` and `curl -s https://purecheckers.com/es | head -3` shows `lang="es"`.

   ```js
   // src/hooks.server.js
   export async function handle({ event, resolve }) {
     const lang = event.url.pathname === '/es' || event.url.pathname.startsWith('/es/') ? 'es' : 'en';
     const response = await resolve(event, {
       transformPageChunk: ({ html }) => html.replace('%lang%', lang)
     });
     if (event.route.id?.startsWith('/(app)')) response.headers.set('X-Robots-Tag', 'noindex');
     return response;
   }
   ```
8. **Noindex the stubs until content lands.** Add `<meta name="robots" content="noindex,follow">` to `blog/+page.svelte` and `strategy/+page.svelte`, remove both from the sitemap, and keep them in the nav so the eventual articles inherit the link. Plan 02 removes the tag when the first four articles ship. Done when URL Inspection on `/strategy` reports "Excluded by noindex tag".
9. **Encode usernames.** In `player/[username]/+page.svelte` build the canonical, `og:url` and ProfilePage `url` from `encodeURIComponent(player.username)`; in `game/[id]/+page.svelte` do the same for the two player links; in `player/[username]/+page.svelte` also add `<meta name="robots" content="noindex">` when `player.isGuest || player.isBot`. Done when `/player/Bot%20Medium` shows an encoded canonical and a noindex tag and a registered player's page shows neither.
10. **Render every FAQ answer.** Replace the `{#if openIndex === i}` in `faq/+page.svelte` with a `<details>/<summary>` pair (or keep the toggle but render the `<p>` always and hide it with `hidden`), so all ten answers are in the prerendered HTML. Done when `grep -c 'class="faq-a"' build/prerendered/faq.html` prints 10.
11. **Give the home page a real h1.** Turn `hero-logo` into a `<p>` or `<a>` and add `<h1>Play Checkers Online — Free, No Ads, No Paywalls</h1>` above the "Play Now" button; mirror it in Spanish on `/es`. Done when each page has exactly one h1 that is not the brand name.
12. **Housekeeping.** `git rm -r --cached build` and `git rm -r site`. Add 192x192 and 512x512 PNG icons to `manifest.json` (same artwork as the favicon). Done when `git ls-files build site | wc -l` prints 0.

### Phase 2 — dynamic sitemap (effort: 1 day)

1. **Create `server/routes/sitemap.js`** and mount it in `server/app.js` as `app.get('/sitemap.xml', ...)`. Express is the right host rather than a SvelteKit `+server.js`: the route needs Prisma (`server/db.js`) directly, the SSR `fetch('/api/...')` path in the page loaders already round-trips through the public origin (`node_modules/@sveltejs/kit/src/runtime/server/respond.js` falls back to a real `fetch` for unmatched routes), and Express routes in `app.js` are registered before the `express.static(build/client)` call in `server/index.js`, so they win over any stale static file. Add `/sitemap.xml` to the Vite proxy list in `vite.config.js` so it works in `npm run dev`.
2. **Emit three groups.** Static pages: `/`, `/es`, `/faq`, `/changelog` (and `/leaderboard`, `/games` after Phase 3; `/blog`, `/strategy` when Plan 02 removes the noindex) with `lastmod` from a constant updated on deploy. Players: `prisma.user.findMany({ where: { isGuest: false, isBot: false, gamesPlayed: { gt: 0 } }, select: { username, updatedAt } })` → `/player/<encodeURIComponent(username)>`, `lastmod = updatedAt`. Games: neither participant is a bot, `result != 'ABORTED'`, at least one participant with `isGuest: false, isBot: false`, `moveHistory` length ≥ 10 (filter in JS after selecting the most recent 5,000, or use `jsonb_array_length("moveHistory")` through `prisma.$queryRaw` once volume warrants it) → `/game/<id>`, `lastmod = endedAt ?? startedAt`. Keep the `xhtml:link` hreflang pair on `/` and `/es` only. Omit `changefreq` and `priority`.
   The output shape, one `<url>` per entry, ISO dates, encoded paths:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
     <url>
       <loc>https://purecheckers.com/</loc>
       <lastmod>2026-09-10</lastmod>
       <xhtml:link rel="alternate" hreflang="en" href="https://purecheckers.com/"/>
       <xhtml:link rel="alternate" hreflang="es" href="https://purecheckers.com/es"/>
       <xhtml:link rel="alternate" hreflang="x-default" href="https://purecheckers.com/"/>
     </url>
     <url><loc>https://purecheckers.com/player/Some%20Player</loc><lastmod>2026-09-12T18:04:11.000Z</lastmod></url>
     <url><loc>https://purecheckers.com/game/41</loc><lastmod>2026-09-12T18:04:11.000Z</lastmod></url>
   </urlset>
   ```

3. **Cache and limits.** Hold the generated XML in memory for 10 minutes and send `Cache-Control: public, max-age=600` and `Content-Type: application/xml; charset=utf-8`. Split into a sitemap index at 40,000 URLs; not needed for a long time, but write the loop so it is a constant.
4. **Delete `src/static/sitemap.xml`.** `robots.txt` keeps pointing at `https://purecheckers.com/sitemap.xml`.
5. **Test.** Add `tests/sitemap.test.js` in the style of `tests/leaderboard.test.js` (supertest against `server/app.js`): seed one registered player with a game, one guest, one bot, one aborted game; assert the registered player's URL is present, the guest and bot are absent, the aborted game is absent, and the response validates as XML. Done when the test passes and Search Console "Sitemaps" shows the resubmitted sitemap with the discovered URL count rising after the first real games.

### Phase 3 — public index pages and page-level schema (effort: 1 day)

1. **Add `src/routes/(marketing)/leaderboard/+page.server.js` and `+page.svelte`** reading `/api/leaderboard` (already filters guests and bots, `take: 50`). Title "Checkers Leaderboard — Top Players by ELO"; a table with rank, linked username (`/player/<encoded>`), ELO, W/L, games; an empty state that says the board resets with the September relaunch and links to `/auth`. Not prerendered; SSR on request.
2. **Add `src/routes/(marketing)/games/+page.server.js` and `+page.svelte`** reading `/api/leaderboard/games`. The API currently returns everything; extend it to accept `?public=1` and apply the same rule as the sitemap (no bots, no aborted, at least one registered player, ≥ 10 moves) so the list and the sitemap agree. Each row links to `/game/<id>` and both `/player/` pages.
3. **Link them.** Add "Leaderboard" and "Recent games" under "Explore" in the sidebar, the mobile menu and the footer of `(marketing)/+layout.svelte`. Link the "ELO Rating & Leaderboard" feature card on the home page to `/leaderboard`. Add both to the Phase 2 static list. Done when `/leaderboard` and `/games` return 200 with SSR content and every marketing page links to them.
4. **Noindex thin games.** In `game/[id]/+page.server.js` compute `indexable` with the same rule and pass it to the page; emit `<meta name="robots" content="noindex,follow">` when false. Also add an `<h1>` ("{red} vs {black} — Checkers Replay") and an SSR-rendered `<ol>` move list under the board (`moveHistory` is already in the loader data; render `fromRow,fromCol → toRow,toCol` as square numbers 1-32 in the standard notation) so an indexable game page has text. Done when a guest-vs-bot game shows noindex and a registered player's 30-move game shows an h1, a move list and no noindex.
5. **Add `BreadcrumbList`** through the `JsonLd` component: on `/player/*` (`Home › Leaderboard › {username}`), on `/game/*` (`Home › Games › Game #{id}`), and mirror it in the visible breadcrumb `<nav>` (the game page already has one; the player page has a bare "Home" link). Done when the Rich Results Test shows a valid breadcrumb on both page types.
6. **Add `WebSite` and `Organization`** to `(marketing)/+layout.svelte` via `JsonLd`: `WebSite` with `url`, `name`, `inLanguage` and a `potentialAction` `SearchAction` targeting `https://purecheckers.com/player/{search_term_string}` (the only search the site has); `Organization` with `name`, `url`, `logo` (`/og-image.png` until a square logo exists) and `sameAs` left empty until Plan 05 creates profiles. Keep `WebApplication` on the home page and give it the same `@id` scheme so the graph links.
7. **Add `src/error.html` and `src/routes/+error.svelte`** with the wordmark, "Page not found", and links to `/`, `/leaderboard`, `/faq`. Status codes are already correct; this only stops the bare "404 Not Found".

## Verification checklist

Run after each deploy; all commands are plain curl and can go in a `scripts/seo-check.sh` later.

```
curl -sI https://purecheckers.com/og-image.png | head -1            # 200, image/png
curl -sI https://purecheckers.com/es/ | grep -i location             # /es (308 is expected)
curl -s  https://purecheckers.com/es | grep -o '<link rel="canonical"[^>]*>'   # …/es
curl -s  https://purecheckers.com/es | head -3 | grep -o 'lang="[a-z]*"'      # es
curl -s  https://purecheckers.com/faq | grep -c 'name="description"' # 1
curl -s  https://purecheckers.com/faq | grep -c 'hreflang'           # 0
curl -s  https://purecheckers.com/    | grep -c 'hreflang'           # 3
curl -s  https://purecheckers.com/faq | grep -o '"@type":"Question"' | wc -l   # 10
curl -sI https://purecheckers.com/auth | grep -i x-robots-tag        # noindex
curl -s  https://purecheckers.com/strategy | grep -o '<meta name="robots"[^>]*>'   # noindex,follow
curl -s  https://purecheckers.com/sitemap.xml | grep -c '<loc>'      # >= 4, grows with players
curl -s  https://purecheckers.com/player/Bot%20Medium | grep -o '<meta name="robots"[^>]*>'   # noindex
curl -s  https://purecheckers.com/robots.txt                         # no bare "Disallow: /game"
```

Then in tools:

- Search Console → Settings → robots.txt: confirm the new file was fetched; use the tester on `/game/1` (allowed) and `/game` (blocked).
- Search Console → URL Inspection on `/`, `/es`, `/faq`, `/strategy`, `/player/<registered user>`: "URL is on Google" or "Crawled – currently not indexed", canonical equals the declared one, "Page fetch" succeeded, and the rendered screenshot shows the page. Request indexing on `/` and `/es` after the hreflang change.
- Search Console → Sitemaps: remove the old submission, submit `https://purecheckers.com/sitemap.xml`, expect "Success" and a discovered-URL count equal to `grep -c '<loc>'`.
- Rich Results Test (search.google.com/test/rich-results) on `/`, `/faq`, `/player/<user>`, `/game/<id>`: no "unparsable structured data"; BreadcrumbList detected on the last two. FAQ rich results themselves are restricted to government and health sites since August 2023, so a valid FAQPage will show as detected but will not be promised a rich result; that is expected.
- Schema Markup Validator (validator.schema.org) for `WebSite`, `Organization`, `WebApplication`, since the Rich Results Test ignores types it has no rich result for.
- Share previews: Facebook Sharing Debugger (developers.facebook.com/tools/debug) with "Scrape Again"; LinkedIn Post Inspector (linkedin.com/post-inspector); paste the URL into Discord and Slack. X removed its card validator; a tweet composer preview or opengraph.xyz works.
- Lighthouse (Chrome DevTools or `mcp__chrome-devtools__lighthouse_audit`) mobile on `/`: no "viewport disables zoom" audit failure; SEO category 100.

## Success metrics

| Metric | Where | Now | 30 days | 90 days |
| --- | --- | --- | --- | --- |
| Indexed pages | Search Console → Pages → Indexed | 6 | 6 (stubs out, `/leaderboard` and `/games` in) | 6 + every registered player with a game + every indexable game, tracking the sitemap count |
| "Not found (404)" entries for `/og-image.png` | Search Console → Pages → Why pages aren't indexed | present | 0 | 0 |
| "Duplicate, Google chose different canonical" for `/es` | Search Console → Pages | risk | 0 | 0 |
| Impressions on `/es` | Search Console → Performance, page filter | ~0 | any | > 10% of `/` impressions once Spanish queries appear |
| "Indexed, though blocked by robots.txt" | Search Console → Pages | risk for `/auth` | 0 | 0 |
| Structured data items detected | Search Console → Enhancements (Breadcrumbs, FAQ) | 0 | > 0 | one per indexed player/game page |
| Sitemap discovered URLs vs indexed | Search Console → Sitemaps | 6 / 6 | matches `grep -c '<loc>'` | indexed ≥ 60% of discovered |
| Share preview renders with image | manual, Facebook debugger | no | yes | yes |
| Mobile usability issues | Lighthouse SEO audit on `/` | 1 (`user-scalable=no`) | 0 | 0 |

None of these are traffic numbers. Traffic comes from plans 02, 03 and 05; this plan is measured by whether Google can see what those plans add.

## Dependencies and risks

- Nothing in this plan depends on another plan. Plans 02, 03, 05 and 06 depend on Phase 1 (OG image, JSON-LD component, hreflang cleanup) and Phase 2 (dynamic sitemap).
- Phase 3 pages are empty until the server has registered players with games; the leaderboard API already filters to `gamesPlayed > 0`, `isGuest: false`, `isBot: false`, so on launch day `/leaderboard` shows the empty state. Plan 04 is what fills it. Ship the pages anyway; an empty SSR table with a clear message is not thin in the way a "coming soon" line is, but do not put `/leaderboard` in the sitemap until it lists at least one player.
- The `+page.server.js` loaders fetch `/api/leaderboard/...` by relative URL. SvelteKit resolves that to a real HTTP request against `ORIGIN` or, when unset, `https://` plus the incoming `Host` header, so every SSR of a player or game page goes out through Cloudflare and back. It works today; set `ORIGIN=https://purecheckers.com` in the Railway variables (adapter-node's documented requirement, absent from `.env.example`) so it does not depend on the host header, and consider calling Prisma directly from the loaders when Phase 3 adds two more of them.
- Changing the ES canonical and hreflang will cause a brief reshuffle in Search Console while Google re-canonicalises. Request indexing on `/` and `/es` after deploy and do not touch the URLs again.
- Guest cleanup (`server/services/guestCleanup.js`) renames expired guests, so any guest profile or guest-only game that Google has already seen will 404 or change title. The noindex rules in Phase 1 step 9 and Phase 3 step 4 stop new ones being indexed; the two existing live games (`/game/1`, `/game/2`, guest vs bot) will simply drop out.
- `Disallow: /game$` relies on `$` support. Google, Bing, Yandex and DuckDuckGo honour it; the paired `Allow: /game/` covers a crawler that does not. Keep both lines.
- The `{@html}` JSON-LD approach injects a string into the head. It is safe only because the component replaces every `<` with the JSON escape `\u003c`, which browsers decode inside the JSON but never parse as a tag. Usernames are the one user-controlled input that reaches structured data, and `server/routes/auth.js` (line 39) validates length only, 2 to 16 characters, with no character restriction, so a username such as `</script><script>` is accepted today. The escape in `JsonLd.svelte` is therefore load-bearing; add a unit test that renders the player page with that username and asserts the document still has exactly one `ld+json` script and no injected element. Tightening the username character set is a separate, sensible change.
- Removing `user-scalable=no` allows pinch-zoom on the game screen. The board already sets `touch-action: none`, so drag is unaffected; double-tap zoom on buttons is the only behavioural change and is the accessible default.

## Open questions

- Should `/es` stay a single translated home page, or does the owner intend a Spanish twin for `/faq` and future strategy articles? If yes, Plan 02 should decide the URL scheme (`/es/faq` and `/es/strategy/…`) now so hreflang can be added per page rather than reworked later.
- Who produces the OG image? The design brief above can be executed in any image editor in under an hour; the site has no square logo asset either, which `Organization.logo` and the manifest icons need. One session producing `og-image.png`, `icon-192.png`, `icon-512.png` and a square `logo.png` covers all four.
- Should bot profiles (`/player/Bot%20Easy` etc.) be noindexed, as this plan proposes, or would a page per bot difficulty be a useful landing page ("play checkers against an easy bot")? If the latter, keep them indexable but give them real copy; Plan 04 touches the same pages.
- The move-count threshold for indexable games (10) is a guess. Revisit after a month of real games using the distribution of `moveHistory` lengths in the database.
- Should the sitemap also carry `image:image` entries for per-game OG images once Plan 06 generates them? Cheap to add later; the route structure above leaves room for it.

Implementation update, 10 September 2026: dynamic sitemap, public discovery pages and shared eligibility are implemented locally. `server/services/publicGames.js` is the policy owner: no bots, no aborted games, at least one registered human, at least ten moves. The sitemap reads `.generated/content.json`, produced from the same mdsvex frontmatter compiler at build time; it does not import a Vite-only `import.meta.glob` module into plain Node. See implementation-status.md for verification and remaining launch gates.
