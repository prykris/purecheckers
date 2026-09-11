# Public site, account entry and game navigation

## Ownership

The root layout loads `SiteRuntime` only in the browser. It owns account restoration, invitation bootstrap, the socket lifecycle, appearance subscriptions and the guest upgrade sheet. Moving between public, account and app route groups does not tear down that runtime. A change of player identity does tear down the old connection. Registering a guest preserves the player ID and the connection.

The runtime also owns the unauthenticated app-entry redirect. It awaits the current bootstrap operation and verifies that its originating URL is still current before redirecting. This prevents app layout mounting from racing automatic guest creation for an invitation.

`AccountSession` remains the only identity owner. `SessionClient` remains the authoritative gameplay snapshot owner. Public UI reads these stores; it does not invent room or game membership. `gameEntry` uses the existing `projectNavigation` policy to choose the entry URL from a ready snapshot. Disconnected clients enter through the app shell to reconcile before showing gameplay.

The app layout owns only its navigation adapter and screen UI. It detaches that adapter while public/account pages are open, allowing users to read them without a snapshot redirecting them back to gameplay. Browsing away does not pause a game or its clock. The public entry link follows the latest phase and returns the player to their current activity.

## Account routes

`/auth` creates a guest, `/login` signs in, `/register` creates an account or upgrades the current guest, and `/forgot-password` explains the current recovery availability. These are real SvelteKit routes, so refresh and browser Back retain the selected form. They share `AuthScreen` and the existing authentication/upgrade request owners.

`returnTo` carries an internal destination, including invitation query parameters and fragments. `safeReturnTo` rejects external URLs and account-route loops. Home and Back are ordinary links. Login/register switches preserve the destination. Profile entry records its caller in SvelteKit page state so its Back action can return to the originating screen.

Password reset email is unavailable until an email delivery service and reset flow are configured. The recovery screen explains this and does not claim to send email.

## Shared UI and language

`SiteAccount` exposes identity and account entry on public pages. `PlayerHeader` persists across the app's browsing tabs. Both use `AccountMenu` for account, sound, public-site links and language selection. `GameEntryLink` supplies the same account-aware entry behavior for public calls to action.

English/Spanish preference carries into account forms and shared navigation. Public document language follows the actual page content: `/es` is Spanish; English guides remain English. Some game screens and guides still have English-only content, which the Spanish account UI states explicitly. This change does not claim full game translation.

## Search visibility

Marketing pages retain their prerendered content, headings, canonical URLs, hreflang links and structured data. Guest-facing account/play links exist in server HTML. Personal account/session controls enhance that HTML after hydration; they do not hide marketing content or automatically redirect signed-in visitors.

The app and account route groups are noindexed. Account pages opt out of prerendering because they read return destinations. No account tokens or personalized state enter prerendered output.

## Verification

- Mobile check: no horizontal/document overflow in the app; footer ends at the viewport bottom. Browser console contains no warnings or errors.
- Focused account, bootstrap, navigation, SEO and entry-policy suite: 101 tests passed.
- Vite production build succeeds, including prerendering. The full npm build's Prisma generation is blocked locally by the running Windows server holding its generated DLL; no schema change was needed for this work.
- Browser: Spanish login/guest routes, guest creation returning to a guide, private-room continuity while visiting the public homepage, return-to-room action, guest registration preserving player ID, socket and room, room restoration after reload, logout/login returning to Shop, Profile Back returning to Shop, and anonymous invitation entry from the public preview into the existing private room. Test rooms were closed afterward.
