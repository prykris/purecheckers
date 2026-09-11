# Shop reads and equipment recovery

11 September decision follow-up: paid themes are retained. Profile and Shop now share basic/owned-theme selection, THEME reset uses the existing equipment journal/receipt, and `/api/shop/appearance` projects theme and skin together. The browser-only theme store is removed. This supersedes the historical theme gaps below. See [owner decisions](growth/owner-decisions.md).

Implemented locally on 11 September 2026. This checkpoint covers catalogue/ownership reads and purchase/equipment confirmation. The subsequent [piece appearance pass](piece-appearance.md) applies equipped skins and adds standard-piece selection. Theme policy and the full shop audit remain open.

## Read projection

The authenticated `GET /api/shop` overview reads catalogue and personal inventory in one PostgreSQL Repeatable Read transaction through `server/services/shop.js`. A catalogue/ownership change committed between queries cannot produce a mixed response. Responses are non-cacheable; another account's inventory is never included. The public item list and existing personal inventory endpoint remain distinct resources used outside the shop screen; the shop itself consumes only the combined overview.

`src/lib/shopClient.js` coordinates the view using the same `ReadResource` as Treasury. Reads have deadlines, cancellation, latest-request ordering, account-generation checks and disposal. Malformed or failed initial reads produce error/retry feedback rather than an empty catalogue. A failed later refresh preserves the last accepted view. Refresh, return to focus and account replacement reload the current view; this is not a live inventory notification stream.

Purchase and equipment buttons stay unavailable while the view is loading/failed, an action is confirming or the shared journal has an outstanding/blocked intent. A confirmed action starts a fresh inventory read. A failed confirmation read says the action succeeded and offers Refresh. The view never applies an old receipt as current inventory or increments/decrements its own balance. After navigation/account replacement, old callbacks cannot publish or start follow-up reads.

## Durable equipment selection

Equipment now uses the existing wallet action service, `WalletOperation` receipt table and shared browser action journal. `PATCH /api/shop/equip` requires `{ itemId, requestId }`, with the same UUID v4 contract as purchases/tips. The selected owned item must be a theme or skin. Emotes do not have an equipment slot.

The account lock, unequip/equip writes and immutable `{ equipped: true, itemId }` receipt commit together. Replaying an old selection returns its receipt before checking current inventory and cannot undo a newer selection. Conflicting reuse of a request ID is rejected. Equipment neither debits coins nor writes a coin transfer; its receipt has zero burn allocation. Concurrent new selections still serialize under the existing account lock.

The tab persists an uncertain selection before sending. A second selection/purchase/tip cannot start until it is confirmed or definitively rejected. Retry after reload uses exactly the same ID. A malformed/wrong-item receipt stays uncertain. **Confirm selection** uses the same recovery panel as payments with appropriate copy, including when the user navigates to Friends. No second outbox, optimistic equipment writer or automatic mutation retry was added.

The shared action journal now also observes authentication generation, including a new login with the same account ID. Wallet and admin adapters supply this boundary; token renewal/guest upgrade that preserve the generation do not reset pending work. Late responses cannot clear a newer session's journal. Existing saved intents and storage namespaces remain unchanged. Recovery-panel callbacks also respect component disposal/account replacement.

## Known remaining gaps

- Equipped skins now reach live, spectator and app replay rendering through the shared appearance read and palette. [piece-appearance.md](piece-appearance.md) records recovery, standard-piece selection and manual acceptance. Theme application remains open.
- `stores/theme.js` and Profile offer free palettes that overlap paid shop themes. Equipped themes do not currently apply through that picker. The owner has been asked whether to retain paid themes with only basic/owned profile choices, or make all themes free. No prices, ownership or refunds were changed while this decision is pending.
- The subsequent [emote checkpoint](emotes.md) replaces independent game inventory reads and client-authored content with a shared entitlement query, canonical broadcasts, acknowledged transient sends and scoped read recovery. Browser/device acceptance remains pending.
- [Friends state](friends-state.md) now covers its shared read/action lifecycle, durable relationship receipts and current session presence. Browser/manual acceptance and production capacity are still open.

## Rollout and acceptance

No new migration or dependency is needed beyond the existing wallet-operation migration. Server/client changes must ship together and old tabs must reload: old servers lack matching equipment receipts, and old clients omit the request ID or cannot recognize saved equipment intents. Do not delete receipts while retries are possible. No production write, commit or deployment was performed in this pass.

The [implementation checkpoint](growth/implementation-status.md) records test/build evidence. Tests cover coherent reads across a concurrent commit, account isolation, equipment duplicate/conflicting/reversed retries, rollback, zero wallet effects, malformed receipts, reload, same-account authentication generations, blocked duplicate actions, failed confirmation reads and obsolete callbacks.

Manual checks:

1. Block Shop's read, open Shop and restore connectivity. It must show recoverable failure, and Refresh must load current items. Switch accounts or navigate away during a delayed read; the old inventory must not reappear.
2. Interrupt an equipment response. Another selection must stay blocked until **Confirm selection** confirms the same intent. Confirm it after leaving/reopening Shop, then select a different item. Retrying the first request must not undo the second selection. Check the skin in live/spectator/app replay boards, and use standard pieces to clear only the skin slot.
3. Purchase once with a delayed response, then confirm the same payment after reload. Ownership and balance must come from fresh reads with one debit. An inventory-read failure after confirmation must not suggest another purchase.
