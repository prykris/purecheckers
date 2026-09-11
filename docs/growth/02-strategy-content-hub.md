# 02 — Strategy content hub

Implementation checkpoint: all twelve English guides now exist, including the friends walkthrough with three actual annotated screenshots. Publication and launch acceptance remain separate gates. The traps working title was corrected to distinguish material gains, conditional threats, promotion and immobilization; the examples do not all win pieces. See [implementation-status.md](implementation-status.md) and [strategy verification](../strategy-verification.md) for current evidence; the baseline and original outlines below are historical planning material.

Turn /strategy from a one-sentence stub into the section Google is already trying to rank: a hub page, article routing under /strategy/[slug], twelve long-tail articles on rules, openings, tactics, endgames and playing online, each with an interactive board diagram, Article and BreadcrumbList schema, and internal links to the hub, the FAQ, the home page and the Play CTA. Against the baseline in 00-overview.md (60 impressions, 4 clicks, 6 indexable pages, Google testing /strategy for "strategy checkers" with nothing to show) this is the plan that gives the site something to index. The head term "free online checkers" stays out of scope; every target below is a question a checkers player types.

## Current state

| Finding | Consequence | Source |
| --- | --- | --- |
| /strategy is a stub: title, description, canonical, one "Coming soon" sentence | Google shows it for "strategy checkers" (3 impressions) and gets nothing to rank; the page is a soft thin-content signal | src/routes/(marketing)/strategy/+page.svelte |
| /blog is the same stub with "Blog & News" copy; /changelog already carries release news with dated entries | Two thin indexes competing for the "news" role; nav, footer and sitemap all link to /blog | src/routes/(marketing)/blog/+page.svelte, changelog/+page.svelte, +layout.svelte, src/static/sitemap.xml |
| No article routing, no content directory, no markdown pipeline. `svelte.config.js` uses only `vitePreprocess`; package.json has no mdsvex, marked or remark | Each article would need its own `+page.svelte` with duplicated head, schema and CTA boilerplate | svelte.config.js, vite.config.js, package.json |
| All six marketing routes are `prerender = true`; adapter-node serves them from build/prerendered | Articles can be prerendered too, so a content module resolved at build time is the natural fit | src/routes/(marketing)/*/+page.js |
| Schema in use: WebApplication (home), FAQPage with 10 Q&As (faq), ProfilePage (player). No Article, no BreadcrumbList anywhere | Articles start with no structured-data pattern to copy; the FAQ answers are the only rule text on the site | src/routes/(marketing)/+page.svelte, faq/+page.svelte, player/[username]/+page.svelte |
| FAQ has three rules/feature answers that seed articles: "What are the rules?", "Can I play against bots?", "Can I play with friends?"; home has a 4-step "How to Play Checkers" section | Enough first-party copy to expand, but it is 1–3 sentences each, so articles must add far more than they reuse | faq/+page.svelte (`faqs` array), +page.svelte (`#how-to-play`) |
| Layout emits `og:type=website`, `og:image=/og-image.png` and hreflang en/es pointing at `/` and `/es/` on every page | An article cannot declare `og:type=article` or its own hreflang without producing duplicate tags; og-image.png does not exist in src/static | src/routes/(marketing)/+layout.svelte, src/static/ |
| Only the home page has a Spanish twin (/es/); it has no "How to Play" section | Spanish article routing would be new; no existing pattern beyond a copied page | src/routes/(marketing)/es/+page.svelte |
| Sitemap is a static file with six URLs, no lastmod | New articles are invisible to it until plan 01 makes it dynamic | src/static/sitemap.xml |
| `ReplayBoard.svelte` renders the board as a CSS grid (Svelte 5 runes, SSR-safe, only `onMount` for keyboard) but always starts from the initial position and replays `moveHistory`; it also hard-codes the player header and outcome panel | Reusable as markup and styles, not as-is: a diagram needs an arbitrary starting position, highlights and optional stepping | src/lib/components/ReplayBoard.svelte |
| `BoardView.svelte` is a `<canvas>` renderer with Svelte 4 syntax (`export let`, `createEventDispatcher`) and window resize listeners; nothing is drawn until mount | Not suitable for prerendered diagrams: no server-rendered markup, no text for crawlers, heavy for a static figure | src/lib/components/BoardView.svelte |
| `CheckersGame` accepts a hand-built `board` array and `currentPlayer`, and exposes `getAllValidMoves`, `getCaptures`, `makeMove`; `ColonelBot` runs client-side (isomorphic) | A diagram can compute legal moves and forced captures from any position and even let the reader play a position against the bot in the page | shared/game.js (re-exported via src/lib/game.js) |
| GA4 is loaded in app.html (`G-906GR0NE7N`) | CTA click events from articles can be measured without new tooling | src/app.html |

### The rule set the articles must describe

Verified by running positions through `shared/game.js` (not inferred from comments). This matters because the FAQ says "Standard checkers (English draughts)" and the engine does not implement that.

| Rule | Engine behaviour | Standard English/American checkers | Source |
| --- | --- | --- | --- |
| Board, pieces, first move | 8×8, 12 each, red moves first, red starts on rows 5–7 (bottom) | Same layout; officially Black moves first | `reset()`, home step 1 |
| Men move | One square diagonally forward | Same | `_manMoves` |
| Men capture | All four diagonals, backwards included | Forward only | `_manCaptures` iterates `_directions()` |
| Kings move | Any distance along a diagonal ("flying") | One square | `_queenMoves` |
| Kings capture | From distance, landing on any empty square beyond | Adjacent piece, land immediately beyond | `_queenCaptures` |
| Forced capture | Yes; player chooses freely among captures (no majority rule) | Yes; free choice | `getValidMovesFor` |
| Multi-jump | Yes; a man that promotes mid-chain stops | Yes; same stop rule | `makeMove` (`promoted` blocks `chainContinues`) |
| Draws | 3-fold repetition; 50 half-moves without capture (labelled `'25-move'`) | 3-fold; 40-move rule in tournament play | `_checkForcedDraw`, shared/constants.js |
| Win | Capture all or leave the opponent no legal move; timeout at 60 s/turn unless unlimited | Same, minus the clock | `_checkGameOver`, `tickTime` |
| Bots | Minimax with alpha-beta; Easy depth 2 (ELO 600), Medium depth 4 (1000), Hard depth 6 (1400); eval = material 1/5, advancement 0.1 per row, centre 0.05, random tie-break | — | server/domain/botRegistry.js, `ColonelBot`, `evaluate()` |

The engine is closest to pool checkers (backward man captures, flying kings, free choice of capture). Every rules article must answer the searcher's question about standard checkers first and then state how Pure Checkers differs in a labelled "On Pure Checkers" box. See Open questions.

## Plan

### Routing decision

| Option | Prerender | Author ergonomics | Board component inside prose | Metadata for hub, sitemap, schema | Verdict |
| --- | --- | --- | --- | --- | --- |
| Markdown under src/content/strategy/*.md via mdsvex | Compiled to Svelte at build; one `[slug]` route with `entries()` | Best: frontmatter plus prose; diff-friendly | Yes: `<DiagramBoard position="..." />` inline | Frontmatter is the single source; `import.meta.glob` builds the index | Recommended |
| One `+page.svelte` per article | Native | Worst: prose in HTML, head/schema/CTA copied twelve times | Yes | Needs a separate registry anyway | Reject |
| JS/JSON content module with HTML strings | Native | Poor: escaping, no editor support | Only with a custom block renderer | Yes | Reject |

mdsvex adds one dev dependency (`mdsvex`, 0.12 or later for Svelte 5; confirm at install) and two lines in svelte.config.js (`extensions: ['.svelte', '.md']`, `preprocess: [vitePreprocess(), mdsvex({ extensions: ['.md'] })]`). Everything else is ordinary SvelteKit.

### Phase 1 — Routing, components and hub (effort: 3 days)

1. Install mdsvex and register it in svelte.config.js. Confirm `vite build` still prerenders the existing marketing pages.
2. Create `src/lib/content/strategy.js`: `import.meta.glob('/src/content/strategy/*.md', { eager: true })`, export `articles` (slug from filename, `metadata`, `default` component, reading time from the raw length), `getArticle(slug)`, `related(slug, n=3)` (frontmatter `related`, falling back to same `category`), `prevNext(slug)` ordered by hub order (category order, then `published`). The dynamic sitemap in plan 01 imports this module too.
3. Frontmatter contract (validated at build by a small assertion in the index): `title`, `description`, `category` (rules | openings | tactics | endgames | online), `published`, `updated`, `primaryQuery`, `secondaryQueries[]`, `related[]`, `faq[]` (`q`, `a`), optional `ogImage`, `lang` (default `en`), optional `translationOf`.
4. Create `src/lib/components/DiagramBoard.svelte` from ReplayBoard's `.board/.cell/.piece/.crown` markup and styles. Props: `position` (64-character string, `.`/`r`/`R`/`b`/`B`, parsed by `src/lib/content/position.js` into a `CheckersGame` by assigning `board` and `currentPlayer` exactly as tests do), `toMove`, `highlight[]`, `arrows[]`, `moves[]` (optional sequence to step through from the position, reusing ReplayBoard's slide animation), `caption`, `mode` (`static` | `step` | `try`). In `try` mode the reader clicks a piece, legal targets come from `getValidMovesFor`, forced captures are shown as the only options, and an optional `bot` prop (`easy`|`medium`|`hard`, depth 2/4/6) answers with `ColonelBot`. Render a `<figure>` with `role="img"` and an `aria-label` from the caption plus a visually hidden square list, so the diagram is text for crawlers and screen readers. The grid renders server-side; only stepping needs JS.
5. Create `src/lib/components/ArticleLayout.svelte`: head tags, JSON-LD, breadcrumb (copy the `.breadcrumb` styles from `game/[id]/+page.svelte`), title, dates line, Play CTA after the intro and at the end (`/auth`, `gtag('event','play_cta_click',{article_slug})`), FAQ block, related block, prev/next. Prose width 640px like `.prose` on the home page.
6. Create `src/routes/(marketing)/strategy/[slug]/+page.js` (`prerender = true`, `entries = () => articles.map(a => ({ slug: a.slug }))`, `load` returns the article or `error(404)`) and `+page.svelte` (renders `ArticleLayout` with the article component as a child).
7. Rewrite `src/routes/(marketing)/strategy/+page.svelte` as the hub: 150–250 words of real intro targeting "checkers strategy" and "strategy checkers", one section per category with article cards (title, description, reading time, updated date), a Play CTA, BreadcrumbList and a `CollectionPage` JSON-LD. Empty categories are hidden until they have an article.
8. Redirect /blog: `blog/+page.js` load returns `redirect(301, '/strategy')`. After `vite build`, check the response is a real 301; if adapter-node serves a meta-refresh for the prerendered redirect, drop `prerender` on that route so the server answers directly. Remove Blog from the sidebar, mobile menu, footer and sitemap.xml.
9. Internal links into the hub: add an optional `href` to FAQ items ("Read the full rules"), link the home "How to Play" section to /strategy/checkers-rules, keep the sidebar "Strategy Guides" entry.
10. Tests: a vitest file that loads the index, asserts every article has the required frontmatter, unique slugs, at least one `DiagramBoard`, and that every `position` string parses into a board where `getAllValidMoves()` is non-empty for `toMove`.

Done when: `vite build` emits build/prerendered/strategy.html and one HTML file per article, /blog returns 301, the hub lists articles from frontmatter, and a diagram renders without JS.

### Phase 2 — Information architecture

- `/strategy` is the hub. Categories in this order: Rules, Openings, Tactics, Endgames, Playing bots and online. The order is also the prev/next reading order.
- `/strategy/[slug]` is an article. Visible breadcrumb Home / Strategy / Title, mirrored by BreadcrumbList.
- Prev/next follow hub order so a reader flows from rules to openings to tactics; no date-based ordering.
- Related block: three cards from frontmatter `related`, otherwise same category, never self.
- Play CTA in every article: after the first section ("Try it now — free, no account") and at the end. Both point to /auth as the home page does.
- /blog is folded into /strategy with a 301. /changelog remains the news page; the plan 05 launch post lives there. If the owner later wants a dev diary, the same mdsvex pipeline serves `src/content/blog/` at no routing cost; do not resurrect the stub before there are three posts to show.
- FAQ stays the short-answer page. Each rules answer keeps its one-paragraph text and gains a "Read more" link to the article; articles never copy FAQ sentences verbatim.

### Phase 3 — The first twelve articles (effort: 4–6 h each, 8 h for the pillar)

Write in this order. The first four are numbered; the rest are grouped by category. Lengths are words of body text excluding FAQ and captions. "Seed" names the first-party copy the article expands.

| # | Slug | Working title | Primary query | Secondary queries | Intent | Words | Seed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | is-jumping-mandatory-in-checkers | Is Jumping Mandatory in Checkers? The Forced Capture Rule | is jumping mandatory in checkers | do you have to jump in checkers; forced capture rule checkers | Informational, quick answer | 1,200–1,500 | FAQ "What are the rules?", home step 3 |
| 2 | how-do-kings-move-in-checkers | How Do Kings Move in Checkers? Rules and Examples | how do kings move in checkers | can a king move backwards in checkers; can a king jump multiple pieces in checkers | Informational | 1,200–1,600 | home step 2 |
| 3 | checkers-rules | Checkers Rules: How to Play on the 8×8 Board | checkers rules | how to play checkers; checkers rules 8x8 | Informational, pillar | 2,000–2,500 | home "How to Play" (4 steps), FAQ rules |
| 4 | best-first-move-in-checkers | Best First Move in Checkers (and Why 11-15 Is Classic) | best first move in checkers | checkers first move; best opening move in checkers | Informational, strategy | 1,300–1,600 | home step 1 "Red always moves first" |
| 5 | can-you-move-backwards-in-checkers | Can You Move Backwards in Checkers? Men vs Kings | can you move backwards in checkers | can you jump backwards in checkers; checkers backward capture rule | Informational, quick answer | 1,000–1,300 | FAQ rules |
| 6 | checkers-vs-draughts | Checkers vs Draughts: What's the Difference? | checkers vs draughts | is draughts the same as checkers; difference between checkers and draughts | Informational | 1,200–1,500 | FAQ rules ("English draughts") |
| 7 | checkers-openings-for-beginners | Checkers Openings for Beginners: 5 Lines to Learn | checkers opening moves for beginners | checkers opening strategy; checkers openings explained | Informational, strategy | 1,800–2,200 | Article 4 |
| 8 | double-jump-in-checkers | Double and Triple Jumps in Checkers: How to Set Them Up | double jump checkers | triple jump checkers; how to set up a double jump in checkers | Informational, tactics | 1,200–1,500 | home step 3 "Chain multiple jumps" |
| 9 | checkers-traps | 5 Checkers Traps That Win Pieces (With Diagrams) | checkers traps | checkers tricks to win; two for one shot checkers | Informational, tactics | 1,800–2,200 | Article 8 |
| 10 | two-kings-vs-one-king-checkers | Two Kings vs One King in Checkers: Win or Draw? | 2 kings vs 1 king checkers | how to win checkers with fewer pieces; checkers endgame strategy | Informational, endgame | 1,500–1,800 | Article 2 |
| 11 | how-to-beat-a-checkers-computer | How to Beat a Checkers Computer (From Its Own Code) | how to beat a checkers bot | how to beat checkers ai; how to win against the computer in checkers | Informational, first-hand | 1,500–1,800 | FAQ "Can I play against bots?" |
| 12 | play-checkers-online-with-friends | How to Play Checkers Online With Friends for Free | how to play checkers online with friends free | play checkers with friends online; checkers online 2 player | Transactional | 900–1,200 | FAQ "Can I play with friends?", home "Room System" |

Outlines and diagrams:

1. **is-jumping-mandatory-in-checkers.** H2: Short answer: yes, in every standard rule set · What "forced capture" means on the board · Choosing between two captures · Multi-jumps: once you start, you finish · Huffing: the old penalty and why nobody uses it · On Pure Checkers · FAQ. Diagram: `try` mode, red to move with one capture and three quiet moves available; the reader clicks a quiet move and sees only the jump highlighted.
2. **how-do-kings-move-in-checkers.** H2: How a piece becomes a king · Movement: one square, any diagonal · Capturing with a king · Why kings are worth more than two men · Flying kings: the variant Pure Checkers uses · Three king mistakes beginners make · FAQ. Diagram: a king on a centre square with a toggle "Standard (one step)" / "Pure Checkers (flying)" that changes the highlighted reachable squares.
3. **checkers-rules.** H2: The board and setup · How pieces move · Capturing and forced jumps · Kings · Winning, drawing and the clock · Standard vs house rules (English, pool, international, Pure Checkers table) · Your first game in five minutes · FAQ. Diagram: starting position in `step` mode through the first four moves; second diagram: a king row promotion.
4. **best-first-move-in-checkers.** H2: The seven legal first moves · Why 11-15 ("Old Faithful") is the classic · Two other sound choices: 9-14 and 10-15 · Moves to avoid and why (edge moves) · What the Pure Checkers bot plays (depth-6 reply to each) · From first move to opening: what to read next · FAQ. Diagram: starting position with all seven first moves as arrows; clicking one shows the bot's preferred reply computed live by `ColonelBot`. Explain the standard 1–32 square numbering and that red on this site corresponds to the side that moves first.
5. **can-you-move-backwards-in-checkers.** H2: Men move forward only · Men and backward captures: standard vs pool rules · Kings move both ways · On Pure Checkers · FAQ. Diagram: a red man with a black piece behind it; toggle shows the backward capture available here and not in English rules.
6. **checkers-vs-draughts.** H2: Same game, two names · English draughts vs American checkers (identical) · International draughts: 10×10, flying kings, backward captures · Russian, Spanish, pool and Turkish variants in one table · Which one Pure Checkers plays · FAQ. Diagram: static 8×8 starting position beside a static SVG 10×10 (DiagramBoard needs an optional `size` prop or an inline SVG for the 10×10).
7. **checkers-openings-for-beginners.** H2: What an opening is trying to do (centre, bridge, tempo) · Old Faithful 11-15 · The Cross · Single Corner · Double Corner · Bristol · How to practise openings against the bot · FAQ. Diagram: one `step` board per opening through move 4–6.
8. **double-jump-in-checkers.** H2: How multi-jumps work · Setting one up with a sacrifice · Spotting the pattern: gaps behind pieces · A triple jump from a real game · Defending against double jumps · FAQ. Diagram: `step` chain capture; second diagram in `try` mode, "find the double jump."
9. **checkers-traps.** H2: The two-for-one shot · The breeches (fork) · In-and-out shot · Using forced capture to pull a piece · The dog hole · How to avoid them · FAQ. Diagram: one `step` board per trap; the last one in `try` mode.
10. **two-kings-vs-one-king-checkers.** H2: The honest answer: usually a draw · The double corner and why it holds · When two kings do win · Three kings vs one: the forced win · With flying kings (Pure Checkers) the theory changes · The 25-move draw rule and when to accept it · FAQ. Diagram: the double-corner draw in `try` mode against the Hard bot, so the reader tries to win and cannot.
11. **how-to-beat-a-checkers-computer.** H2: What a checkers bot actually does (minimax, depth 2/4/6) · What it values (material 1 and 5, advancement, centre) · The horizon: set traps one move deeper than it looks · Trade when ahead, avoid trades when behind · Easy, Medium, Hard: what changes · A position that beats Easy every time · FAQ. Diagram: `try` mode against the Easy bot in a position where it walks into a two-for-one.
12. **play-checkers-online-with-friends.** H2: Create a room in ten seconds · Share the code or QR · No account needed for either player · Playing on a phone · Ranked vs friendly, timers, unlimited mode · If your friend is offline: play the bot · FAQ. No board diagram; three annotated screenshots of the room flow with alt text.

### On-page requirements per article

| Element | Requirement |
| --- | --- |
| Title tag | Working title, 60 characters or fewer; append " — Pure Checkers" only if the total stays at or below 60. Primary query in the first half |
| Meta description | 140–155 characters, answer-first, contains the primary query, ends with a reason to click (diagram, try it) |
| Canonical | `https://purecheckers.com/strategy/<slug>`, no trailing slash, matching /faq and /changelog |
| Open Graph | `og:url` = canonical, `og:title` = working title, `og:description` = meta description, `og:type=article`, `article:published_time`, `article:modified_time`. Requires the layout to stop emitting a global `og:type` (see Dependencies) |
| Article JSON-LD | `@type: Article`, `headline`, `description`, `image` (article `ogImage` or the site OG image from plan 01), `datePublished`, `dateModified`, `author: { @type: Person, name: "Chris", url: "https://purecheckers.com/#about" }`, `publisher: { @type: Organization, name: "Pure Checkers", logo }`, `mainEntityOfPage` = canonical. Do not use HowTo: Google dropped HowTo rich results in 2023. Article 12 may add `SoftwareApplication` reference via `about`, nothing more |
| BreadcrumbList JSON-LD | Home → Strategy → article, positions 1–3, URLs absolute |
| FAQPage JSON-LD | Only when the article has a `faq` block of 3–5 questions that are not on /faq. Google no longer shows FAQ rich results for sites like this; the block is for readers and passage ranking, not stars |
| Headings | One H1 (title). H2 per section as outlined; H3 only inside a section; FAQ questions as H3 under an H2 "Frequently asked questions". No skipped levels |
| Internal links | Breadcrumb to hub; 2–4 contextual links to other articles; one link to /faq where a feature is mentioned; one to /#how-to-play from rules articles; related block; prev/next; two Play CTAs to /auth |
| Diagrams | `<figure>` with `role="img"`, `aria-label` describing the position and whose move it is, visible `<figcaption>`. Screenshots use `<img alt>` that states what the screen shows ("Room code and QR shown after creating a private room") |
| Dates | Visible "Published … · Updated …" line under the title, ISO in schema |
| House rules box | Every rules article has a labelled "On Pure Checkers" aside where the engine differs from the standard rule |
| Reading time | Computed from body length in the content index, shown on cards and under the title |

### Spanish

Recommendation: not now. Reasons: the domain has no authority, so the first job is to get English long-tail pages indexed and ranking; translation doubles per-article effort; the current hreflang emission is layout-global and wrong for any page other than home, so per-article hreflang needs the plan 01 fix first.

When to start: after at least three English articles show impressions in Search Console, or when the Countries report shows Spanish-speaking traffic. Start with the rules cluster (articles 1, 2, 3, 5) because Spanish players' expectations ("damas") already include flying kings, which is what the engine does.

Design it now so nothing is rebuilt later:

- Files: `src/content/strategy/es/<slug>.md` with `lang: es` and `translationOf: <en-slug>`. Slugs may be translated (`reglas-de-las-damas`), the mapping is in frontmatter.
- Route: `src/routes/(marketing)/es/strategy/[slug]/+page.js` and an `es/strategy/+page.svelte` hub, both reading the same index filtered by `lang`.
- hreflang: `ArticleLayout` emits `<link rel="alternate" hreflang="en">`, `hreflang="es"` and `x-default` (the English URL) only when the pair exists; the dynamic sitemap emits matching `xhtml:link` entries. `og:locale` becomes `es_ES` on Spanish pages, as `es/+page.svelte` already does.

### Sitemap and lastmod

Plan 01 replaces `src/static/sitemap.xml` with a dynamic route. This plan only asks that the route import `src/lib/content/strategy.js` and emit one `<url>` per article and the hub, with `<lastmod>` from frontmatter `updated` (fallback `published`) and, once Spanish exists, the hreflang `xhtml:link` pairs. Drop `changefreq` and `priority`; Google ignores them. Remove /blog from the sitemap when the redirect ships. The hub's lastmod is the newest article's `updated`.

### Editorial cadence and effort

| Item | Effort |
| --- | --- |
| Phase 1 routing, DiagramBoard, ArticleLayout, hub, blog redirect, FAQ/home links, tests | 3 developer-days |
| Article (research 1 h, position design and engine check 1 h, writing 2 h, diagrams, schema, QA 1 h) | 4–6 hours |
| Pillar article 3 | 8 hours |
| Monthly refresh pass (update dates, fix links, add a diagram where GSC shows impressions without clicks) | 2 hours |

Schedule for one person working part-time:

| Window | Deliverable |
| --- | --- |
| Days 1–5 | Phase 1 shipped; hub live with the intro and no articles yet is acceptable for two days at most |
| Days 6–30 | Articles 1–4, one per week; request indexing via URL Inspection for each |
| Days 31–60 | Articles 5–8 |
| Days 61–90 | Articles 9–12; first refresh pass on 1–4 using Search Console query data |

## Success metrics

All from Search Console filtered to pages containing `/strategy/`, plus one GA4 event. Record the average position of the twelve primary queries in a sheet monthly; GSC keeps 16 months but the query filter is manual.

| Metric | 30 days after article 4 is live | 90 days |
| --- | --- | --- |
| Articles indexed (URL Inspection) | 4 of 4 | 12 of 12 |
| Impressions on /strategy/* per month | 200 | 1,500 |
| Clicks on /strategy/* per month | 8 | 60 |
| Distinct queries with at least one impression | 20 | 120 |
| Primary queries ranking anywhere in top 50 | 4 of 12 | 10 of 12 |
| Primary queries in top 20 | 0–1 | 3 |
| Primary queries in top 10 | 0 | 1 |
| CTR on /strategy/* | 3% | 4% |
| `play_cta_click` per 100 article sessions (GA4) | 5 | 8 |

These are zero-authority numbers. If plan 05 lands its first links to the rules pillar, expect the 90-day impressions figure to double; do not plan on it.

## Dependencies and risks

- Plan 01: dynamic sitemap with lastmod; the site OG image (`/og-image.png` is referenced everywhere and absent); the layout must stop emitting global `og:type` and home-only hreflang so `ArticleLayout` can set them per page. Without the last item, articles ship with duplicate `og:type` and a wrong hreflang. Plan 01 Phase 1 step 4 scopes hreflang and `og:locale`; `og:type` and the image tags are handled by the `data.ogImage`/per-page pattern recorded under cross-plan wiring in 00-overview.md.
- Rules mismatch: the engine plays pool-style rules while the FAQ and home page say "standard checkers". Rules articles that describe only the engine's rules would be wrong for the searcher; articles that describe only standard rules would mislead a player who then loses a piece to a backward capture. Mitigation: answer the standard rule first, then the "On Pure Checkers" box. The owner's decision in Open questions may remove the problem.
- Thin content: a 400-word answer with no diagram will not beat existing results. Mitigation: minimum body lengths in the table above, at least one DiagramBoard per article (enforced by the Phase 1 test), a FAQ block with questions not on /faq.
- Duplicate content with /faq: FAQ answers stay short and link out; articles never reuse FAQ sentences; FAQPage schema on articles excludes questions already on /faq.
- AI-written content quality: generic checkers advice exists in thousands of copies. Mitigation, and the site's only real edge: first-hand material. Positions from the owner's own games (the game log persists `moveHistory` and /game/[id] already replays it; embed real positions by game ID once the database has games), the bot's actual evaluation and depth explained from `shared/game.js`, and interactive diagrams the reader can play. Every article should contain at least one thing that could only be written by someone who runs this site.
- Interactive diagrams need JS: the board markup is server-rendered so the position is visible and indexable without JS; only stepping and `try` mode need hydration. Keep DiagramBoard free of window listeners at module scope.
- mdsvex and Svelte 5: confirm the installed mdsvex version compiles runes-based components imported from `.md` files; if not, pin the version that does before writing articles.
- Prerender discovery: `entries()` on the `[slug]` route is required; relying on the hub's links alone would silently skip an article that is not yet linked.
- Google rich results: FAQ and HowTo rich results are gone for this class of site. Schema here supports understanding and passage ranking, not SERP decoration; do not measure success by rich results.
- Tone: the home page voice is personal and occasionally profane. Articles can be personal; they should not be profane, because rules pages get read in classrooms and shared by parents.

## Open questions

1. Rules variant. Should the engine (a) stay as it is and the site openly describe itself as pool-style checkers, (b) switch to English rules (forward-only man captures, one-step kings) to match the FAQ and the searchers, or (c) offer a rules option per room? The answer changes the "On Pure Checkers" box in every rules article and the endgame article's conclusions. Decide before article 1 is written.
2. Author identity. Article schema needs a Person. Is "Chris" enough, or is there a surname and a profile page to link? A short author box at the end of each article with a photo would help E-E-A-T more than any schema.
3. Should `try` mode against the bot ship in Phase 1 or later? It is the strongest differentiator (articles 4, 10 and 11 depend on it) and roughly one extra day.
4. Who writes: the owner alone, or the owner reviewing drafts? Either way the first-hand material (own games, own bot) must come from the owner.
5. Should /blog redirect to /strategy as recommended, or does the owner want a dev diary on /blog fed by the same pipeline?
6. Per-article OG images: use the single site image from plan 01 for now, or generate a board-position image per article with the plan 06 renderer once it exists?
7. Spanish trigger: accept the "three articles with impressions" rule, or set a calendar date?
