# Equipped piece appearance

Implemented locally on 11 September 2026. This completes the equipped-skin rendering path for the app's live player, spectator and replay boards. It does not decide the free/paid theme policy or establish browser/device acceptance.

## One equipment authority

Inventory remains authoritative. `GET /api/shop/appearance` authenticates the account and reads only its equipped SKIN with the associated catalogue data in a Repeatable Read transaction. The response is `no-store` and contains `{ skin: null }` for standard pieces or one `{ itemId, name, palette }`. It never uses another player's equipment, a local preference or the item ID in an old command receipt to choose the current skin.

The selected palette applies to both sides in the viewer's app. It is a personal rendering preference, not an opponent-visible customization or a change to red/black identity. It does not enter game commands, snapshots, checkpoints, legality, turn order or recorded moves. Public marketing boards, puzzles, article diagrams and generated share images retain their standard presentation; they do not start authenticated equipment reads. A public replay uses standard pieces outside the app appearance lifecycle.

Ambiguous legacy equipment (more than one equipped skin) produces a recoverable error rather than selecting an arbitrary row. A new explicit selection or standard-piece reset clears the ambiguity under the existing account lock. Malformed equipped palette data also produces an error. These reads never repair or write inventory.

## Catalogue format and rendering

`shared/pieceSkins.js` validates and copies the existing seed format: red and black palettes each have a six-digit hex base/stroke and exactly three hex gradient stops, with optional boolean glow and a bounded white-alpha/hex highlight. Unknown fields are ignored; CSS variables, URLs, missing fields and unsupported values never reach the painter. The normalized palette is immutable. Standard pieces preserve the prior canvas palette.

`canvasPiece.js` is the common painter for stationary pieces, dragged pieces, moves, fading/shrinking captures and crowned pieces. It consumes the palette while retaining the existing geometry, animation inputs and crown shape. Glow and alpha/scale are confined to the saved canvas context; no extra animation loop or board-state writer was added. The board redraws when appearance changes without restarting its snapshot transition.

App replays use CSS gradients from the same normalized palette for both stationary and sliding pieces. Small labeled swatches identify the red and black sides because skins such as Neon intentionally change their visible colors. Existing keyboard square labels and game identity still use the canonical color names. Reduced-motion behavior is unchanged. Actual visibility/contrast and layout acceptance remain manual, particularly with light board themes and narrow screens.

## Browser read lifecycle

The app layout mounts one appearance owner and disposes it on departure. It uses the shared `ReadResource` for deadlines, cancellation, latest-request ordering, account-generation checks and disposal. Account replacement immediately clears the previous skin, including a new login with the same account ID. Ordinary profile updates do not trigger duplicate inventory reads.

Reads occur at account entry, session recovery (unless a read is already in flight), window focus, equipment confirmation and explicit Retry. This is not a continuous cross-tab inventory notification stream: an equipment or catalogue change made elsewhere appears on the next successful read. No new timer, socket event or profile revision system was introduced. Capacity verification must include the additional small authenticated reads.

Initial/read failure leaves gameplay usable with standard pieces or the last accepted appearance. Shop and board views expose the failure and Retry appearance. A successful response selecting no skin resets the renderer to standard pieces. Out-of-order, disposed and previous-account replies cannot install their palettes. Equipment confirmations read current appearance and then current profile; a changed account generation suppresses subsequent work. Historical selection receipts are never applied to the renderer.

## Standard-piece selection and rollout

The existing `PATCH /api/shop/equip` command now also accepts `{ itemId: null, itemType: 'SKIN', requestId }` to select standard pieces. No ownership is required for standard pieces, and no coins are debited. Null without the explicit SKIN slot, zero IDs and theme resets are rejected. This affects only the SKIN slot; the pending theme policy remains unchanged.

The existing wallet journal and `WalletOperation` table persist this command just like other equipment selections. Its matching receipt is `{ equipped: false, itemId: null, itemType: 'SKIN' }`. Reset, receipt and any surrounding transaction commit or roll back together. A duplicate reset returns the old receipt and cannot erase a subsequent new skin selection. Conflicting request-ID reuse is rejected. The same pending-action recovery blocks another purchase/tip/selection until the uncertain command is confirmed or definitively rejected.

Deploy server/client together and reload old tabs: older clients cannot interpret the standard-piece intent/receipt. No migration, dependency, catalogue price, ownership, theme, refund or reward change was made. Retain existing equipment receipts while clients can retry them. The [implementation checkpoint](growth/implementation-status.md) records exact local test/build results; production has not been changed.

## Manual acceptance

1. Equip Neon, Wood or Crystal in Shop, then play or spectate. Check both sides, dragging, captures and a crown; the skin must persist after reload. Open an app replay and step forward/backward. Verify the labeled red/black swatches and a narrow screen.
2. Select Use standard pieces, then another skin. Interrupt and confirm an equipment response after same-tab reload; it must keep the current server selection, never apply a historical receipt. Standard-piece selection must leave themes and coins unchanged.
3. Block the appearance read, restore connectivity and select Retry appearance. Gameplay must remain usable throughout. Switch accounts or leave the app during a delayed read; no prior account's skin may appear. Check reduced motion and a light board palette.
