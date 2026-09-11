# Purchases and tipping

Implemented locally on 10 September 2026. Nothing was committed, deployed or applied to the production database during this pass.

## Server contract

`server/services/walletActions.js` owns purchase, transfer and equipment rules. HTTP routes authenticate, delegate and translate domain errors; they no longer implement wallet mutations themselves.

Equipment also supports standard pieces with `{ itemId: null, itemType: 'SKIN', requestId }`. This clears only equipped skins and persists `{ equipped: false, itemId: null, itemType: 'SKIN' }` under the same command kind, account lock and receipt transaction. A delayed reset retry cannot erase a newer selection. Appearance is fetched from current inventory after confirmation, never installed from a historical receipt. See [piece-appearance.md](piece-appearance.md) for lifecycle and coordinated rollout.

Purchases, tips and equipment selections require a client-generated UUID v4 `requestId`. `WalletOperation` has a unique `(userId, key)` constraint and stores the command kind, normalized payload and immutable successful receipt. All affected account rows are locked in ascending ID order before checking receipts or balances. A retry by the same owner returns the original receipt before checking mutable price, ownership or friendship conditions. A reused identity with different parameters is rejected. Different accounts may use the same UUID independently.

- A purchase commits conditional wallet debit, inventory, vault contribution, burn allocation and receipt in one database transaction. Free items create no wallet or vault movement. A new command for an already owned item still returns `409`; a retry of the original successful command returns its receipt.
- A tip commits both wallet movements, their two ledger entries and the receipt together. Transfers require accepted friendship at the transaction's eligibility check and positive integer amounts. Ordered account locks cover opposing transfers, purchases and the settlement services that follow the same account-before-vault order.
- Equipment changes lock the account and commit unequip/equip with a durable receipt. Retrying an old selection cannot undo a newer one. See [shop-state.md](shop-state.md) for the contract and the separate, still-open cosmetic rendering work.

Failures roll back the entire transaction. No receipt is written for a rejected/rolled-back command. The same uncertain command may be retried; no timeout or transport failure establishes whether the transaction committed.

The migration `20260910230000_wallet_operations` adds the receipt table. Old clients without request identities receive a validation error directing them to reload; they cannot fall through to unsafe legacy payments. Deploy migrations before the new application code as usual. Request receipts are retained; deleting them while retries are possible would weaken the contract.

## Wallet ledger and burn accounting

New purchases produce one negative `PURCHASE` wallet entry. Burned coins are an allocation of that price and live on the operation receipt, not a second debit. Treasury totals combine this new allocation with existing historical `PURCHASE_BURN` metadata. Historical entries are preserved; when calculating historical wallet deltas, those legacy metadata rows must be excluded. This change does not establish that every older balance adjustment has a complete ledger.

## Browser recovery

Shop and Friends share `src/lib/wallet/journal.js`, the application adapter and `WalletRecovery.svelte`. The journal now specializes the shared `src/lib/actions/journal.js` mechanism also used by administration, with separate namespaces and unchanged wallet storage keys. Before a request is sent, its immutable intent and UUID are saved in account-scoped session storage. Only one wallet purchase/tip/equipment selection may remain outstanding in a tab. Double clicks and another purchase/tip/equipment selection are blocked until it is confirmed or explicitly rejected.

Network failures, malformed successful responses, HTTP 408/429 and server failures retain the same intent. The shared confirmation panel can retry it after navigation or reload. Each request has a 15-second deadline. Successful confirmation refreshes the current wallet while the journal remains busy; it never applies a historical receipt balance to current state. A failed balance refresh says the payment was confirmed instead of inviting another charge. Responses from a previous account generation cannot clear or update the active account's journal. Storage failure before sending prevents the payment; cleanup failure retains the safely retryable identity.

Session storage deliberately isolates browser tabs. Pending recovery survives navigation/reload in that tab; it is not an account-wide outbox and does not survive closing the tab in every browser. Separate tabs initiating new tips create distinct authorized commands. Corrupt/unreadable saved state pauses payments in that tab instead of replacing an unknown intent. Receipts remain in the database, but there is no user-facing receipt-history screen yet. Do not claim closed-tab recovery or automatic cross-device reconciliation.

## Verification and manual acceptance

The full suite passed **371 tests across 43 files**, and the production build passed (`.generated/tests-wallet-full.log`, `.generated/build-wallet.log`). After final missing-body validation and recovery-copy refinements, **46 tests across four files** passed (`.generated/tests-wallet-final.log`). The only build diagnostic was the existing adapter's unused internal import.

The 12 PostgreSQL wallet tests cover concurrent duplicate purchases/tips, same-key parameter conflicts, a receipt after price/friendship changes, insufficient funds under concurrent spending, opposing transfers, complete rollback/retry, zero-price allocation, malformed/legacy API requests, equipment serialization and old/new treasury burn totals. Thirteen journal tests cover persist-before-send, duplicate input, uncertain response/reload, definitive rejection, account switching, storage failures, malformed receipts and balance-refresh failure/ordering. These local tests do not replace production or visual acceptance.

Owner checks:

1. Purchase an item: one debit, ownership shown, current balance updated. Equip two different themes in succession; only the last should be active.
2. Send one small tip and double-click while it confirms: one transfer. Verify both balances.
3. In a test environment, interrupt a payment response, then restore connectivity and reload the same tab. Use **Confirm payment**; it must confirm the same transaction with no extra charge. Navigate between Shop and Friends while pending; the same pending action should remain visible.

## Remaining scope

The original wallet checkpoint left gameplay persistence and account cleanup open; subsequent work is recorded in [implementation-status.md](growth/implementation-status.md). Administrative adjustments now use the same transaction/ledger and journal foundations; see [admin-actions.md](admin-actions.md). Broader wallet/profile publication ordering and production acceptance still require revalidation. These changes do not close the entire player-experience audit or roadmap.

The later [profile-state checkpoint](profile-state.md) replaces independent User writers with a versioned account owner, including treasury claim refresh and repeated revision hints for remote changes. [Treasury state](treasury-state.md) now defines its coherent overview, server-provided claim availability and browser read/claim lifecycle. Inventory/friendship resource ordering and full browser/production acceptance remain open.
