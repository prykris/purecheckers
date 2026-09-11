# Emote entitlement and recovery

Implemented locally on 11 September 2026. Local service, controller and socket verification does not establish browser or production acceptance.

## Catalogue authority

`server/services/emotes.js` defines one eligibility query: an item must be an EMOTE and either free or owned by the authenticated account. Both the non-cacheable `GET /api/shop/emotes` list and each send use that query. Reads expose only ID, name, emoji and label. Malformed catalogue content is omitted/rejected; another account's paid emotes, skins and themes cannot become selectable emotes. A later request rechecks current ownership/price instead of trusting an earlier browser list.

Players send `{ gameId, itemId }`, never publishable emoji/label data. The server resolves and broadcasts canonical catalogue content. Extra client presentation fields are ignored; legacy payloads without an item ID are rejected. Bot reactions remain server-authored content selected by the existing bot service, separate from player inventory.

## Game and transport boundaries

`server/domain/gameEmotes.js` owns live-game availability and throttling. A send requires the current player connection in the same active, started game, with no terminal state or restart-readiness pause. It checks those conditions before and after the database lookup. Departure, connection replacement, a replaced/stopped runtime, recovery, terminal state or a lost captured gameplay lifetime suppresses late publication. Database work participates in the existing gameplay work admission/drain mechanism; it does not mutate gameplay checkpoints.

Only one entitlement lookup per player/game can be pending, and valid attempts are admitted at most once every two seconds. Rejected entitlement and failed lookup attempts also consume that interval. Runtime-scoped state survives a socket replacement within that game and is released with the game object; it is not persisted. These bounds prevent rapid sends from bypassing the lookup limit by requesting unavailable items.

The socket handler awaits the action and acknowledges success or a specific rejection. Asynchronous failures are caught and become a recoverable error. An acknowledgement means the server dispatched the reaction; it does not prove every recipient rendered it. There is no durable emote queue, gameplay command receipt or automatic send retry. A lost acknowledgement is uncertain, and a user may explicitly send again after the cooldown.

Human and bot broadcasts carry the game ID. The browser rejects another game's event, does not display new bubbles while disconnected or terminal, and clears an existing bubble on those transitions. Emotes remain temporary presentation; they never advance authoritative game state.

## Browser reads and feedback

`src/lib/emoteClient.js` uses the shared `ReadResource` for cancellation, deadlines, retained successful data, stale-read rejection and disposal. GameScreen binds reads and sends to the account generation, game and connection ID. It refreshes on initial mount, account-generation change, reconnect and focus; it clears the projection on disconnect. Failed/malformed reads expose Refresh emotes instead of silently hiding the controls.

Sending is disabled outside a ready, started game and while an acknowledgement is pending. The browser sends only a selected ID and waits up to five seconds for an acknowledgement. Rate limits, revoked availability and lookup failures have visible feedback; revoked availability triggers a fresh list. Timeouts do not replay a reaction during read recovery or reconnect. Replies from an old account/game/connection cannot publish feedback or start follow-up reads in the new context.

There is one reachable emote toolbar. Buttons have names, wrap with the action row and use 44-pixel targets. Loading/error feedback stays with the controls, including in the desktop grid. Existing reduced-motion behavior is preserved. No browser/device acceptance was performed for this change.

## Rollout and verification

Deploy server/client together and reload old tabs: the send payload, acknowledgement and broadcast context changed. There is no new migration/dependency, price change, coin movement or production write. Old raw-content sends cannot fall back to permissive publication. This work does not complete equipped skin/theme rendering or Friends recovery; see [shop-state.md](shop-state.md) and the [implementation checkpoint](growth/implementation-status.md).

Tests cover free/owned/unowned items, cross-account reads, malformed catalogue/payload data, current ownership/price, canonical broadcasts, attempt throttling, one in-flight lookup, asynchronous failure/retry, departure/replacement/terminal/recovery/owner changes during lookup, stale browser completions, uncertain acknowledgements and read recovery. Actual Socket.IO tests prove the production adapter catches asynchronous errors and sends canonical content to the opponent. Test/build logs and exact counts are in the implementation checkpoint.

Manual acceptance:

1. Start a game and send a free emote. Both players should see the server's reaction. Rapid repeats should receive a short wait message without interfering with moves. An owned paid emote should appear; an unowned one should not.
2. Block the emote-list request, then restore connectivity and select Refresh emotes. Moves must remain usable throughout. Reconnect after a send: the list should recover, and no reaction should be automatically replayed.
3. End or leave a game while a reaction is loading/sending, then start another game. No old bubble or error should appear in the new game. Check the controls on a narrow screen and with reduced motion enabled.
