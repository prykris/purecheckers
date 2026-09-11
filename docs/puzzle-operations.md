# Puzzle publishing operations

Prepared locally on 11 September 2026. The owner delegated the runner choice: use a separate Railway cron service at 02:00 UTC daily, with manual owner monitoring, within the $10/month total hosting budget. First publication starts on the release's UTC date. Production import and service activation completed on 11 September; see the [release evidence](releases/2026-09-11.md). The same commands work manually from a computer with database access.

## Commands and availability contract

```sh
npm run puzzles:status
npm run puzzles:status -- --days 13
npm run puzzles:maintain
```

All commands use the configured `DATABASE_URL`. Status is read-only and selects dates/position hashes and recorded rejection hashes, without fetching solutions or performing search. It emits the UTC observation time, required interval, number of available dates, consecutive calendar coverage, first missing date, gaps and `rejectedDates`. `calendarComplete` means every required date exists; `healthy` also requires no recorded rejected position in that interval. Neither certifies quality beyond existing evidence. `--days N` includes today plus N future days: the default 30 requires 31 rows; 13 checks the minimum 14-day reserve in plan 03. `--days 0` checks today alone.

Maintenance is an explicit write command. It defaults to `--reverify 7 --target-buffer 30 --max-minutes 20` and prints a final `[puzzles:maintenance]` JSON report after commit. CPU-heavy search and reverification prepare proposals without holding a database transaction. A short transaction takes the shared advisory lock, compares verification evidence with current rows, rechecks publication dates and equivalent positions, and applies the eligible proposals. Concurrent preparations can do redundant CPU work, but cannot overwrite each other's puzzles. Generator options may override the defaults. `--help` prints usage without connecting. `--dry-run` writes nothing and reports proposed rows separately from written rows; final availability always describes the actual database. It can therefore exit short even if the dry run found enough candidates.

Generation and status use the same calendar policy. The check after maintenance uses a fresh UTC date, so crossing midnight cannot report success solely from an earlier horizon. A far-future row never hides a missing nearer date. `--target-buffer 0` skips generation, while its final report still checks today.

| Exit | Meaning | Operator action |
| --- | --- | --- |
| 0 | Required dates exist; maintenance transaction completed if requested | Retain report and timestamp; inspect any inconclusive verification findings |
| 1 | Database or execution failure | Check connectivity, migrations and preceding logs; do not infer that a lost response rolled back writes |
| 2 | Invalid options | Correct the command before retrying |
| 3 | One or more required dates are absent | Inspect first missing date and replenish; today missing is urgent |
| 4 | Another publisher held the database lock (maintenance only) | Inspect the active run; check status after it finishes before retrying |
| 5 | A failed puzzle was protected during this run, or the inspected interval contains a recorded rejected position | Review `protectedFailures` and `buffer.rejectedDates` (plain `rejectedDates` from status) immediately, even if calendar coverage is complete; do not automatically remove a published puzzle |

An inconclusive deeper search retains the previously verified puzzle and is reported separately. Availability is not proof of unique solutions beyond bounded search. Maintenance does not claim editorial approval. Its sourcing budget is not a hard wall-clock kill: reverification runs first, and an admitted search can finish after the sourcing deadline. The publishing transaction is capped at 30 seconds independently of search duration. It uses the database clock with a 30-second protection window, preserving rows that are public or could become public during that commit. Failed rows with existing attempts are retained; attempts are never deleted to force a replacement. A failed replacement rolls back the short transaction and releases ownership.

Prepared proposals for dates that have passed, occupied dates or equivalent positions are skipped and reported. Deeper verification is applied only to unchanged, still-unpublished rows; reaching depth 12 produces no redundant update. The final availability check uses a fresh UTC observation.

Conclusive failures from unchanged records create durable `PuzzleRejection` evidence in the publishing transaction, before any removal. The record has no foreign key to the puzzle, so deleting its unpublished row preserves the rejection. One canonical identity covers the position and its colour-swapped rotation. Evidence records source date, failure reason, verified depth, original generator version and verifier version; a shallower retry cannot replace stronger evidence. Budget-inconclusive results and stale observations do not create new rejections. Replacement failure rolls back the rejection and all other writes together.

Generation reads the exclusion set before deep verification. Commit and import recheck it under the shared publishing lock, covering candidates prepared before another process recorded the failure. A later shallow pass, different date or mirrored position cannot bypass quarantine. An identical import of an already-existing row remains a no-op and does not clear its rejection. Read-only status and subsequent maintenance runs continue to flag retained rejected puzzles in their inspected interval.

Quarantine means the stored puzzle requires review; it does not prove that every possible solution from that position is invalid. There is deliberately no automatic expiry or CLI bypass. Any future release from quarantine requires explicit review of the recorded evidence, the corrected line and the stronger verifier; clearing records casually would restore the original defect. No published content is automatically removed or rewritten.

## Selected Railway service

