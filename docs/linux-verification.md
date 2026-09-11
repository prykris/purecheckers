# Clean Linux verification — 11 September 2026

The current working-tree application was copied into an isolated Linux container with fresh dependencies and a separate PostgreSQL container. No development or production database was used. This establishes local Debian/Linux compatibility, not Railway capacity, deployment continuity or a reviewed release commit.

## Environment and source

- Node **24.21.0**, Linux x64, Debian 12, glibc **2.36**.
- Image `node:24-bookworm-slim`, recorded digest `sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553`.
- PostgreSQL 16 Alpine, private Docker network, no host-published ports. Fresh `checkers_linux` and `checkers_linux_test` databases served startup and tests separately.
- Explicit OpenSSL **3.0.20** installation. The initial minimal image allowed migration/seed operations but emitted a Prisma detection warning and selected its OpenSSL 1.1 fallback. Installing OpenSSL and regenerating Prisma removed that ambiguity before the full suite.
- Source was archived from the application, tests, content, migrations, scripts and documentation plus root build manifests. Existing `node_modules`, `.env`, `.git`, `.generated`, build outputs and unrelated workspace directories were excluded. Original and tested SHA-256 manifests cover 548 and 549 files respectively; the latter includes the new timer regression test and the two corrected files copied into the container.

Evidence is under `.generated/linux-check-20260911-b71a/`. `tested-source-sha256.json` identifies the actual copied source, not a claim that the entire mutable workspace is a clean release candidate. Subsequent documentation changes do not alter the executed runtime files.

## Results

| Check | Observed result | Evidence file |
| --- | --- | --- |
| Locked clean installation | `npm ci` succeeded and generated Prisma | `install.log` |
| Native dependency selection | OpenSSL 3.0.20, glibc 2.36 and Linux x64 GNU resvg binding | `openssl-version.log`, `native-and-source.log`, `generate.log` |
| Fresh migrations | All **25** migrations applied; repeated deployment had no pending migration | `migrate-before-openssl.log`, `migrate-repeat.log` |
| Seed and repeat seed | Three bots and fifteen shop items; no duplicate provisioning | `seed-before-openssl.log`, `seed-repeat.log` |
| Production build | `npm run build` succeeded, including explicit Prisma generation; existing adapter unused-import warning remains | `build-final.log` |
| Full test suite after fixes | **1,095 tests across 103 files passed** | `tests-final.log` |
| Exact production start command | `npm start` performed migration deployment, idempotent seed and startup recovery before listening | `startup.log` |
| Built HTTP surfaces | Home, computer guide and sitemap returned expected content; bot roster contained three entries | `smoke.json`, `smoke.log` |
| Guest bot play | Human played red; one human move and an actual bot-worker reply reached the client | `smoke.json` |
| Reconnection and receipt reuse | New socket restored the same board/history; resending the accepted move did not execute it again | `smoke.json` |
| Settlement and native image | Resignation produced authenticated history and replay, plus a direct generated 1200×630 PNG with no static-image redirect | `smoke.json`, `game-preview.png` |

The smoke game ended by resignation after two plies. It does not prove a normal full-game win, a bot-first start in that particular smoke run, browser animation, phone interaction or any latency target. Those remain covered only to the scope of their separate tests/manual evidence. The full suite includes real socket, separate-process restoration, ownership, settlement, puzzles, shared state and native-image tests; inspect individual cases before making a narrower scenario claim.

## Failures found and corrected

The initial run passed 1,086 tests and failed two (`tests.log`). `puzzlePublishing.test.js` still expected verifier version 1.2.2 after the generator advanced to 1.2.3. It now asserts the exported current verifier version while preserving each stored puzzle's original generator provenance.

The other failure was the real matchmaking deadline publication test. Its timer could wake before `Date.now()` reached the deadline, send a snapshot with `fallbackOpen: false`, then stop. `setMatchmakingDeadline` now rechecks server time and rearms for the remaining interval. It publishes only when due and still owns the same session/search/timer; leaving matchmaking or replacing the session makes old callbacks inert. Long waits are bounded to the timer range. No browser countdown or second source of fallback state was introduced.

Seven deterministic regressions cover early wakeup, backward wall-time movement, late wakeup, replacement with identical timestamps, phase departure, session replacement, already-open deadlines and long timer intervals. The focused Linux run passed **89 tests across three files** (`tests-focused.log`), followed by the complete successful rerun.

## Reproduction and release limits

Use the recorded Node image digest with an explicit OpenSSL installation, a fresh source copy and isolated PostgreSQL databases. Run `npm ci`, Prisma generation, `prisma migrate deploy`, seed twice, `npm test`, `npm run build`, then `npm start`. The smoke script in the evidence directory starts and stops its own production process group and uses only the private verification database. It is an inspection artifact, not a production command or load generator.

The verification containers and private network are removed after completion; evidence and the source archive remain in the workspace. The existing `purecheckers-postgres` container is outside this verification and was not stopped or modified. Linux compatibility is now observed for this environment. A target-host build, capacity thresholds/measurement, active-game rollout plan and production acceptance are still required by [launch readiness](growth/launch-readiness.md).
