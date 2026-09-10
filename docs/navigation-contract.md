# Navigation ownership

The server owns membership and gameplay. The browser owns which permitted local view is open. It does not send shop/profile navigation to the game server or infer membership from a URL.

`navigationPolicy.js` projects accepted session state and local intent into both a screen and its canonical URL. `navigationController.js` owns intent, invitation commands and cancellable replay loading. `browserNavigation.js` is the sole history adapter and uses SvelteKit's `pushState` and `replaceState` imports from `$app/navigation`. Components submit navigation intents; they cannot write independent screen or tab stores.

## Rules

- Active games always project to `/game?game=…`; spectators additionally carry `watch=…`. Stale URL IDs cannot alter membership.
- A waiting room or search can be minimized into a browse tab. Its URL retains `room=…` or `search=1`. Reload restores the view after the server confirms current membership.
- Server context changes replace the current location. Explicit local navigation pushes a history entry. Snapshot ticks create no history entries.
- Back/Forward is a new local view intent, subject to current server membership. It never resigns, leaves or joins implicitly.
- Deep links survive authentication and initial synchronization. Logout discards old session/replay context.
- `/join/CODE` is an explicit join intent. It waits for authenticated synchronization, attempts once, and reports rejection. An occupied session cannot be overwritten by an invite.
- Replay requests belong to a navigation generation. Responses after browsing, game entry, identity change or disposal are discarded. Loading and errors are visible.
- Departure UI remains tied to acknowledged membership. Pending or rejected leave commands cannot silently hide a room.

SvelteKit shallow navigation does not guarantee that `$page.url` equals the address bar. The browser adapter reads `window.location.href` on initial navigation, router navigation and Back/Forward while preserving SvelteKit's history metadata.

## Verification

23 controller/policy cases cover deep links, stale URLs, browser-history intents, minimized membership, phase changes, invitation failures, stale replay responses and identity changes. Manual acceptance should include reload, Back/Forward, minimize/reopen, real room departure and reconnect during a game. These checks do not claim that the separate findings in player-experience-audit.md are resolved.
