# Daily puzzles

Puzzles are separate from live socket games. The server publishes a dated, immutable position and solution; the browser plays that line through the same checkers engine. The attempt API validates the complete submitted player turns against the stored line before awarding anything. The solution is deliberately in the page payload, including today. There is no competitive puzzle leaderboard.

## State and progress

- `shared/puzzleProgress.js` owns engine replay validation and UTC streak calculation.
- `src/lib/puzzle/controller.js` owns local selection, complete capture turns, opponent replies and animation cancellation. Reset, account replacement and disposal invalidate outstanding callbacks. Animation completion never changes a live game or socket session.
- `src/lib/puzzle/journal.js` persists an outbox and history per account. Anonymous progress is claimed once at login. Late acknowledgements cannot mark a newer attempt synchronized or cross account/authentication generations. An offline solve retains its proof after restarting the puzzle. Focus, connectivity and the explicit Retry button retry pending writes using the shared 15-second request deadline. Malformed acknowledgements stay pending; failed/malformed history reads expose an error without partially installing the response. Invalid storage rows are discarded and denied persistence is visible.
- Confirmed server progress is the base for any still-pending local work. A server-recorded reveal replaces a conflicting local solve; it cannot extend the streak or claim a reward. A successful full history read also removes settled local entries absent from the server. Newer local attempt counts remain pending when an older acknowledgement arrives. Retrying a confirmed reward refreshes the existing account-profile owner even when that retry mints zero new coins; the client never installs a historical balance.
- API progress is monotonic. Revealing before solving permanently disqualifies that puzzle from the streak and reward. Revealing after a previously recorded legitimate solve does not remove that solve.
- A registered, non-bot account receives one coin for its first eligible solve of today's UTC puzzle. Guests and archives receive none. The transaction takes the shared account row lock, rechecks retirement, then takes the per-puzzle/identity advisory lock. Attempt, wallet, ledger and reward marker commit together. Retrying a request does not mint another coin; a failed ledger write rolls back the entire attempt/credit.
- Statistics describe saved attempts by identity, not deduplicated natural persons across browsers/accounts. One aggregate query produces their counts and rates.

`/puzzle` and `/puzzle/YYYY-MM-DD` render the board on the server. Archived explanations are visible without JavaScript; today's explanation remains hidden until solved or revealed. The hub and today's response cache cannot cross midnight UTC. An open page acknowledges a new date only after its SvelteKit data reload succeeds. Failed midnight reloads retry on focus, connectivity restoration and a 30-second timer, with one reload at a time and cleanup on disposal. Future dates are excluded from the API, pages, archive, sitemap and image service.

## Recovery verification — 11 September 2026

The full suite passed **793 tests across 81 files** (`.generated/tests-puzzle-recovery-full.log`). The final focused run passed **32 tests across four files** (`.generated/tests-puzzle-recovery-acceptance.log`), including an expanded test that actually plays all 31 launch puzzles through PuzzleController and validates each resulting solve proof. The production build passed (`.generated/build-puzzle-recovery-final.log`); a subsequent final build covers the one-line profile-refresh condition for already-earned rewards.

Coverage includes server-reveal/local-solve reconciliation, newer pending counts, malformed confirmations, a timed-out abortable request and successful retry, history read failure/recovery, same-token authentication replacement, malformed/denied storage, midnight reload failure/coalescing/disposal, a real database retirement lock race and ledger-failure rollback. These are local checks; browser/device, production buffer and hosting acceptance remain separate. No puzzle content, reward amount, schema or production data changed in this pass.

## Page metadata and discovery — 11 September 2026

Dated puzzle pages now identify the date and side to move in the title, and difficulty/theme/date/side in the description. Descriptions invite the reader to find the combination without asserting that every material-gain puzzle wins the whole game. `presentation.js` supplies the common theme labels and guide destinations for the board, archive and learning link. Every current generator theme maps to an existing article; new themes fall back to the strategy hub.

PublicIndex derives visible breadcrumbs and BreadcrumbList from the same parent list. Dated puzzles use Home → Daily Puzzle → date; ordinary public indexes keep their existing two-item hierarchy. Each puzzle page emits WebPage linked to the site's WebSite; dated pages include publication and solution-reveal modification dates. The previous standalone archived Article block was replaced by this page-level schema. Published previous/next links appear in the head as well as visible navigation. The hub explains that promotion ends a man's capture turn.

