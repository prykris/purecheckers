# Durable session notices and dismissal

Implemented locally, updated 11 September 2026. Recorded room-removal and finished-game expiry notices survive session reconstruction and process replacement. The integrated [result lifecycle](result-lifecycle.md) now restores result membership and its original expiry deadline too. No production migration or deployment was performed.

## One notice contract

`SessionNotice` records an immutable user/effect identity, ordered sequence, reason, context, occurrence time and nullable dismissal time. The unique user/effect key prevents retries from minting another event. Reusing that identity with different content is rejected. Dismissal is retained; retrying an event cannot revive it or move it ahead of newer events.

The UI retains its existing behavior: show the most recent notice until dismissed. This is not a notification queue. Reads select the newest event even when it was dismissed, so an older undismissed event never resurfaces. The user/descending-sequence index supports that read. Events are retained with the user's history; retirement does not delete accounts or their notices.

The service in `server/services/sessionNotices.js` handles storage and exact-event dismissal under gameplay ownership and account locks. `server/domain/notices.js` owns notice actions and reconnect restoration. `sessions.js` only projects accepted records. Its sequence/dismissal cursor rejects delayed older records and pre-dismissal reads, without adding another authoritative notice state.

## Owning transitions

Room departure policy derives notices from the accepted before/after roster. A kick or disconnected expiry notifies the removed human. Closing a room with no humans notifies remaining spectators; voluntary departure does not notify the leaver. Bots receive no room notices. Game completion closes a room while the result view remains open, so it does not emit the unrelated missing-human room notice.

The room repository commits notices, roster/host/closure, membership claims and command receipt in one transaction. Failure rolls everything back. A lost response confirms the existing command and reads accepted records before publishing session changes. Notice creation does not depend on a live socket or in-memory session.

Result expiry derives due viewers from the persisted result state. Viewer removal, claims and expiry notices commit in the same transaction before sessions become idle. Storage failures retain accepted views and retry; a voluntary dismissal committed first excludes that viewer from expiry. The result runtime restores future timers using their original deadlines, and startup expires overdue records before restoring sessions. It never infers viewers from historical replays. See [result-lifecycle.md](result-lifecycle.md).

## Reconnect and dismissal

Reconnect restores the latest notice after room and result reconciliation and before the first snapshot. A dismissed notice stays absent on another process. `notice:dismiss` can update only the authenticated user's exact event; a delayed dismissal cannot clear a newer notice or another account's notice. Lost dismissal responses retry the same idempotent operation. The gameplay lifetime/connection guard prevents stale or stopped work from publishing speculative dismissal.

## Verification and rollout

`tests/sessionNotices.test.js` checks room-transaction rollback, kick/closure policy, reconstructed sessions, duplicate events, stale and cross-account dismissal, delayed projection, lost responses, result-expiry storage failures, voluntary leave, shutdown draining and two fresh server processes around a real socket dismissal. The shared process helper also runs the waiting-room first-snapshot check. Full-suite/build evidence is recorded in [growth/implementation-status.md](growth/implementation-status.md).

Apply migration `20260911080000_session_notices` before the new binary. It creates an empty event table, indexes and a user relation; it does not backfill old in-memory notices. The migration was applied only to the isolated test database and the Prisma client was regenerated. Retain the single-owner deployment constraint.

Manual local/staging check: have a host remove a player, restart the server, and reconnect the removed player. The same explanation should appear. Dismiss it, restart again and confirm it stays gone. If a newer notice arrives, dismissing the old ID must not erase it. Automatic tests cover database faults; do not inject them in production.
