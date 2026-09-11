# Durable active-game membership

The [durable room boundary](durable-rooms.md) adds exclusive room roles to live admission and startup restoration. A room-backed start transfers its human player claims to the game in the same transaction as stake reservation; cancellation restores them with refunds. Direct games reject any existing room claim.

The subsequent [result repository](result-lifecycle.md) adds exclusive result-viewer claims and an atomic rematch handoff/cancellation boundary. Shared game/room admission now recognizes those claims, but live terminal/result handlers do not create or restore them yet. This foundation is not a claim of completed result recovery.

`GameRun` and its committed checkpoint remain the source for game participation and lifecycle. `ActiveGamePlayer` enforces one unfinished game per human through a primary key on `userId`. It is a transactional constraint projection, not a separate session state machine. Registered and guest players both claim seats; bots can participate in multiple games without claiming one.

## Commit boundaries

Creation holds gameplay ownership, the game-key advisory lock and sorted account locks. It checks human availability, creates the game, reserves wagers and inserts both human claims in the same transaction. An occupied human produces `GameMembershipConflict`; a concurrent insertion also has the database primary key as a final constraint. No rejected start retains a stake debit or partial game.

An identical creation key returns its existing record before availability checks, so a lost response can be confirmed without charging or claiming again. Retrying a closed creation does not resurrect its membership.

A terminal checkpoint releases the game's claims in the same transaction as its checkpoint, command receipt and settlement job. Players can proceed while an accepted result's financial settlement is retrying. Settlement also releases claims for its own game, covering older/direct terminal paths. Every release is scoped by game ID: a delayed settlement or cancellation of an old game cannot remove the next game's claims for those players.

Cancelling an uninstalled start releases membership together with its refund and ABORTED status. Rollback preserves both stake reservation and membership. The runtime's local start guard still protects async session-context installation; the database projection handles cross-transaction membership uniqueness.

## Startup and uncertain starts

Migration `20260911050000_active_game_players` creates the table and constraints. It does not guess historical membership in SQL. After ownership acquisition, bootstrap validates the unfinished checkpoint set, cancels safe versioned uninstalled starts, and rebuilds missing claims before accepting connections. This includes writes from an older binary between schema migration and takeover. Terminal/nonparticipant claims are removed; conflicting live human rosters fail review rather than selecting a winner. A fenced owner cannot rebuild or clear claims.

Before another runtime start, the domain checks existing claims for its locally reserved humans. If an older attempted start has no installed runtime under this owner, it uses the existing failed-start cancellation service before reserving a new game. That repository still rejects cancellation of started play or terminal intent. This closes the retry path where a bot room was removed after its creation response was lost; the next attempt cancels the known uninstalled reservation and starts normally instead of producing a duplicate game or an occupied-seat dead end.

The [room-departure boundary](room-departure.md) confirms cancellation/refunds before leave, kick, expiry or failed bot-room cleanup releases membership. Temporary cancellation failure retains the room for retry. Room rosters, departure and [notices/dismissal](session-notices.md) are durable; finished-result membership remains incomplete. Do not equate an active-game claim with presence, a result-sheet view or browser navigation state.

## Verification

The full suite passed **438 tests across 49 files** (`.generated/tests-membership-full-final.log`), and the production build passed (`.generated/build-membership.log`). The only build warning was the existing adapter-generated unused import.

`tests/gameMembership.test.js` covers competing starts across colours/opponents, primary-key enforcement even when bypassing preflight, creator process exit/retry, concurrent bot games, guest claims, terminal rollback, delayed old settlement after a newer game starts, cancellation/refund rollback, stale/missing startup claims and owner fencing. Socket coverage loses a bot creation response after commit, then verifies the next browser command starts a game with one valid human claim and cancels the old run.

All database tests use the isolated test PostgreSQL database. No production migration, deployment or commit was performed. Full lifecycle, account cleanup and target-concurrency/real deployment acceptance remain outside this membership claim.