**22 focused tests across four files passed** (`.generated/tests-puzzle-pages.log`), including actual server rendering of the shared breadcrumb component, every theme's guide destination and page-loader missing/future/error behavior. The final production build passed (`.generated/build-puzzle-pages-release.log`). **106 parsed checks passed over 16 local HTTP responses** (`.generated/audit-puzzle-pages-final.log`, `.generated/puzzle-page-http/audit.json`): empty/current/archive/future pages, metadata multiplicity, WebPage/breadcrumb hierarchy, navigation, SSR board/solution visibility, sitemap dates, discovery links and real generated PNGs. The archived fixture has 330 visible explanation-section words; the hub evergreen section has 205. These earlier rendered counts are not an editorial uniqueness review; the later [editorial review](puzzle-editorial-review.md) records the revised artifact separately.

The actual current preview was inspected: 1200×630 with a clear position, mover, date and brand, and no solution moves. Published fixture PNGs were 54,038 and 57,585 bytes; the future preview fell back to the generic image without exposing the puzzle. The fixture runner permits only local `checkers_test`, refuses existing puzzle rows, creates three dated examples, then deletes only its own IDs and closes the HTTP server, preview worker and Prisma connection. No production write or publication occurred. Real-device layouts, external preview caches and deployed structured-data tools remain separate acceptance checks.

## Generating and publishing

### Search and import verification — 11 September 2026

The import command now validates the complete definition before publication: an 8×8 board on playable squares, valid pieces/mover, at least five pieces and three legal choices, an odd complete-turn line of at most seven plies, depth at least `max(line length + 2, 8)`, finite gap metadata, supported classification, nonempty commentary and generation provenance. Imported hops, captures, promotion flags and endpoints must exactly match legal engine turns. Difficulty and themes must match the existing generator classifier. Dates must be UTC publication dates; reassignment requires a valid UTC midnight. Reviewed prose is preserved, not regenerated by import.

**61 focused tests across six files passed** (`.generated/tests-puzzle-definition.log`). New coverage rejects corrupt board/turn metadata, discontinuous capture chains with unchanged landing-square keys, incorrect classification, invalid dates and insufficient verification depth. Search coverage explicitly selects a stronger capture-chain continuation than the first enumerated branch, rejects two winning choices, and treats exhausted verification as inconclusive.

An independent exhaustive reference uses raw engine hops and ordinary clones, without generator move enumeration, pruning, ordering or terminal-score helpers. It matches depth-three search with full forced-capture extension for all 31 launch positions and checks conservative score bounds for their root choices. This is independent shallow-search evidence, not an independent depth-nine proof. The real import CLI separately reverified **all 31 positions at their recorded depths** (`.generated/verify-puzzle-artifact.log`) and exited successfully with no rows written. These script-only changes were exercised through the actual CLI; the preceding production build remains recorded above.

Source tracing confirms the prescan is a conservative yield filter before depth-six candidate selection. Deep verification rechecks every player decision and opponent defence, rejects competing wins and insufficient separation/gain, and ends a published line at a realized gain with forced replies settled or a terminal win. Scores from windowed searches can be bounds: `scoreGap` records generation evidence, not an exact piece count or an unlimited proof. Classification reuses the verified line; publication uses shared symmetry hashes and stable calendar slots. A shortage may use a nearby difficulty and logs off-rotation substitutions rather than pretending every generated batch meets the ideal weekly mix.

The six theme paragraphs and all 31 local launch explanations now have a [position-by-position editorial review](puzzle-editorial-review.md), with individual tactical notes, legally replayed examples and explicit text-duplication evidence. Remaining plan-03 work includes owner/device acceptance, the feedback destination and production import/runner/monitoring. Durable rejection evidence now excludes failed positions across later generation, commit and import runs, including mirrored positions. The nightly mutation coverage, short publishing transaction and quarantine policy are recorded in [puzzle operations](puzzle-operations.md).

### Commands

Run searches in a separate process, never inside the socket server:

```sh
npm run puzzles:generate -- --dry-run --seed 1 --target-buffer 30 --max-minutes 20
npm run puzzles:generate -- --reverify 7 --target-buffer 30 --max-minutes 20
```

The second command writes to the configured `DATABASE_URL`. Deployment/production execution is a separate action. The time limit stops sourcing new positions; a bounded search already in progress can finish after that limit. Nonzero exit codes distinguish invalid options, failures, incomplete buffers and another active publisher.

