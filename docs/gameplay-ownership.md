# Gameplay writer ownership

Implemented locally on 10 September 2026. No production migration, deployment or configuration change was performed. This fences competing writers; subsequent [game restoration](game-restoration.md) loads unfinished checkpoints and reconstructs their human game sessions after ownership is acquired.

## Ownership contract

`GameplayOwner` is one PostgreSQL row containing the current process identity and monotonically increasing generation. Startup explicitly claims a new generation after preparing the HTTP application and before opening it for traffic. The claim supersedes the previous writer; there is no timeout-based lease or automatic reacquisition by a fenced process. Keep one configured application replica. This is not a horizontal-scaling mechanism.

Every game creation, failed-start cancellation and gameplay checkpoint transaction obtains a shared lock on that row, verifies its captured generation/instance, and holds the lock through commit or rollback. Takeover updates the same row, which waits for existing shared locks. Once takeover commits, old generations cannot commit a later gameplay write. Lock order is ownership row, game identity, then any account/vault locks required by the operation.

The ownership token is captured at operation/aggregate creation. GameRoom retains its original token; reading a newer checkpoint cannot give it permission to write as the replacement. Uncertain-response reconciliation reads are fenced too. Ownership loss stops that path rather than refreshing into another owner's state and continuing. A token is an internal coordination identity, not an authentication credential exposed through the client API.

Immutable terminal settlement jobs remain executable across ownership changes. They only finish an already accepted terminal outcome and use their existing transaction lock/receipt for idempotency. This preserves financial recovery while live-game mutation ownership changes.

## Runtime shutdown

The shared runtime lifetime now closes admission and drains pending room setup, game creation, domain commands and optional analysis as well as installed aggregates. Captured continuations cannot install state after shutdown or adopt a newly acquired owner. See [gameplay-shutdown.md](gameplay-shutdown.md) for cancellation/refund behavior, tests and the boundary between process-local lifetime checks and database fencing.

A one-second, non-overlapping watcher detects takeover even when the server has no timed games or pending writes. Each actual write still verifies ownership transactionally; correctness does not depend on the watch interval. An unavailable database cannot authorize a write. The watcher does not interpret a read error as permission to acquire another generation.

On detected ownership loss, the application stops matchmaking, game timers and bot/analysis work, stops guest/recovery polling, closes Socket.IO/HTTP transports, clears session timers and drains known game/recovery work before disconnecting Prisma. SIGTERM/SIGINT use the same shutdown path. Socket.IO's transport closure allows the client's existing reconnect behavior to run; routing it to a ready replacement and restoring its state still require deployment/lifecycle acceptance.

Startup claims ownership only after the application handlers are prepared, then restores unfinished checkpointed games before listening. Wider lifecycle restoration and real rolling-deployment acceptance remain unfinished. A process that takes ownership and then fails cannot rely on the fenced old process to resume automatically; deployment restart policy must start a new owner. Do not describe writer fencing as zero-downtime failover.

## Migration and operational boundaries

`20260911030000_gameplay_ownership` creates the constrained singleton table. Do not clear/reseed its live ownership record as a routine maintenance operation. Bootstrap must acquire ownership before invoking gameplay services; those services have no unfenced fallback. Test workers explicitly acquire or receive an ownership token for the isolated test database; production does not read test ownership from environment variables.

Room membership and disconnect deadlines now persist and restore through the [durable room boundary](durable-rooms.md). [Recorded notices/dismissal](session-notices.md) now use the same ownership fence. Rematch requests and finished-result view membership remain unfinished. Old transports close on detected takeover; real Railway replacement acceptance is still required. Keep the single-replica deployment requirement until the wider architecture changes.

## Verification

The full suite passed **413 tests across 47 files**, and the production build passed (`.generated/tests-fencing-full.log`, `.generated/build-fencing.log`). After adding the actual bootstrap/shutdown scenario, all **six ownership tests** passed (`.generated/tests-fencing-bootstrap.log`).

The PostgreSQL tests cover a separate process claiming ownership; rejection of old creation, abort and checkpoint writes even after reading the new revision; takeover waiting for an old transaction; rollback releasing that lock; idle-watch notification; and terminal settlement after ownership change. The blocking test inspects PostgreSQL's actual lock wait rather than inferring it from elapsed time. The additional bootstrap test starts the actual server on an ephemeral test port, verifies an HTTP response, changes ownership and observes clean server exit.

Socket coverage verifies that a fenced GameRoom stops its timers, retains its original revision and cannot adopt/mutate the replacement writer's checkpoint. These are controlled local tests. A real Railway rollout with active players and restored gameplay remains an external acceptance gate after startup restoration is implemented.
