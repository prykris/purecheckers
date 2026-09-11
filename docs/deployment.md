# Deployment

Current candidate and ordered rollout: [11 September release preparation](releases/2026-09-11.md).

The [11 September owner decisions](growth/owner-decisions.md) set a $10/month total hosting budget, owner monitoring and a separate 02:00 UTC puzzle publisher. `railway-puzzles.json` is for that scheduled service only. Profile challenges use the existing room JSON records and theme reset uses the existing equipment receipts; these changes require no new migration. Deploy server/client together and reload old tabs. Do not roll back to code that discards challenge fields while challenge rooms exist; drain/close those rooms first.

Pure Checkers stores accounts, wallets, recorded games and published puzzles in PostgreSQL, outside the application container. Creation, wager reservations, accepted gameplay checkpoints, command identities and terminal jobs are durable. Startup restores unfinished checkpointed games and their human game sessions before listening, with an explicit two-minute readiness pause. Waiting rooms, spectator roles, finished-result membership, rematch consent and notices also restore from durable records before listening; see [result-lifecycle.md](result-lifecycle.md). See [game-restoration.md](game-restoration.md) for the tested scope and rollout restrictions.

Terminal settlement commits the replay, statistics, rewards and vault changes together and retains a receipt for safe retries. Accepted terminal state and its job commit together before publication. Startup retries terminal jobs; writer generations fence the replaced server. Controlled local tests do not establish seamless Railway failover. See [game-settlement.md](game-settlement.md) for the financial contract.

## Why not SQLite

Earlier versions kept a SQLite file inside the app directory. On Railway every
deploy starts a fresh container, so that file was lost and `db push` plus the
seed rebuilt an empty database with only bots and shop items. Do not point
`DATABASE_URL` at a `file:` path again.

## Invitation entry migration