Use the separate `puzzle-publisher` service from the same repository and `master` branch. Railway rejected the legacy JSON configuration path during the 11 September rollout. The following settings are applied directly to the service; do not configure the web service with these commands:

| Setting | Deployed value |
| --- | --- |
| Service name | `puzzle-publisher` |
| Build command | `npx prisma generate` after normal dependency installation |
| Start command | `node scripts/maintain-puzzles.js` |
| Schedule | Daily at 02:00 UTC (`0 2 * * *`) |
| Restart policy | Never; investigate failures before rerunning |
| Database | Reference `${{Postgres.DATABASE_URL}}`; colocate with PostgreSQL in `us-west2` |
| Node | `RAILPACK_NODE_VERSION=24.21.0` |
| Public domain / HTTP health check | None; this process has no HTTP listener |

Apply the reviewed schema, including `20260911130000_puzzle_rejections`, through the normal release migration step before running these commands. The additive migration creates the durable rejection catalogue; it does not infer historical failures or alter puzzle content. This start command does not migrate, seed, start gameplay, acquire gameplay ownership or run a second web replica. It requires no JWT secret for puzzle generation. Start with self-play; sourcing real game records remains an explicit generator option.

Railway cron starts a process on the configured schedule and expects it to exit and close resources; a previous run still running causes the next occurrence to be skipped. See [Railway cron documentation](https://docs.railway.com/cron-jobs). The command disconnects Prisma in its completion path. Configure the proposed Never policy in [restart settings](https://docs.railway.com/deployments/restart-policy). These provider details were checked on 11 September 2026; inspect the deployed settings and first execution rather than assuming a document enables them.

## Initial load and monitoring

1. Review the launch date and validate the checked-in artifact with `puzzles:import`. If necessary, use `--start-date YYYY-MM-DD` to prepare a new consecutive interval. Applying the import is a separate production action. Same-date imports require matching position, solution and content; a stored deeper verification level is preserved. Conflicts roll back the whole batch.
2. After the approved import, run status against the intended database. Require today's puzzle and the full 31-date target. Record the release, service, UTC report time and date range in [launch readiness](growth/launch-readiness.md).
3. Run the maintenance command once on the chosen host and record its exit status and report. Verify that the process terminates, a second run does not duplicate dates and the web service remains responsive. Only then enable the proposed schedule.
4. Review each scheduled outcome and its timestamp. Missing runs need attention even if the last report was healthy. A full-target shortage needs replenishment; fewer than 14 consecutive dates warrants prompt investigation, and a missing today requires immediate action. Use the read-only status command to distinguish a stale runner report from current database coverage.
5. Retain and inspect reverification failures/inconclusive counts and off-rotation generation logs. Review puzzle explanations and play representative new lines before their dates arrive. Never repair a gap by shifting already assigned URLs or overwrite today's puzzle through the importer.

The owner monitors Railway run logs and the status command manually; no email or external paid monitoring integration is planned. Initial production import, resource-usage review and a manually triggered publisher execution are complete. The first automatic scheduled occurrence remains to be observed by the owner. A one-time healthy status report does not prove continuing operation.

## Local verification

Durable-rejection pass: **838 tests across 86 files** passed (`.generated/tests-puzzle-rejections-full.log`), including **42 focused tests across four files** (`.generated/tests-puzzle-rejections.log`). The production build passed (`.generated/build-puzzle-rejections.log`). Database tests prove rejection persistence after removal, exclusion of later and mirrored candidates/imports, rollback with failed replacements, retention of stronger evidence and persistent status alerts for a published failure. A seeded generator run proves rejected positions are excluded before deep verification. Prisma client generation, schema validation and migration deployment succeeded against local `checkers_test`; production was not modified. Schema/migration and empty-fixture checks are recorded in `.generated/validate-puzzle-rejections-schema.log`.

The final settled suite passed **835 tests across 86 files** (`.generated/tests-puzzle-publishing-release.log`); the final production build passed (`.generated/build-puzzle-publishing-release.log`). The focused publishing/generator/buffer/API run passed **39 tests across four files** (`.generated/tests-puzzle-publishing-final.log`). Database cases exercise the real commit, including publication after preparation, stale evidence, preservation of attempts, equivalent/occupied proposals, failed-position exclusion within a run, and rollback/released ownership after an insertion failure. Preparation tests cover conclusive failure, budget-inconclusive retention and the depth-12 cap without opening a transaction. This is local test-database evidence; no production publisher was activated.

Tests cover holes, missing today, inclusive horizons across a year boundary, midnight rollover after work, lock contention, dry-run reporting, transaction errors and strict options. PostgreSQL integration verifies read-only coverage and import retry/content conflicts while preserving deepened evidence. CLI smoke checks against the isolated test database demonstrate JSON output, nonzero shortage status and process exit with generation/reverification disabled. See [implementation status](growth/implementation-status.md) for final suite/build evidence. No production execution is implied.
