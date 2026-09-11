# Launch readiness

Checkpoint: 11 September 2026. **Launch is not cleared.** This is the current acceptance record for plan 05, the broader community-launch checklist. The application is deployed; see [production evidence](../releases/2026-09-11.md). No community posts, emails or directory submissions have been sent.

Use the [consolidated remaining-work queue](remaining-work.md) for current priorities. The numbered growth plans retain their original baseline observations. Use this record for launch gates, [implementation-status.md](implementation-status.md) for implementation checkpoints, [05-backlinks-distribution.md](05-backlinks-distribution.md#phase-2--review-drafts-and-author-brief) for review drafts, and [links-log.md](links-log.md) for actual distribution outcomes. A row marked planned in that log is not a scheduled or sent message.

The [requirement audit](requirement-audit.md) covers all 24 numbered implementation items in plan 01, including 112 local built-app HTTP checks. It leaves deployed crawler/platform checks open and does not yet audit every requirement in the other plans. Local verification is not launch clearance.

Latest local candidate: [11 September release preparation](../releases/2026-09-11.md). The complete 1,149-test Linux suite, clean build, fresh and baseline-upgrade migrations, seed and real production-start smoke pass. Production migrations, backup restore, bot/reconnect/replay, invitations, account upgrade, room and bot-game restart recovery, and puzzle publisher execution now have live evidence in that release record.

## Release record

Complete this against the exact release being considered; a later code, migration or hosting change can invalidate the corresponding evidence.

| Field | Current record |
| --- | --- |
| Candidate commit and clean build | `c4604e8` pushed to `master`; clean Linux build and 1,149 tests passed |
| Railway deployment ID and public origin | `db37db50-3f52-4f2c-95b5-f7ae0fb5c582`; https://purecheckers.com |
| Migration review and production application | Production backup restored successfully; all 25 migrations applied through `20260911140000_game_invitation_entry`. Follow [deployment.md](../deployment.md) and the linked rollout contracts |
| Active player/game migration handling | Only the release-test player observed online; no public rooms. Actual waiting-room and bot-game restart recovery passed; legacy private/offline-state observation is limited |
| Puzzle publication dates and runner | 31 dates, 2026-09-11 through 2026-10-11; 02:00 UTC runner enabled; manually triggered run passed; owner monitors first automatic occurrence |
| Acceptance executor/date/device | Codex, 2026-09-11 UTC; Windows Node client and Chrome desktop/390px mobile emulation |
| Community account, reply availability and first post date | Owner choices pending; the six-week calendar is relative, not scheduled |
| Licence and feedback destination | Resolved: no open-source licence; existing GitHub Issues verified enabled and linked. See [owner decisions](owner-decisions.md) |

## Gates and required evidence

Local implementation is useful evidence but does not pass a production gate. Record the release ID, UTC time, device/browser, result and supporting artifact or URL when completing a check. A failed check stays open until the same scenario passes after the fix.

| Gate | Current evidence | What closes it |
| --- | --- | --- |
| Full roadmap scope | All twelve guides are present. Profile revisions, resource recovery, durable friendship/equipment commands and equipped-skin rendering have local coverage; theme policy/application and broader manual acceptance remain open | Finish and verify the open requirements in [implementation-status.md](implementation-status.md); do not redefine them as launch deferrals |
| Reproducible release | [Original Windows setup](../setup-verification.md) and the later [clean Linux run](../linux-verification.md) have evidence. Linux applies 25 migrations and passes all 1,095 tests, build and production-start smoke; no release commit selected | Review the full candidate diff, verify the target Linux/Railway build, record commit/artifacts and review pending migrations |
| First visitor can play | Bot registry, automatic provisioning, search and game socket tests exist | On the deployed candidate, a fresh guest starts and finishes a bot game without lobby-list intervention; record elapsed time against plan 05's two-minute target and whether the finish was normal or resignation |
| Recovery and navigation | Command/snapshot, checkpoint, ownership and restoration implementations have local tests | Run the concise recovery checks below, plus the linked lifecycle acceptance scenarios, on the deployed candidate |
| Host capacity and replacement | Bounded workers and local two-process recovery tests exist | Record the chosen concurrency, game mix and host limits; measure turn/ack latency, event-loop delay, CPU, memory and database failures during sustained play and replacement. No target or pass threshold has been selected yet |
| Puzzle publishing | `data/puzzles/launch-buffer.json` has 31 locally verified entries, 2026-09-10 through 2026-10-10; status/maintenance and [runbook](../puzzle-operations.md) exist | Validate actual launch dates, apply the reviewed import, confirm today plus 30 future dates with status, and verify the chosen runner and monitoring operator on the target host |
| Public discovery | Dynamic sitemap, metadata and public eligibility tests exist | Fetch the deployed sitemap and a listed article/puzzle; check final status, canonical, indexability, JSON-LD and non-spoiling social image. Verify private/invite/app URLs are excluded as designed |
| Preview cards | Local image rendering/cache/privacy tests exist | Confirm home, result, puzzle and invite previews in actual target-platform preview/draft tools; verify a private profile has no personal preview. A local PNG does not prove a platform fetch |
| Claim accuracy | Phase 2 drafts now describe actual rules, bounded bot depth and recovery limits | Play/check each advertised feature on the exact deployed version; remove any failed or unverified claim before posting |
| Repository presentation | README/local commands corrected through clean-copy verification; actual gameplay screenshot exists | Check that the published README/assets match the selected release; local setup evidence does not prove the remote repository contains it |
| Feedback | Existing GitHub Issues verified enabled; links added to FAQ/footer/Profile/README | Confirm links on the deployed candidate; GitHub account required and reports public |
| Licence | Owner explicitly rejected open-source licensing | Closed decision: add no open-source licence, omit open-source claims and exclude licence-dependent venues |
| Measurement | Client `track()` helper and gameplay/puzzle/share events exist | Verify expected events in GA4 DebugView/Realtime for the deployed build, confirm traffic acquisition access and save the report location; document remount duplication and blockers before interpreting conversion |
| Venue suitability | Original target list has mixed verification; HN rules rechecked this pass | Read each selected venue's current rules, confirm self-promotion/AI-text policy, submission path and ruleset fit; record source and date before preparing the final submission |
| Reply capacity and authorization | No outreach authorized by this goal | Owner selects the final content, account and destination and authorizes sending; reserve time for replies and record the published URL only after successful submission |

## Concise owner acceptance pass

Use two browser profiles or devices for distinct players. Use a disposable local/staging account for failure injection and replacement before repeating approved production checks. Do not reset the production database or manufacture matches to populate public discovery.

1. **Bot first turn:** enter as a fresh guest and start a bot game. When the bot gets the first turn, wait for its move, make yours, then briefly disconnect during a later bot turn and reconnect. Board, turn and timer must recover without refreshing or replaying a move twice. Finish once and open the resulting replay.
2. **Friend and URL:** open a nearby invitation on the second device, complete the ready/reveal flow, and try reload plus Back/Forward on both devices. The accepted session and visible URL must agree. Also open an expired/full invite and confirm a usable exit. The friends guide already has three local captures; verify their instructions against the deployed candidate.
3. **Replacement:** on a controlled candidate deployment, interrupt one human game and one bot game with a server replacement. Verify the saved board and explicit Resume game pause. Check both players returning, one returning and neither returning; verify cancellation/refund results against [game-restoration.md](../game-restoration.md). Also test restored waiting rooms and active-game spectators using [durable-rooms.md](../durable-rooms.md). Also verify result views, retained rematch consent, dismissed viewers and original deadlines using [result-lifecycle.md](../result-lifecycle.md).
4. **Puzzle and wallet:** solve today's puzzle with a registered account, repeat synchronization/reload, and confirm one coin and one ledger credit. Try an archive puzzle and a reveal-before-solve attempt: neither earns a coin. Confirm an offline attempt synchronizes after reconnect and does not cross accounts. Detailed checks: [puzzles.md](../puzzles.md), [wallet-actions.md](../wallet-actions.md), [account-lifecycle.md](../account-lifecycle.md).
5. **Phone and sharing:** verify moves, capture chains and reduced-motion behavior; open a replay, share an invitation and inspect generated previews. Read a strategy guide and test its board controls on a narrow screen. Record actual platform preview results separately from local rendering.

These five groups organize the manual pass; they do not replace the broader automated tests, deployment checks or unfinished roadmap requirements.

## Claim evidence for editors

| Safe description of the implemented behavior | Evidence and boundary |
| --- | --- |
| Pure's 8x8 rules include forced captures, backward man captures, flying kings, free capture choice and promotion ending the turn | `shared/game.js`, `src/content/strategy/checkers-rules.md`; avoid calling the full ruleset standard English, American or formal tournament pool checkers |
| Three bot levels use bounded search with depth limits 2/4/6 | `server/domain/botRegistry.js`, `shared/botSearch.js`, [bot-workers.md](../bot-workers.md); achieved depth depends on budget, and fallback moves are possible |
| Live gameplay commands are accepted by the server and presented through snapshots | `src/lib/sessionClient.js`, `server/domain/games.js`, [game-checkpoints.md](../game-checkpoints.md); animations do not decide legal moves |
| Shared navigation coordinates routes with accepted session state | `src/lib/navigationController.js`, `src/lib/navigationPolicy.js`; avoid claiming there are no component navigation calls anywhere |
| Unfinished checkpointed games can be restored with an explicit readiness pause | [game-restoration.md](../game-restoration.md), [deployment.md](../deployment.md); waiting rooms and active-game spectators also restore locally; recorded notices/dismissal survive restart; result views, deadlines and rematch consent now restore locally; Railway continuity remains unverified |
| Today's eligible registered-human puzzle solve earns one coin, once | `server/services/puzzles.js`, `tests/puzzle.test.js`; UTC dates, no archive rewards, reveal-before-solve ineligible, production publishing enabled; live coin/ledger acceptance still separate |
| Recorded games can be shared; indexing follows a stricter public eligibility policy | `shared/gameResult.js`, [share-previews.md](../share-previews.md), sitemap/SEO tests; do not claim every game is indexed or every terminal result has already settled |
| Analytics events are emitted where the browser permits | `src/lib/analytics.js`, `GameScreen.svelte`, `PuzzleBoard.svelte`; these are browser signals, not exactly-once financial/game receipts. Component remounts can repeat start/end events |

Do not claim a particular hosting price, player population, measured strength, complete move grading, guaranteed latency, seamless deployment or an open-source licence without separate current evidence.

## Distribution rules rechecked

Checked 10 September 2026: [Show HN guidelines](https://news.ycombinator.com/showhn.html) call for a personally built project visitors can try and prohibit soliciting votes or comments. [HN guidelines](https://news.ycombinator.com/newsguidelines.html) prohibit generated or AI-edited text. The owner must write HN prose independently; plan 05 now contains only an author brief for that venue. Recheck these pages at submission time.

The other venue rows are still research leads, not current permission to post. An attempted check of awesome-selfhosted's previously assumed `.github/CONTRIBUTING.md` path returned 404; its current contribution path and eligibility were not verified. No success status or outreach date was added to the links log.