`20260911140000_game_invitation_entry` adds `GameRun.invitedPlayerIds` with an empty-array default. Deploy it through the existing `migrate deploy` startup sequence before the new server/client. Existing games remain unattributed; the migration does not guess from room origin or rewrite room JSON. New accepted code joins preserve their participant evidence through game reservation and restoration. This migration has only been applied to the isolated local test database; production rollout remains pending. [Durable room records](durable-rooms.md#accepted-invitation-entry) describes the ownership and compatibility boundary.

## Railway setup (one time)

The [clean Linux verification](linux-verification.md) passes on Node 24.21.0, Debian 12, OpenSSL 3.0.20 and the GNU x64 resvg binding. Make OpenSSL available before Prisma generation and confirm the actual target's native dependencies in its build/startup logs. A minimal image can emit a Prisma detection warning and choose a fallback even when installation succeeds. This local result does not establish compatibility with every Linux image or the configured Railway host.

1. In the Railway project, add a **PostgreSQL** database service.
2. On the app service, open **Variables** and set
   `DATABASE_URL` to the reference `${{Postgres.DATABASE_URL}}` (use the name
   of your Postgres service if it differs). Keep `JWT_SECRET`, `SITE_URL`,
   `NODE_ENV=production` and optionally `ADMIN_USERNAME`.
3. Deploy. The `Procfile` runs `npm run start`, which does in order:
   `prisma migrate deploy` (applies the reviewed pending migrations without resetting the database),
   `node prisma/seed.js` (idempotent upserts of bots and shop items), then the
   server.
4. Keep the app at a single replica. Gameplay runs under one database-fenced owner, with socket sessions and runtime projections in that process. Increasing the database connection budget does not make multiple configured replicas safe; horizontal scaling needs a separate ownership and socket-routing design. The server uses one shared Prisma client (`server/db.js`) and one connection pool per process.

Any data still inside an old SQLite container is not migrated automatically.
Copy `prisma/prod.db` out of the running container before switching if it is
worth keeping.

## Schema changes

Puzzle recovery changes add no migration. Deploy the server/client together and reload old tabs to receive progress validation and midnight-reload recovery. Confirmed retries retain the existing once-per-account/puzzle reward identity; the release must not reset attempts or publishing dates. See [puzzle recovery verification](puzzles.md#recovery-verification--11-september-2026).

Production applies the files in `prisma/migrations/` with `migrate deploy`.
After editing `prisma/schema.prisma`, create a migration locally against a
PostgreSQL database and commit it together with the schema:

```
npm run db:up            # local PostgreSQL via Docker (first time or after db:down)
npm run db:migrate:dev   # prompts for a migration name, writes prisma/migrations/<timestamp>_<name>
```

Tests run `migrate deploy` against `checkers_test`, so a schema change without
a migration fails the test run.

## Local development

```
cp .env.example .env     # DATABASE_URL already points at the compose database
npm ci                  # locked dependencies and explicit Prisma Client generation
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Tests default to `postgresql://postgres:postgres@localhost:5432/checkers_test`
on the same container. Create it once if absent with
`docker compose exec postgres createdb -U postgres checkers_test`, then run
`npm test`. Set `TEST_DATABASE_URL` to use another existing test database.
Tests apply migrations but do not provision the database itself. A custom
development `DATABASE_URL` likewise needs an existing database.

The example environment leaves `NODE_ENV` unset and points invitations at the
local client. The proxy follows `PORT`; `CLIENT_PORT` sets Vite's required port.
For a local production build, set `SITE_URL` and `ORIGIN` to the backend's HTTP
origin, run `npm run build`, then `npm start`. The production entry point sets
its mode before imports and works on Windows. Keep development dependencies
installed when using source build/migration commands. See
[setup-verification.md](setup-verification.md) for the clean-copy evidence and limits.

`prisma/migrations-sqlite-archive/` holds the retired SQLite migration history
for reference only. Prisma does not read it.

## Content and bot workers

The emote protocol now sends item IDs, checks free/owned catalogue access and acknowledges transient sends. All broadcasts include game context. Deploy server/client together and reload old tabs; raw client-authored emoji/label payloads are rejected. No database migration is required. See [emotes.md](emotes.md) for rate, recovery and acceptance limits.

The Vite build generates `.generated/content.json` for the dynamic sitemap. Include this build artifact with the deployed application; do not copy only `build/` while omitting the server and generated manifest. A local production smoke server also needs `ORIGIN=http://localhost:<port>` so SvelteKit uses HTTP for its internal fetches. Railway uses the public HTTPS origin.

See [bot-workers.md](bot-workers.md) for `BOT_WORKERS`, bounded search/queue behavior and overload handling. Start with the default single worker on a small host.

Daily puzzles need their migrations plus a verified publishing buffer; see [puzzles.md](puzzles.md). The generator and importer are separate CLI processes and do not run automatically in the web service. The checked-in launch artifact is not yet in production. [Puzzle operations](puzzle-operations.md) supplies the read-only status command, maintenance entry point and proposed separate Railway service settings. Configuring/enabling that service and monitoring remain production launch steps.

Share images require the installed `@resvg/resvg-js` native optional dependency and the Poppins font files. Do not deploy with optional dependencies omitted. The lockfile contains Linux GNU and musl builds; confirm the installed target in Railway's build log. See [share-previews.md](share-previews.md) for cache/privacy behavior and the bounded image worker.

## Client identity behind Railway

Before launch, confirm the application port is exposed only through Railway's HTTP edge, then set `CLIENT_IP_SOURCE=railway`. The shared address resolver uses Railway's overwritten `X-Real-IP` header for per-client limits. Local/direct hosting keeps the default `socket`; it ignores all proxy headers. Do not enable Railway mode on an origin also reachable through a TCP proxy or other untrusted ingress. See [client-address.md](client-address.md) for the provider contract, bounded limiter and rollout checks. No production configuration was changed by the implementation pass.

## Wallet command rollout

Privacy changes now require the caller's `expectedProfileVersion` and reject stale writes with 409. Ship server/client together and reload old tabs. No new migration is needed beyond the existing profile revision trigger; no automatic privacy replay or setting receipt table is introduced. The browser refreshes current state after uncertain confirmation and exposes failed-read recovery. See [profile-state.md](profile-state.md#privacy-writes) for concurrency behavior and acceptance checks.

Equipped skins now use authenticated `/api/shop/appearance` reads, and the equipment command accepts explicit standard-piece selection. No migration/dependency is added; deploy server/client together and reload old tabs for the new reset intent/receipt. This does not change theme policy, prices or ownership. See [piece-appearance.md](piece-appearance.md) for rendering scope, read costs and manual acceptance.

Friendship mutations require `20260911120000_friendship_operations` before the new server. Review self-pairs and opposite-direction legacy duplicates before applying: cleanup retains BLOCKED over ACCEPTED over PENDING, then the oldest row, and deletes the other rows. The migration adds unordered uniqueness, a self-pair check and durable operation receipts. Deploy server/client together and reload old tabs: one `/api/friends` snapshot replaces `/api/friends/pending`, mutations require UUIDs, and DELETE returns a JSON receipt. Preserve receipts for delayed confirmation. Visible Friends views refresh from the existing presence heartbeat; include their read cost in capacity validation. See [friends-state.md](friends-state.md) for cleanup policy, recovery boundaries and manual checks. Only the isolated test database has been migrated during this pass.

Equipment selections now require UUID request IDs and matching item receipts through the existing WalletOperation table. Deploy server/client together and reload old tabs; no additional migration is needed. Preserve existing receipts and saved wallet intents. See [shop-state.md](shop-state.md) for the read/retry contract and still-open cosmetic rendering/theme-policy work.

Treasury server/client changes ship together: the authenticated `/api/treasury` overview now includes that account's pending rewards and availability; the separate `/api/treasury/my-pending` route was removed. Reload old browser tabs. There is no new migration for this change. See [treasury-state.md](treasury-state.md) for the snapshot, reservation-accounting and claim-recovery contract.

Profile reconciliation requires `20260911100000_profile_versions` before the new application. It adds a per-account revision and a transactional update trigger covering all User writers. Existing rows start at zero. Reload clients after rollout; the new client rejects unversioned profiles from an older server. `/auth/me` now contains User fields only; inventory is served by the existing shop endpoint. A five-second revision scan uses the shared Prisma pool, reading connected accounts in sequential batches of 500 and repeating small socket hints to recover missed updates. No extra listener connection or migration is required for those hints. Include these queries/events in production capacity measurements. See [profile-state.md](profile-state.md) for ordering, refresh and acceptance limits. No production migration was applied during this pass.

Administrative commands also require `20260911093000_admin_operations`, which adds audit receipts and the `ADMIN_ADJUSTMENT` ledger reason. Apply it before the new server, and reload old admin clients to supply request IDs. Historical adjustments are not backfilled; retained audit references restrict hard account deletion. See [admin-actions.md](admin-actions.md) for retry, permission and rating-reset policy. This migration has only been applied to the isolated test database during implementation.

Apply the `20260910230000_wallet_operations` migration before starting the new server. Purchase/tip requests now require a durable UUID request identity; an already open old client receives a validation response directing it to reload rather than executing an unsafe transfer. Shop and Friends share same-tab persisted confirmation and bounded requests. Saved receipts must be retained while retries are possible. See [wallet-actions.md](wallet-actions.md) for accounting compatibility, recovery limits and acceptance checks. This implementation pass did not deploy or migrate production.

## Completed-game settlement recovery

Apply the settlement-job and participant-reference migrations before the new server starts. Startup begins a bounded recovery worker immediately; due terminal jobs are retried every ten seconds with per-job backoff. Monitor server recovery errors and the `GameSettlementJob` pending/attempt fields during rollout. Participant references protect pending jobs from account deletion; current guest retirement also preserves these accounts and their entitlements, as described in [account-lifecycle.md](account-lifecycle.md). See [settlement-recovery.md](settlement-recovery.md) for the tested commit boundaries. The single-replica requirement remains.

## Creation and wager rollout

The `20260911010000_game_creation_reservation` migration records new game creation and both stake debits together. Game IDs come from that durable record. Existing legacy wager games have no automatically synthesized reservation; drain those games and review unresolved wagers before eventual production rollout. Do not interpret an open run's `initialState` as its current board or auto-refund all open runs after a restart. See [game-creation.md](game-creation.md) and the versioned cancellation rules in [game-restoration.md](game-restoration.md).

## Gameplay checkpoint rollout

Apply `20260911020000_game_checkpoints` before the new server. Accepted gameplay commits a checkpoint/revision and command identity before snapshots acknowledge it; terminal jobs commit in that same transaction. Do not backfill legacy null checkpoints from the initial board. Wider lifecycle persistence remains unfinished, and timed-game checkpoint throughput needs validation at target concurrency. See [game-checkpoints.md](game-checkpoints.md).

## Gameplay ownership during replacement

SIGTERM/SIGINT and detected ownership loss close gameplay admission and drain pending room setup/game starts before disconnecting Prisma, including same-owner cancellation of uninstalled reservations. The host can still terminate the process before graceful draining finishes. See [gameplay-shutdown.md](gameplay-shutdown.md); this does not replace the startup recovery or single-replica restrictions below.

Apply `20260911030000_gameplay_ownership` before the new server. Startup claims a writer generation after preparing its handlers. New creation/cancellation/checkpoint transactions require that generation under a transaction-held lock; replacement waits for old writes and then fences them. The old process detects takeover, stops gameplay work and closes transports. Keep one configured replica; two independently starting replicas would keep superseding each other. See [gameplay-ownership.md](gameplay-ownership.md). Real rolling-deployment continuity remains an external acceptance gate.

## Restored-game readiness

Apply `20260911040000_game_recovery_version` and inspect/drain ambiguous legacy open records before rollout. New startup refuses to listen when it cannot safely restore a saved game. Checkpoints load only after ownership is acquired. Players receive the restored board and a **Resume game** control; unattended recovery cancels the game without rating/reward effects and refunds wagers. See [game-restoration.md](game-restoration.md) for exact rules. An already open older browser may need to reload to receive the new recovery control; compatibility is not inferred from a working socket connection. This pass changed no production settings.

## Active-game membership

Apply `20260911050000_active_game_players` with the new server. Bootstrap reconstructs claims from validated unfinished games after acquiring ownership and before listening; do not run new gameplay services without this bootstrap step on an upgraded database. New creation, terminal transition and cancellation maintain membership in their owning transaction. See [game-membership.md](game-membership.md). This constraint does not make multiple configured replicas safe or persist waiting-room/session lifecycle.

## Guest retirement and account upgrade rollout

Apply `20260911060000_guest_account_lifecycle` before the new server. It adds the retirement marker/index and starter-grant ledger reason, and marks only the old exact expired-guest tombstones with a null expiry. Review that data change before deployment; historical starter grants are not backfilled. Retired rows retain references, and guests with current sessions or entitlements stay protected. Do not replace retirement with a bulk user deletion. Older guest tokens can reconcile a completed upgrade through `/api/auth/me` without another grant. See [account-lifecycle.md](account-lifecycle.md) for the tested boundaries and manual upgrade check.

Production release and community-launch evidence belongs in [growth/launch-readiness.md](growth/launch-readiness.md). The local test/build record does not establish that any of these migrations or settings have reached Railway.

## Durable room runtime and startup restoration

Apply `20260911070000_durable_rooms` before the new binary. It adds versioned room records, exclusive human room roles, command receipts and the nullable source-room relation on game runs. Live commands use those records; bootstrap restores games first, then rooms and spectator roles, before listening. Unknown versions or unresolved associations fail startup. Offline deadlines survive repeated restarts, and reconnect waits for membership reconciliation before its initial snapshot. See [durable-rooms.md](durable-rooms.md).

The migration has been applied only to the isolated test database. Old waiting rooms created by the previous in-memory implementation have no record to restore: drain them before replacement or explicitly communicate that their invitations expire during this rollout. Local separate-process and result/rematch integration tests pass; production replacement and target-capacity acceptance remain pending. Do not increase replicas or treat this as general multi-writer support.

## Durable notices

Apply `20260911080000_session_notices` before the new binary. Room-removal notices commit with their owning transitions; recorded game-expiry notices and exact-event dismissal survive restart. Reconnect loads the latest notice before its first snapshot. The migration creates an empty event table and does not backfill old session memory. It has been applied only to the isolated test database; the Prisma client was regenerated. The result lifecycle below restores finished-result views and their original expiry timers. See [session-notices.md](session-notices.md).

## Durable results and rematches

Apply `20260911090000_result_records` before the integrated binary. It adds result state, viewer claims, command receipts and `GameRun.resultSourceId`. Terminal commits now initialize result membership and close the source room atomically. Result commands, navigation release, reconnect and startup all consume that accepted state. Bootstrap restores games, then rooms, then results before listening, and applies already due result expiries before recreating viewers.

The migration was applied only to the isolated test database and the Prisma client was regenerated. No historical result membership or consent is backfilled. Drain or explicitly expire result screens from the previous in-memory implementation before replacement; applying this migration cannot recover them. Keep one configured gameplay owner/replica. Local fault and fresh-process tests do not replace the owner browser, Railway replacement and capacity checks in [result-lifecycle.md](result-lifecycle.md) and [growth/launch-readiness.md](growth/launch-readiness.md).
