# Account lifecycle

Guest expiry, renewal and registration share the account row lock. HTTP and socket authentication use the signed account ID to load current database identity; token names and guest flags are not authoritative. Account lookup outages are retryable failures, not evidence that credentials are invalid.

## Retirement

Cleanup retires expired guests instead of deleting their rows. It preserves game, puzzle, wallet and ledger references, marks `guestRetiredAt`, hides the profile and replaces the public identity with an expired-guest marker. Authentication, upgrade and game creation reject retired accounts; tipping cannot deposit into a retired account.

An expired guest remains protected while connected or attached to a session, holding coins or inventory, participating in an open game, awaiting settlement, or owning an unclaimed payout. The current gameplay owner performs retirement under its captured ownership generation and account lock. An old process cannot interpret its stale local presence and retire accounts after takeover.

The worker processes at most 100 accounts per minute using a keyset cursor. Protected or individually failed accounts do not starve later IDs. Overlapping ticks coalesce; shutdown stops scheduling and drains current work before disconnecting the database.

## Registration and renewal

Registration and guest upgrade commit the account change, starter coins and a `STARTER_GRANT` ledger entry in one transaction. Concurrent upgrade requests and old guest tokens cannot repeat the grant. A repeated completed upgrade returns an already-registered error; `/api/auth/me` exposes the current account identity for reconciliation. Upgrading while in a waiting room updates its registration flag before the next game selects its mode.

Renewal rereads the account under the same lock as upgrade and retirement. It cannot revive a retired guest or overwrite an upgrade with a new guest expiry.

The upgrade sheet uses `src/lib/accountUpgrade.js` for save and confirmation. It reads `/api/auth/me` before submitting credentials and after an uncertain/error response. A registered account with the same ID confirms the durable outcome; an unchanged guest after a network failure is still uncertain. The user can check status without resubmitting credentials, or retry saving through the same preflight. Concurrent client submissions coalesce. Each request has a 15-second timeout, captures its authentication token, and rejects late/cross-account results; destroying the sheet aborts pending requests. Credentials are never stored in a recovery journal or browser storage.

An aging guest token returned by preflight is adopted before the save. `/api/auth/me` also replaces obsolete guest/name claims after conversion, even if the token is not near expiry, and reapplies current identity to the live session through the existing identity service. This repairs a commit-before-publication interruption. Normal app bootstrap already calls the same endpoint, so reload recovers a committed conversion without repeating the starter grant. Confirmation establishes the current registered account; it does not claim that a later competing submission changed its credentials.

## Migration and verification

`20260911060000_guest_account_lifecycle` adds the retirement marker/index and starter-grant reason. It recognizes the prior exact expired-guest marker with a null expiry; it does not backfill historical starter ledger entries. The migration has been exercised on the isolated test database, not production.

The account changes passed the full suite: 468 tests across 50 files, plus the production build. A subsequent ownership-fencing refinement passed 39 tests across guest cleanup, ownership and restoration. Coverage includes retained references, protected accounts, stale JWTs, socket authentication, upgrade/renewal races, grant rollback, bounded cleanup, shutdown and owner replacement.

The subsequent browser-upgrade recovery pass passed 496 tests across 52 files and the production build. Its controller tests exercise lost responses, preflight recovery, failed confirmation, explicit rejection, token renewal, coalescing, stale identity, malformed responses, timeout and disposal. Auth tests verify replacement of an old guest token without a second grant and repair of an upgrade committed before live publication.

Manual acceptance: upgrade a guest while waiting in a room, then start the next game and verify the registered mode and one starter grant. Reload and confirm identity and balance remain correct.

## Limits

Retirement is not storage compaction: guests with entitlements remain retained. Wider account administration and durable waiting-room, spectator and finished-result session restoration remain unfinished. A network outage can leave an upgrade explicitly awaiting confirmation; status checks and safe retries require connectivity, and an expired credential requires authentication. Inconsistent legacy retired participants in an unfinished checkpoint stop restoration for review rather than being silently revived.