Generator 1.2.2 chooses the shortest line that realizes a material gain after compulsory replies have settled, or a terminal win. It verifies every decision point at depth 8 or deeper, with capture continuation branching and quiescence. Verification is bounded search, not an unlimited mathematical proof. Commentary reports actual piece counts instead of interpreting evaluation scores as exact material gains.

Version 1.2.1 records the shared evaluator's exact integer arithmetic: equivalent scores no longer differ through floating-point summation. That can change seeded self-play choices, so the deterministic generator fixture is versioned separately from API fixtures. The existing 31-puzzle launch artifact retains its original 1.2.0 provenance and passed deep re-verification under the corrected evaluator without database writes.

Version 1.2.2 fixes real-game sourcing and position commentary. Game sourcing uses the shared public discovery policy and keyset scanner, including eligible games older than the first 500 records. A shared replay validator accepts positions only after eight complete turns and validates the entire history; illegal suffixes and unfinished capture chains invalidate the source. The API rechecks eligibility and verifies that the puzzle board and side to move actually occur in the cited replay. It returns a verified source link and public participant names, which the page displays. Missing or ineligible sources produce no attribution. Responses for source-backed puzzles use `no-store`, inherited by the page loader, because names and eligibility can change.

Position commentary now distinguishes actual men and kings, and reports advanced-piece counts without inferring an attack from those counts alone. All 31 local launch-artifact position paragraphs received this editorial correction; positions, solutions, dates and original generation versions were preserved. Each full explanation still exceeds 250 words. Existing published database rows were not modified: the importer continues to reject content conflicts instead of silently replacing them.

Source/commentary validation: **37 tests across six files** passed (`.generated/tests-puzzle-sources.log`), including source eligibility, older batches, invalid replay suffixes, incomplete capture chains, attribution mismatches, public-name projection, mutable-source cache headers, seeded generation and all 31 actual-controller solutions. The production build passed (`.generated/build-puzzle-sources.log`). This does not constitute production publication or completion of the remaining generator criteria audit.

The initial reviewed artifact is `data/puzzles/launch-buffer.json`: 31 positions, dated 10 September through 10 October 2026, with 9 easy, 13 medium and 9 hard puzzles. Every date follows the weekly rotation. All lines passed the latest deep verifier and actual-engine solve validator. Each explanation has at least 250 words before the additional legal-choice summary. Browser play and editorial acceptance by the owner remain launch checks.

Validate/import that artifact without rerunning self-play:

```sh
npm run puzzles:import -- data/puzzles/launch-buffer.json
npm run puzzles:import -- data/puzzles/launch-buffer.json --apply
```

The default is validation only. `--start-date YYYY-MM-DD` assigns consecutive dates when preparing a later launch. Review the reassigned dates before applying. Imports reverify the lines before entering the publishing transaction. Generation and import share one PostgreSQL advisory lock. Identical imported rows are skipped, conflicts abort the entire import, and existing dates are never overwritten. Generation prepares outside the transaction, then rechecks current evidence, dates and symmetry in a bounded commit. Reverification removes only unchanged, still-unpublished failures without attempts and fills their holes; it never shifts other puzzles' URLs. Protected failures are retained and reported for attention.

`npm run puzzles:status` now reports read-only calendar coverage and missing dates. `npm run puzzles:maintain` reuses the generator with seven-day reverification, then checks the actual buffer after commit using a fresh UTC date. Generation, status and maintenance share the same calendar policy. See [puzzle-operations.md](puzzle-operations.md) for commands, exit codes, proposed Railway settings and monitoring. Imports reject same-position content conflicts and preserve previously deepened verification. No production buffer or recurring service has been installed; the runner choice, activation and alert destination remain pending.

## Manual acceptance

1. Solve today's puzzle using tap, drag and keyboard. Try a wrong complete capture branch and a hint. The board should recover without skipping an opponent reply.
2. Reload, go offline after loading, solve, then reconnect. Progress should sync; a registered account should receive at most one daily coin. Switch accounts and verify histories stay separate.
3. Reveal before solving, restart and solve. It should remain ineligible. Open an archive date; its explanation should already be visible and it should award no coins.
4. Move between dates and use Back/Forward. A previous board or animation should not reappear. Check reduced motion and a narrow phone layout.
5. Share or copy a solved puzzle. The text and preview should contain no solution moves.
6. Open the same puzzle in two tabs. Reveal in one, then solve in the other and refresh its progress: the server's reveal must win, with no reward or streak extension. Fail a progress request, then use Retry; it should confirm without a duplicate coin. Keep a hub open across UTC midnight while offline, then reconnect: it should reload the new date without a manual page refresh.
