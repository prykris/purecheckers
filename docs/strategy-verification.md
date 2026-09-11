# Strategy content verification

## Current scope

All twelve planned English guides exist. The friends walkthrough completes the written guide set with three annotated room screenshots instead of a board diagram, as its brief requires. The four original guides were revised after independent review, and all later guides have their own review records. This is local content verification, not a production publication or full-roadmap completion record.

Article frontmatter remains the shared source for the hub, metadata, visible FAQ/schema and sitemap manifest. `strategyCatalog.js` supplies one validation/index contract to the Svelte catalogue and the Node manifest generator. Authors supply prose, sources and diagrams rather than copying navigation or tracking behavior. The strategy-only mdsvex plugin inserts ArticlePlayLink after the introduction and before the first H2; ArticleLayout owns the closing CTA. Both use the shared analytics helper.

## Rendered editorial checks — 11 September 2026

The computer guide now tells readers how to select **My games**, open a saved **Replay**, step back before a misunderstood exchange and compare their predicted capture with the recorded move. The instructions were checked against GameLog's actual controls and ReplayBoard's previous/next behavior. The guide now has **1,550 rendered body words**, excluding FAQ, figures/captions, scripts, styles and the injected intro CTA. This closes the earlier 1,490-word finding by adding a useful practice step.

Descriptions for the first-move, king-movement, variant-comparison and beginner-opening guides now state the central advice or rules distinction directly. The beginner title explicitly names “checkers opening moves for beginners.” Changed articles carry an updated date of 11 September; the shared catalogue supplies that date to the page, cards and manifest. No deployed publication is inferred from it.

The two five-link articles were reviewed in context. In the opening guide, the extra mandatory-capture link repeated the rule already explained by its recapture paragraph; it was replaced with a concrete instruction to compare those two positions. In the traps guide, the closing opening-guide detour was removed so the conclusion stays with defensive checks for the displayed tactics. The specific supporting links remain. Both articles now have four contextual destinations, and all twelve are within the planned two-to-four range.

The old rendered audit selected public FAQ `h3` elements, but that page's questions are buttons. It could therefore pass the duplicate-question check with an empty comparison set. The audit now selects the actual `button.faq-q` controls and requires all eleven questions. A separate rendered prose audit reads all eleven answers too. Across the **51 article FAQ questions**, none repeats a public FAQ question or another article's question. No article paragraph or FAQ answer repeats a public FAQ sentence of eight or more words. That threshold deliberately reports substantive exact-text overlap; it does not establish that short phrases never repeat or that every article adds a distinct answer to every related topic.

**43 tests across three files pass**, and the production build passes with the existing adapter unused-import warning. **367 rendered checks pass** after regenerating the source/catalogue expectations from the current Markdown. The checks cover actual page/schema metadata, FAQs, links, diagrams, catalogue order and manifest dates. Logs: `.generated/tests-strategy-editorial.log`, `.generated/build-strategy-editorial.log`, `.generated/audit-strategy-editorial-rendered.log`, `.generated/audit-strategy-editorial.log`. All owned processes completed.

The current rendered body counts are:

| Guide | Body words | Planned range |
| --- | ---: | ---: |
| Mandatory jumping | 1,437 | 1,200–1,500 |
| Kings | 1,557 | 1,200–1,600 |
| Rules | 2,422 | 2,000–2,500 |
| First move | 1,322 | 1,300–1,600 |
| Backward movement | 1,017 | 1,000–1,300 |
| Checkers vs draughts | 1,220 | 1,200–1,500 |
| Beginner openings | 1,930 | 1,800–2,200 |
| Double jumps | 1,226 | 1,200–1,500 |
| Traps | 1,930 | 1,800–2,200 |
| Two kings vs one | 1,515 | 1,500–1,800 |
| Computer | 1,550 | 1,500–1,800 |
| Friends | 1,022 | 900–1,200 |

The source audit also inventories every heading and FAQ, but headings alone do not prove full outline coverage. `.generated/strategy-editorial-audit.json` explicitly reports literal primary-query mismatches rather than treating intent or synonyms as exact matches. The friends/endgame titles and several descriptions use grammatical variants of the stored search phrase; the original table also differs from some current query metadata. That wording comparison, comprehensive topic/source review and device/deployed acceptance remain open. This pass does not claim new independent validation of external rule sources, search rankings, analytics delivery or native interaction.

