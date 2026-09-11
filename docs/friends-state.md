# Friendship state and recovery

Implemented locally on 11 September 2026. Browser acceptance and production rollout remain separate from the automated checks.

## Authority and transitions

The database owns relationships. `server/services/friendships.js` supplies the authenticated `GET /api/friends` snapshot and all relationship mutations. A single Repeatable Read query returns accepted friends, incoming pending requests and outgoing pending requests. Retired accounts and blocked relationships are excluded. Participant projections contain only ID, username, rating and friend code; responses are `no-store`.

An unordered pair can have at most one relationship. Requesting creates PENDING; only its recipient can accept it into ACCEPTED. Either participant may remove a pending or accepted relationship, covering decline, cancellation and removal. Reciprocal requests never imply acceptance. Existing BLOCKED rows cannot be changed through these actions. Requests to bots, retired accounts or oneself are rejected. This pass does not introduce a blocking workflow.

Mutations discover the pair, lock both accounts in the shared economy lock order, and re-read mutable eligibility inside the transaction. This is the same order used by tips and account retirement. The unordered unique index and self-pair constraint also protect against duplicate/invalid inserts outside the service.

Friend presence comes from the existing authoritative session's `connectionId` and phase: disconnected is offline; connected in-game is in-game; other connected phases are online. There is no new presence map. These runtime fields are a current hint, not part of the database transaction or proof that the browser is visible.

## Commands and receipts

POST `/api/friends/request` takes `{ friendCode, requestId }`; POST `/api/friends/accept` takes `{ friendshipId, requestId }`; DELETE `/api/friends/:id` takes `{ requestId }` in its JSON body. IDs are strictly validated and request IDs are UUID v4. Friend codes normalize to uppercase. Optional display names are browser recovery descriptions only; they never identify a target or affect canonical receipt matching.

`FriendshipOperation` stores the authenticated actor, request ID, kind, canonical payload and immutable receipt in the same transaction as the effect. Exact retries return the original receipt before checking mutable relationship eligibility; conflicting request-ID reuse is rejected. Thus an old request or acceptance cannot revive a removed friendship, and an old removal cannot delete a newer relationship. The response is historical confirmation, never a current friends snapshot. Removing a relationship retains its receipts. Account retirement preserves records; hard deletion of an account cascades its operation records. Do not prune receipts while supported clients can retry them.

Request responses use 201; accept/remove use 200 with the receipt. Network failures and 5xx responses leave confirmation uncertain. Validation, permission and conflict responses explicitly reject the command. The browser does not automatically retry mutations.

## Browser lifecycle

`FriendsClient` uses the shared `ReadResource` for 15-second read deadlines, cancellation, latest-read ordering, account generation and disposal. A malformed/failed initial read is an error, not an empty list. Failed refreshes retain the last successful view and disable actions until a successful refresh. Successful mutations trigger a fresh snapshot; no optimistic row deletion/insertion or historical balance assignment occurs. Successful confirmation followed by a failed read has separate feedback.

`FriendshipJournal` specializes the existing `ActionJournal` with friendship intent/receipt validation. It persists one pending action per account/tab before sending, retains uncertain results across same-tab reload, blocks new relationship actions until resolved and requires explicit confirmation using the same ID. Its 15-second transport deadline does not prove the server failed to commit. Storage failure prevents an unsafe untracked send. Replies from a replaced authentication generation cannot clear the current intent, including sign-out/sign-in to the same account. Tips continue to use the existing wallet journal and recovery panel.

The mounted view refreshes on account change, reconnect, focus and the existing `presence:stats` heartbeat, skipping overlapping reads/actions and hidden-document heartbeat reads. The heartbeat normally arrives every ten seconds and recovers missed relationship/presence changes without another timer or notification queue. This is eventual freshness while connected; an offline view can require explicit Refresh after connectivity returns. Manual Refresh is available. Subscriptions and outstanding reads are removed when the view is disposed. Production capacity measurements must include these visible-view reads; no new capacity claim is made here.

## Migration and coordinated rollout

Apply `20260911120000_friendship_operations` before the new server, then deploy server/client together and reload old tabs. The previous `/api/friends/pending` endpoint is removed; one root snapshot replaces the two browser reads. Old mutations without request IDs are rejected, and DELETE now returns JSON instead of 204. The migration has been applied only to the isolated test database during implementation.

Review legacy relationships before production migration: it deletes invalid self-pairs and collapses opposite-direction duplicates, retaining BLOCKED ahead of ACCEPTED ahead of PENDING, then the oldest row of the retained status (ID breaks timestamp ties). It never promotes a pending request or overrides a block. These discarded duplicate rows are not recoverable from a down migration; retain the normal production backup and review the affected pairs before rollout. The migration adds unordered uniqueness, the distinct-user check and the receipt table. No price, ownership, reward or dependency change is included.

## Verification and manual acceptance

PostgreSQL tests exercise reciprocal contention, raw constraint enforcement, replay after removal/recreation, canonical payload conflicts, actor permissions, retired/bot/blocked targets, atomic rollback, private snapshot partitions, session presence and strict HTTP targets. A transaction-scoped temporary-table fixture runs the actual migration against duplicate data and verifies both constraints. Controller/journal tests cover lost responses, reload, wrong receipts, storage failure, duplicate actions, account replacement, disposal and follow-up read failure. Exact full-suite/build results are recorded in [implementation-status.md](growth/implementation-status.md).

1. In two accounts, request and accept a friendship. Check incoming/outgoing lists, cancel or decline another request, then remove and re-add. Each other account should catch up within the normal heartbeat interval or immediately on Refresh.
2. Keep Friends open while the other player starts a game, disconnects and reconnects. Check online/in-game/offline recovery. Send a tip and confirm the authoritative balance updates.
3. Interrupt a friendship request's response and reload the same tab. Confirm the saved action; it must not create duplicates. Restore a failed list request and use Refresh. Switching accounts or leaving the screen while loading must not show the old account's result.