Manual check: after a saved bot game, use **My games → Replay**, step backward and forward through an exchange, and confirm the new exercise is possible with the visible controls. Article reading, phone layouts and interactive-diagram acceptance remain part of the existing browser checklist.

## Catalogue and intro placement — 11 September 2026

The shared contract rejects impossible calendar dates, reversed date ranges, duplicate/empty references, unknown related guides, duplicate slugs/questions and invalid optional image URLs. English is the only published article language; untranslated routes and `translationOf` fail explicitly until the Spanish architecture exists. A valid metadata shape must never publish a Spanish article under an English canonical accidentally.

The content tests compile all twelve real Markdown files through the intro plugin and Svelte parser, exercise invalid publication metadata and check deterministic navigation/related fallback. **49 focused tests across four files passed** (`.generated/tests-strategy-contract-final.log`), and the production build passed (`.generated/build-strategy-contract.log`). The first test attempt omitted mdsvex's `.md` extension setting; correcting that test fixture made it match the real build configuration, which already passed.

**367 rendered checks passed** (`.generated/audit-strategy-contract-rendered.log`), extending the prior page audit with intro-before-CTA-before-H2 placement, all prev/next boundaries, hub card ordering/title/description/reading time, hub intro length and manifest/catalogue date parity. A temporary local built-app HTTP server returned 200 for the hub/rules guide/sitemap, 404 for an unknown guide and a real 301 for `/blog` (`.generated/audit-strategy-contract-http.log`). It used the isolated test database read-only and closed its server/connections. This does not replace actual-device or production acceptance.

## Executable examples

Run `node scripts/verify-strategy.js`. The verifier compiles articles with mdsvex, reads DiagramBoard literals through Svelte's AST and replays scripted moves using the actual movement engine. It does not execute arbitrary article expressions. It checks positions, captions, notation, highlights, bot levels and unfinished capture chains.

Legality is necessary but does not prove an explanation or a claimed best move. `tests/strategyDiagrams.test.js` separately checks the examples' material claims: the forced backward capture, each response in the sacrifice, the supporting guard that prevents an unwanted continuation, the complete triple jump, promotion and king destinations. Static English/Pure toggles only change illustrative marks; every playable board uses Pure rules.

Compound move strings are expanded into individual visible hops by `diagramSteps`, shared with the diagram renderer. A multi-jump is still one game turn. Screen-reader labels expose legal landing squares; scripted stepping announces the current hop and whose turn follows it. Reset/navigation cancel animations and pending bot replies through the existing generation/cancellation contract.

## Friends walkthrough — 11 September 2026

The 1,019-word body explains standard private-room creation, sharing, manual readiness, the different Nearby shortcut, guest/registered rating rules, phone controls and recovery limits. Independent review passed at 94/100 with zero P0 (`.generated/article-review/friends/`). Three WebP screenshots total 55,016 bytes and have numbered annotations, alt text, captions, dimensions, lazy loading and links to the full-size image. The pictured QR belongs to a closed local demonstration room; the prose tells readers to create their own invitation.

Two separate guest browser profiles created and joined a free private room, readied up and played 11-15, 24-20, 8-11 and 23-19. The opponent's first move arrived without reload; the second browser also restored the position after switching to a 390-pixel emulated phone viewport. The game ended by explicit resignation, and both viewers dismissed their results. A second room supplied the final readiness screenshot, then both guests left. An unannotated gameplay capture is now in README. These checks are local, use the isolated test database and do not establish a complete actual-device or Railway acceptance pass.

The exercise exposed and fixed an idempotency defect in chat visibility that froze the standard room on Creating, the shared modal's reset-overridden centering, and the Windows production-handler import. The full suite passed 584 tests across 58 files after those fixes. Subsequent sharing changes passed 28 focused tests across four files and a fresh production build. When native sharing/clipboard fail, the shared component now exposes the actual target link for manual selection; a browser check forced clipboard denial, selected the complete invitation URL and confirmed a 200 response from its invite endpoint. No gameplay or chat messages were sent outside local test identities.

The built guide fits 1280-pixel desktop and 390-pixel phone viewports with no horizontal overflow, loads all three assets and opens a screenshot at full resolution. The final preview was restarted after rebuilding so these link checks used the current artifact. No warnings/errors were captured in the corrected browser flows. Preview/server processes and all task-created tabs were stopped/closed; emulation was cleared. Logs: `.generated/tests-friends-full.log`, `tests-friends-final-focused.log`, `build-friends-guide.log`, `verify-friends-guide.log`; screenshot provenance is recorded under the review directory.

## Traps evidence — 11 September 2026

The traps guide has five interactive examples: a two-for-one, breeches, an in-and-out shot, a promotion deflection and a dog-hole exercise. Four added regression cases enumerate every breeches reply and the losing king approach, both in-and-out king landings, the forced deflection/material cost, and both blocking wins plus the guard-vacating escape. Existing replay and supporting-guard checks cover the first example. English source patterns are adapted explicitly: Pask's in-and-out win is not forced under Pure's flying-king landing choice, and a dog-hole entry is not automatically forced.

Independent review passed at 94/100 with zero P0 (`.generated/article-review/traps/`). The body meets the 1,800–2,200-word target; one citation description was corrected to match NorthWest's page. Twenty-five focused strategy/SEO/sitemap tests, the diagram verifier and the final production build passed (`tests-traps-guide.log`, `verify-traps-draft.log`, `build-traps-final.log` under `.generated/`). The delivered artifact is the repository's rendered Svelte page; standalone PDF/hero and plugin preflight compliance are not claimed.

The built page was visually inspected at 1280×900 and an emulated 390×844 phone viewport, without horizontal overflow (client/scroll widths 1270/1270 and 390/390). In-and-out end/reset controls reached Black wins and restored the start. The exercise accepted 3-7 and 3-8 as Red wins; after reset, 1-6 followed by 5-1 produced a black king and handed the turn to red. No browser warnings/errors were captured. Screenshots were inspected inline; saving them was denied by the browser tool's workspace configuration. Emulation was cleared and the temporary preview/tab closed. This is local browser evidence, not actual-phone or production performance certification.

## Opening-search evidence

The beginner-opening guide provides five six-move practice branches using the existing step board. Its 1,989-word body distinguishes traditional English names from Pure's rules and makes no claim that the sample continuations are optimal. Tests verify every move, final material counts, both possible Old Faithful and Single Corner recaptures, the Cross's blocked landing, the guard supplied by Double Corner's 5-9 and Bristol's legal 20-24 continuation. The earlier first-move guide now correctly lists both black recaptures after 15x24: 27x20 and 28x19.

Independent review passed the opening batch at 93/100 with zero P0 (`.generated/article-review/openings/`). Twenty-one strategy/SEO/sitemap checks and the production build passed (`tests-opening-guide.log`, `build-opening-guide.log` under `.generated/`). Browser verification used the built page at 1280- and 390-pixel widths: no horizontal page overflow, working end/reset controls and matching step announcements. Shared move labels now resist shrinking/wrapping beside long notes. Temporary viewport settings were reset and the local preview/tab were closed. These checks do not establish production performance or publication.

Run `node scripts/measure-opening-search.js` to regenerate `src/static/research/opening-search.json`. It records all seven initial moves, every black reply score, completed depth, node count, settings and hashes of the movement/search/constants source files.

The editorial experiment disables wall-clock expiry and retains a 150,000-node limit to make results reproducible across machine speeds. It requests depth six and records all exact ties without choosing randomly. **Live games keep their time limit** and can return a shallower completed iteration. The article explicitly distinguishes the experiment from live behavior, human opening theory and production-game frequency. Regenerate the artifact and recheck the prose/table after search or evaluation changes; do not treat a new experiment as evidence for an old undocumented measurement.

## Source and editorial boundaries

- English movement/draw procedures: WCDF rules as republished by the North Carolina Checkers Association.
- International comparison: FMJD Annex 1.
- Traditional opening names: NorthWest Draughts Federation.
- The solved English starting-position result: University of Alberta's Chinook project; it does not prove the outcome of Pure's custom rules.
- Constructed practice positions are labelled as constructed. No claim is made that they came from an owner's or tournament player's game.

The endgame guide corrects the original roadmap's unsupported “two kings usually draw against one” premise. Federation material supplies an English winning example; our different flying-king plan has its own certificate. Run `node scripts/measure-endgame-proof.js` to regenerate `src/static/research/two-kings-proof.json`. The bounded search accepts a winning choice for red only when every legal black response has a winning continuation. Failure to find a certificate means “not proved”, never “draw”. An independent checker replays all 15 terminal branches, checks complete defensive coverage and preserves the actual engine's draw history. The proof applies only to the stated position, red to move and fresh history.

The comparison cites the IDF for Russian promotion, Portugal's 2026 federation rules for forward captures and quantity/quality priority, and the Draughts Association of Malawi for pool continuation. Its original static SVG has 100 squares and 20 pieces per side on the appropriate dark squares. It is an illustration, not a second playable engine. Pure's king landing freedom and immediate capture removal are explicitly distinguished from superficially similar rulesets.

## Later local checks on 10 September 2026

- After the exact-evaluation correction, the full suite passed 330 tests across 39 files. All 31 launch puzzles passed independent deep re-verification without writes; generator provenance was versioned as 1.2.1 while the existing artifact retained its historical 1.2.0 identity.
- Nine-guide diagram verification and the production build passed. Independent editorial review passed the endgame/computer guides at 93/100 aggregate and the comparison at 93/100, all with zero P0 findings. The records are in `.generated/article-review/endgames/` and `comparison/`.
- The comparison's built page was inspected in the in-app browser at 1200×900 and 390×844. Both board arrangements and captions were visible, the SVG loaded successfully, and the document's client/scroll widths matched (1190 on desktop, 380 on phone). The phone boards stack vertically. No warning/error entries were captured. After aligning the illustration's margin/caption with the shared diagram and updating dependencies, a fresh built-page load confirmed the aligned desktop boards, phone heading and 380-pixel client/scroll widths again.
- The full 330-test suite and production build passed again after dependency updates. Metadata/schema, description ranges and article links were rechecked for all nine built pages; see `.generated/article-review/rendered-checks.json`.
- This does not claim performance certification or actual-phone acceptance. Live try-board interaction for the two new tactical guides and remaining content/launch requirements are still separate checks.

## Earlier six-guide checks on 10 September 2026

- The strategy, browser-worker, board-keyboard, SEO-head and sitemap checks passed: 23 tests across five files.
- Production build passed. Article HTML contains one H1, canonical and OG image per page, Article/BreadcrumbList/FAQPage schema, and resolvable article links. Six descriptions meet the roadmap's 140–155-character range.
- A temporary local preview of the built double-jump page was tested in the in-app browser. Scripted 14x23 then 23x30 preserved the capture chain and handed the turn to black after crowning. Interactive 6x15 then 15x22 exposed the successive capture destinations in the accessibility tree.
- At a 390×844 viewport, the heading, prose and full board were visually inspected; document client and scroll widths both measured 380 CSS pixels. No browser warnings/errors were captured on reload. This is representative browser evidence, not a screen-reader certification, performance benchmark or complete mobile-device matrix.
- All six written guides passed the independent editorial re-review (aggregate 92/100, minimum 91, zero P0); this is an editorial gate, not a performance or production-launch approval.
- Independent review records and local logs live under `.generated/article-review/`; they are working evidence, not published editorial approval of the six unwritten guides.

## Manual acceptance

1. Open the backward-capture guide. The static toggle should change only the illustration. In the playable board, 18x9 should be the only red move, and the landed piece should remain a man.
2. In the double-jump guide, step forward/back and jump to start/end. The intermediate capture landing and restored captured pieces should match the selected step. Complete the three-hop practice chain and reset it.
3. In the first-move guide, play an opening then reset while the bot is thinking. A delayed reply must not alter the restored board. Try keyboard selection and reduced-motion mode.
4. Check article layouts on an actual phone, including variant buttons, capture targets, FAQ, related cards and both Play links. Browser automation has not replaced this device acceptance.
