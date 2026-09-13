# Changelog

All notable changes to Pure Checkers.

## Unreleased

## 2026-09-13

- Release checks regenerate the opening-search and two-kings certificates from Linux source; calculated results and proof branches are unchanged.

- Player slots share avatars and compact status rows, with readiness in your own slot and host actions in the player menu. Friendship actions now live in the shared profile dialog.
- Ready player slots use a subtle green fill. The shared room status shows opponent readiness and offers Play for free rooms, or Review room for wagers.
- Eligible player profiles can invite into the current room through the same invitation action used by the friends picker.

- Reworked waiting-room invitations into a compact QR/link panel with an enlarged QR dialog, inline copy/share actions, contextual help, and explicit bot difficulty selection.
- Friends can be invited into the current room through the existing invitation inbox. Invitations survive reconnect/restart, expire independently of the room, and clear when its seat is filled.

- Room settings use one compact text/icon row instead of large editable pills, preserving 44px touch targets and direct access to each setting.

- Waiting rooms now live in the shared app shell with the same player header as the lobby. Removed the legacy floating Chat, Ranks and sound controls; global panels open from the header and room chat stays in the room.

- Modal now owns its opaque theme surface, fixing transparent board settings, spectator, reaction and move-history dialogs. Marketing account and site navigation share one menu; the mobile header keeps the username, game-entry link and menu button in one row.

- Centered the live sidebar toolbar, history, composer and actions on one column. Result sidebars now include theme-aware crown/laurel artwork for victories and defeats, paired rings for draws, and neutral winner artwork for spectators. Decoration stays behind the controls and does not change board geometry.

- Board groups now fit the canvas width with symmetric player rows. Wide screens retain the vertical player rail; nearly square desktop windows keep a centered vertical table until a sidebar fits without shrinking the board. Finishing a live game animates the board into the replay layout after the final move settles, respecting animation and reduced-motion preferences. Replay controls now sit beneath the board at its full width; results omit the chat composer and keep actions in their own region.

- Transferred the approved board prototype into the app using existing theme variables and equipped piece skins. Players and board share one play area; landscape moves players into a left rail and gives the board the available height. Supplementary controls collapse on smaller screens.
- Live games and replays share the canvas renderer and accepted-position animation controller, including capture chains. Focus stays inside the app viewport, keeps the turn and timer visible, and supports a button, Escape, and a two-finger tap that cannot accidentally submit a move.
- Added persistent board settings, a visible turn handoff, horizontal move history and optional engine rating popups (off by default). Chat retains its input and draft across layout changes. Finished games stay in their session as contextual replays with existing result, sharing and rematch actions.
- Spectators share the table and replay layout with viewer-specific actions. The server supplies their roster and validates their owned reactions against current membership, connection and game state.

## 2026-09-11

- Deployed the integrated gameplay and site release. Daily puzzles are available with a 31-day buffer and a daily publisher. Production checks verified reconnection, invitations, account preservation, saved replays and room/game recovery after a server restart. Hosting now places the web app beside PostgreSQL to prevent cross-region transaction timeouts.

- Release preparation: clean Linux installation/build, all 1,149 tests, migrations from a fresh and previous-schema database, repeated seeding, and actual production-start bot/reconnect/replay checks pass. Rendering test fixtures now include the shared account-aware entry link.

- Marketing pages now recognize your account and offer Play, Continue game, Return to room or Resume search from the shared session state. Public browsing preserves the live connection. App browsing pages share the player header and an account menu with public-site links.
- Login, registration and guest play have separate URLs with Home/Back links and preserved return destinations. Saving a guest upgrades the same profile and keeps progress. Shared account/navigation controls support English and Spanish; public pages retain their rendered content and SEO metadata. Password recovery clearly states that email delivery is not yet available.

- App screens and bottom navigation share one viewport-height layout. Profile, Shop, Friends and Treasury scroll within the content area, with navigation always below it and no document scrollbar. Links now have a shared theme color while preserving player and button colors.

- The lobby now centers on your player profile, rating and coins, with Chat and Ranks in the header and account/sound controls in a menu. Guests receive a save-progress nudge. History rows use ending icons and time ago, with ranked games marked discreetly; profile sharing has space above the statistics. Lobby sizing now uses its browse container, and desktop navigation uses explicit centering.

- Game history now shares one compact list across recent games, personal history and profiles. Expand one row at a time on desktop or mobile for result, ending, recorded moves, duration and ranked rating changes; desktop hover also reveals a quick Replay action.

- Bot cards use a compact mobile layout with corner selection markers. The Play button stays visible below the independently scrolling opponents, so starting a game never requires scrolling to the bottom of the cards.

- Player names now use shared profile links across games, replays, rooms, chat, friends and rankings. Inside the app they open the existing profile view in a dismissible popup, preserving the current game, room or search. Public pages retain normal links; unavailable or private profiles remain protected.

- Finished games now open the shared replay board at the final position after the last animation, with your result above it and rematch/play-again actions below. Review moves or replay the whole game from your original board perspective. Post-game chat stays in the layout, and notices no longer cover the result heading.

- Bot capture chains animate each jump instead of exceeding the ordinary animation backlog and snapping to the end. Live snapshots containing several jumps reconstruct only a verified capture chain; reconnection, corrections and stalled rendering still settle immediately to server state.

- Room and global chat retain the same input while typing. Their keyed panels now use client identity rather than Svelte's legacy object-key behavior, which recreated the input on every draft update and lost focus.

- Room player names now open friendship actions. Invitation joins suggest adding each other to both seated players, using the existing explicit request/accept flow for guests and registered accounts. Friendship changes refresh both participants' views; uncertain actions retain their original retry identity.

- Friend invitations now open the shared room screen with chat, leaderboard access, and host settings. Private rooms appear locked in the directory without exposing invite codes. Hosts can change settings before anyone is ready; readiness confirms the displayed settings, and new friend rooms require both players to ready up.

- Bot selection now uses opponent cards with personal wins, draws, losses and win percentages from completed games. Records refresh after play and reconnects, clear on account changes, and exclude aborted games.

- Public profiles can send private game invitations with a five-minute expiry. Recipients accept or decline from Play; invitations recover through session snapshots, reserve only the sender until acceptance, and release the room on cancellation or expiry.
- Paid themes now apply from server-confirmed equipment. Profile and Shop share owned-theme selection and basic-theme reset; theme changes update boards, and account changes clear the previous appearance.
- Added GitHub feedback links and a separate daily puzzle-publisher configuration. The project remains without an open-source licence.

- Matchmaking now rechecks the server deadline when its timer wakes early, so Play a bot instead cannot remain unavailable after the deadline. Replaced searches and sessions cannot publish through old timers. A clean Linux run passes all 1,095 tests, the production build and a real bot/reconnect/replay/native-preview smoke check.

- Strategy guides now explain how to review a saved bot game using My games and Replay. Four article descriptions give clearer answers, the beginner-opening title names its topic explicitly, and redundant contextual detours were removed from the openings and traps guides.

- Reviewed all 31 launch-puzzle explanations and six theme paragraphs. Individual notes explain each tactic; alternative lines now describe actual captures, crowns and remaining pieces. Narration distinguishes compulsory captures from branch choices, identifies offered kings correctly and avoids treating promotion or material alone as a win. Existing published rows are unchanged.

- Shared request deadlines now settle independently of transport cancellation, so an ignored abort cannot leave a view or form loading forever. Reads, authentication bootstrap/forms and guest upgrades share this boundary; late results cannot replace a newer request. Write timeouts still require outcome confirmation.

- My games and profile history now use the existing authenticated history endpoint and stable player IDs, so old games and renamed accounts are not lost behind the global recent-games window. Both endpoints share one saved-game projection.
- Game-history views now subscribe before loading, refresh after reconnects, coalesce live updates, expose Retry and discard obsolete account/view responses. Leaderboard failures no longer look like empty rankings. Empty game/room lists offer working next actions; empty filters offer Show all rooms.

- Bot results now repeat the difficulty of the finished game and show it on Play again, even if the lobby preference changed. Older results with no difficulty explicitly offer Medium.
- The upgrade sheet now has an account-scoped lifetime, clearing old form fields and aborting its requests when the account changes. Obsolete sessions cannot publish an upgrade success notice.

- Regenerated the published opening analysis and two-kings proof against current shared constants. Their experimental results and proof branches are unchanged.

- Accepted invitation-code joins now retain participant-specific entry evidence through room changes, game creation and recovery. Game-start analytics uses that evidence; hosts, directory joins, spectators and rematches are not counted as new invite conversions. Adds the `game_invitation_entry` migration.
- Invitation links to a game in progress can now resolve its room for spectating; the server previously ignored the supplied join code on that path.

- Gameplay analytics now derives the first-session cohort from GA4 with bounded, optional lookups and explicit unknown values. Room-origin games are no longer incorrectly counted as invitation-link conversions; tag configuration and lookups share one measurement ID.

- Live games and public replays now share numbered move history derived from the rules engine. Multi-jumps retain every landing and crowns; saved replays stop with an explanation at an invalid step instead of silently skipping it. Corrected live snapshots refresh history even when the move count is unchanged.

- Share prompts now respect today's in-memory cap when browser storage can read but cannot write. One result-view owner clears stale prompts after account, result or privacy changes and refreshes eligible profile links without repeating the shown event.
- FAQ now explains guest/profile visibility and retained link previews, and reflects current coin, invitation and reconnection behavior. The approved daily-puzzle reward is shared between the reward service and FAQ.

- Preview cards now keep the board, result and essential details inside a centered square crop. Adds named outcomes, recorded move counts, signed ranked rating chips and invitation initials. Long names fit the shipped font with visible ellipses; outcome labels and full wager amounts remain visible.
- Wager invitations now disclose the buy-in and registration requirement in both cards and shared text. Preview template version 3 updates page image URLs and renderer cache identity together.

- Added HTTP regression coverage for preview rate limits, refill and concurrent requests, plus database/API checks that sharing-related result fields agree across replay, game lists and player profiles.

- Result sharing now uses the player's perspective, recorded move count and earned ranked rating change. Profile messages include the record, with different wording for your own and another player's profile. Puzzle messages remain spoiler-free. Share attempt/cancellation reporting now uses consistent item metadata.
- Preview page URLs and renderer cache keys now share one template version. Replay previews include article metadata and result-aware alternative text. Robots rules now cover query-bearing live-game URLs while retaining public replay routes.

- Game start, first-move and result reporting now observes accepted server snapshots, with scoped deduplication across screen changes and reconnects. Failed clicks cannot leave stale start attribution. Restored historical games are baselined instead of reported as new activity; optional tab storage preserves recent event flags across reloads.

- Waiting rooms now show server-calculated readiness and available Start/Add Bot actions. An ordinary waiting snapshot no longer produces a false “Couldn't start” message, and wager rooms no longer offer an unavailable bot action.
- Invitation screen wake locks now release safely after navigation, hidden tabs and delayed requests. Old requests or release events cannot replace the current room's lock; unsupported or denied requests never block room entry.

- The bot picker now refreshes its details when reopened, handles timeouts with a Retry action, and keeps difficulty selection usable if details are unavailable. Native radio controls support keyboard selection and visible focus; labels can wrap on narrow screens.
- First-time guests and registered players start on Bot. After the first accepted game, an automatically selected Bot tab gives way to Quick Play; deliberately selected tabs stay selected. Denied browser storage no longer prevents difficulty preferences from loading.

- Failed human pairing now preserves each remaining player's place and wait time. Cancelled searches cannot be revived by old pairing work. Uncertain room creation confirms the database outcome before requeueing or accepting another command; temporary projection failures recover without creating another room.

- Human pairing, session commands and reconnect restoration now share session ordering. Room creation rechecks the initiating session inside its transaction, rolling back obsolete creations while still confirming previously committed retries.

- Guest entry, sign-in and automatic invite entry now recover from request timeouts and reject obsolete responses after form/account changes. Late nickname suggestions no longer overwrite typing. Registration timeouts explain how to check whether the account was created.
- Search fallback now says “No match yet” when other players are queued instead of incorrectly claiming nobody is searching.

- Failed puzzle verification now leaves durable rejection evidence. Later generators and imports cannot reintroduce the position or its mirror, and status checks keep reporting retained failures across runs. Adds the `puzzle_rejections` migration.

- Puzzle publishing now prepares searches outside database transactions and applies proposals in a short, guarded commit. Runs that cross midnight preserve published puzzles; stale proposals and protected verification failures are reported explicitly, and existing attempts are retained.

- Puzzle imports now reject invalid boards, broken capture chains, incorrect move annotations/classification, insufficient verification depth and malformed publication dates before publishing.

- Real-game puzzles now use the shared public-game policy, scan older games, and display attribution only after verifying the complete replay and matching position. Participant names and source eligibility are rechecked on each request.
- Puzzle position commentary now reports actual differences in men and kings. Corrected the local launch buffer's descriptions without changing its positions or solutions.

- Dated puzzle pages now include descriptive metadata, complete breadcrumbs and previous/next head links. Puzzle themes link to relevant strategy guides, and the hub explains promotion during a capture chain.

- Puzzle progress now validates server confirmations, corrects locally solved results when the account had already revealed the solution, and offers Retry after failed or timed-out sync. Pending work survives retries and account changes; browser-storage failures are visible.
- Failed midnight puzzle reloads retry after connectivity returns. Puzzle rewards now share account-retirement locking and retain atomic attempt/wallet/ledger writes; confirming an already-earned reward refreshes the current profile too.

- Article pages and the sitemap now share catalogue validation, rejecting invalid publication dates and broken related-guide references during the build. Each guide's first Play link appears after its introduction through a shared component.

- Strategy guides now include the missing contextual FAQ and setup links. The hub reflects the completed guide collection and uses the shared Play-click analytics helper. Diagram verification now rejects positions with no legal starting move.

- Added the app tab title and leaderboard links on error pages. The public leaderboard title now explicitly identifies its ELO ranking.

- Profile privacy changes now reject stale account revisions, preventing a delayed request from overwriting a newer choice. The toggle has bounded confirmation, account-change protection and explicit refresh recovery after uncertain responses or failed reads.

- Equipped piece skins now appear in live games, spectating and app replays, including moves, captures, dragging and crowns. Labeled swatches identify the red and black sides; failed appearance reads offer Retry without blocking gameplay.
- Shop can restore standard pieces through the existing durable equipment command. Retrying an old reset cannot overwrite a newer skin, and resetting pieces leaves themes and coins unchanged.

- Friends now reads accepted, incoming and outgoing relationships together, recovers failed reads and uses current session presence. Requests can be declined or cancelled.
- Friendship changes use durable confirmation receipts and shared account locks. Simultaneous reciprocal requests cannot duplicate a relationship, and retrying an old action cannot revive a removed friendship or remove a newer one. A migration conservatively cleans legacy duplicate pairs and enforces unordered uniqueness.

- Player emotes now use server-verified free/owned catalogue items and canonical content. Forged or unowned reactions are rejected, and failed lookups cannot bypass the send cooldown.
- Emote reads and acknowledgements recover with account/game/connection guards. Reactions are never automatically replayed after reconnect, and old-game broadcasts are discarded. The toolbar now wraps with accessible button targets and explicit retry feedback.

- Shop now reads catalogue and ownership together and recovers failed or obsolete reads through the shared read lifecycle.
- Equipment selections use the existing durable action journal and receipts. Retrying an old selection cannot undo a newer one; uncertain selections survive same-tab reload and show Confirm selection.
- Wallet/admin recovery also respects new authentication sessions using the same account ID. Cosmetic rendering and the free/paid theme policy remain under audit.

- Treasury totals and personal pending rewards now come from one committed database snapshot. Funded claims remain available even when all vault funds are owed; the server supplies claim availability and rechecks funds when paying.
- Treasury accounting includes active wager reservations and deferred rewards paid later. Loading/claim recovery now rejects obsolete reads, offers Refresh after failures and keeps successful confirmation distinct from a failed follow-up read.

- Connected accounts now receive repeated database revision hints. A browser behind the server refreshes through the shared profile owner; missed hints and failed reads recover automatically without duplicating payment or reward logic.

- Account profiles now carry a transactional database revision. One browser account owner rejects stale and cross-session responses; token renewal and guest upgrades preserve the current gameplay connection.
- Friends, privacy and treasury use the shared profile refresh. Treasury claims no longer add historical receipt amounts to browser balances. Reconnect, settled games and tab focus request current account data.
- Automatic invitation guests cannot replace a newer authentication attempt. `/auth/me` is non-cacheable and returns versioned User fields; equipped inventory remains on its shop endpoint.

- Fresh installs explicitly generate Prisma Client, and production startup now works on Windows. Local examples use local invitation URLs and document test-database creation.
- Development API/socket proxies follow the configured backend port; Vite uses the configured client port without silently switching. Backend watching excludes frontend-generated files.
- Pinned Prisma's configuration merge dependency to its patched release and verified a clean install, migration, seed, test, build and startup sequence. npm audit reports zero known vulnerabilities for the updated lockfile.

- Added read-only puzzle buffer reporting and a maintenance command that reuses publishing/reverification, detects missing dates and checks coverage after UTC rollover. Dry runs distinguish proposed rows from stored availability.
- Puzzle imports reject conflicting content even when the position matches, while preserving deeper verification already recorded. Added a publishing and monitoring runbook; production scheduling is not yet enabled.

- Administrative adjustments now use transactional authorization, durable request receipts and a coin ledger. Retrying a lost response cannot repeat an accepted adjustment, reset or permission change.
- Admin rating/stat changes wait for room/game/result departure and settlement, and preserve reward history. The admin panel shares the wallet's persisted action recovery mechanism and exposes pending confirmation after reload.

- Added the friends walkthrough with three annotated screenshots, full-size image links and instructions for room settings, invitations and readiness. All twelve planned English strategy guides are now written; README includes an actual local gameplay screenshot.
- Fixed a chat visibility/read publication loop that could freeze newly created standard rooms on Creating. Read state now settles without repeated publications or unchanged storage writes.
- Shared modals remain centered despite the global CSS reset. Production startup imports the SvelteKit handler using a portable file URL on Windows.
- When native sharing and clipboard access fail, sharing controls expose the actual invitation/replay/profile/puzzle URL for manual copying instead of suggesting the browser address.

- Added a traps guide with five interactive examples, verified defensive alternatives and a playable blocking exercise. Explanations distinguish forced material gains from conditional traps, promotion costs and immobilization wins.

- Finished results now persist viewer membership, rematch consent and original expiry deadlines. Startup and reconnect restore accepted views; dismissed results stay dismissed, and overdue results expire before startup recreates sessions.
- Player/spectator departure and navigation await durable result dismissal. Rematches use one saved identity, swap colours, handle bots automatically and recover lost responses; spectators retain the old result.
- Terminal checkpoints, settlement intent, result membership and source-room closure commit together. Delayed room projections cannot revive a closed room or dismissed spectator. Shutdown drains settlement even after the last result viewer leaves.

- Room-removal notices now commit with membership changes and survive restart. Notice dismissal is durable; lost responses, repeated events and delayed reads cannot duplicate or revive a dismissed notice.
- Finished-game cleanup records expiry notices before closing result views and retries storage failures. Result views and their original expiry deadlines now restore across restart.

- Live room commands now persist membership, readiness, invite codes and game-start identity before publication. Repeated commands and lost creation/start/departure responses recover accepted state without duplicating rooms or wager charges.
- Startup restores waiting rooms and active-game spectators before accepting connections. Reconnect waits for membership reconciliation before its first snapshot. Human readiness resets after restart; bots remain ready, and QR invitations use the saved code.
- Room players and spectators share persisted disconnect deadlines and one room-owned expiry timer. Repeated restarts preserve deadlines; failed presence/cleanup writes retry. Existing wager members can leave even if they can no longer afford another start.
- Room-backed starts and cancellation transfer claims and wager funds atomically. Result/rematch integration is covered locally; Railway replacement verification remains pending.
- Room settings and invitation-code validation are shared across the repository, existing room actions and SSR invite entry.

- Shutdown now closes gameplay admission and drains pending room setup, game starts and optional analysis. Delayed continuations cannot install new state afterward; uninstalled reservations are refunded once by the same owner or left for the replacement to reconcile.
- Stopped games no longer rearm result-cleanup timers after delayed name lookup, publish stale analysis reactions, or create disconnect chat messages during transport shutdown.

- Updated launch drafts and README to describe the actual rules, bounded bot search and recovery limits. Added a release acceptance record and the missing account-lifecycle deployment notes; publication and production checks remain pending.

- Added a beginner-opening guide with five numbered practice lines, verified capture choices and supporting-square explanations. Corrected the first-move guide to show both legal recaptures after 15x24.
- Diagram move labels stay on one line beside longer notes, including on narrow screens.

- Guest account saves now confirm current registration before retrying, recover committed upgrades after lost responses, and offer a status check for uncertain saves. Requests time out and ignore responses after account replacement; recovery stores no passwords.
- Account refresh replaces obsolete guest tokens after an upgrade and repairs live identity after an interrupted publication, preserving the existing socket and one-time starter grant.

- Cancelled games now remain neutral across private history, public profiles, live results and replay screens. Shared result interpretation replaces loss/draw fallbacks; replay metadata, share text and preview cards identify cancellation consistently.

- Guest cleanup now retires accounts while preserving history, protects active sessions and outstanding entitlements, and uses bounded work fenced to the current server owner. Retired identities cannot be renewed or upgraded.
- HTTP and socket authentication load current account identity. Guest upgrades update waiting-room registration status; registration and upgrade commit starter coins with a ledger entry, preventing repeated grants from concurrent requests or old tokens.

- Leaving, kicking or expiring a room after a failed start now confirms cancellation and refunds before removing membership. Rooms stay visible and retryable during storage failures; lost cancellation responses cannot repeat refunds.
- Spectator departure does not cancel player stakes. Room expiry rechecks reconnects before cancellation and departure, and retries temporary failures through the shared disconnect-cleanup scheduler. Room screens and directory entries display pending changes.

- Human active-game membership is now enforced in PostgreSQL, including guests and starts racing across colours/opponents. Creation and wager debits commit with membership; accepted endings and cancellation release it atomically. Bots remain available to multiple games.
- Delayed settlement of an old game cannot clear a newer game's membership. Startup rebuilds claims before listening, and retrying an uncertain uninstalled bot start cancels the orphan reservation instead of creating a duplicate or stranding the player.

- Startup restores committed unfinished games and their human game sessions before accepting connections. A two-minute recovery pause preserves clocks and the saved turn; players resume explicitly, including games interrupted during colour reveal or a bot turn.
- Unattended restart recovery cancels without rating, statistics or reward changes and refunds wagers once. Replaced connections must acknowledge readiness again. Versioned uninstalled starts can be refunded safely; ambiguous legacy checkpoints or overlapping saved memberships stop startup for review.

- Gameplay creation, cancellation and state commits now require a captured server ownership generation. Replacement waits for in-flight writes and then fences the old process, even if it reads newer game data.
- Ownership loss and shutdown stop runtime work and close transports. Durable terminal settlement remains retryable across owner changes. Single-replica operation is still required; production continuity for the restored room/game/result lifecycles remains unverified.

- Gameplay changes now commit isolated drafts before appearing in snapshots or acknowledgements. Durable checkpoints include moves, capture/draw history, reveal state, clocks and draw decisions, with command receipts preventing repeated moves.
- Terminal checkpoints and settlement jobs now commit together. Removed the in-memory unqueued-result retry path; failed terminal commits keep the last confirmed live state.
- Added bot-move/reveal persistence retries and reconnect guards for queued forfeitures. Invalid commands cannot reset elapsed time.

- Game creation and both wager stakes now commit together in a durable record with a stable navigation ID. Retrying the same start cannot debit again; failed installation refunds are atomic and repeatable.
- Settlement validates and closes its wager reservation alongside the result. Removed separate room-layer stake debits/refunds and added explicit stake/refund ledger reasons.

- Completed games now record a durable terminal intent before settlement, and a bounded startup/background worker retries unfinished jobs. Job completion and all financial effects commit together; a restart after commit cannot repeat the payment.
- Failed result screens recover through the existing snapshot when persistence returns. Terminal intent now commits with the accepted checkpoint, replacing the earlier in-memory enqueue buffer.

- Purchases and tips now commit all wallet, inventory, vault and receipt changes atomically; concurrent spending cannot bypass available funds. Durable request receipts make repeated confirmations safe.
- Shop and Friends share a saved pending-payment flow with bounded requests, account-switch protection and same-tab reload recovery. Concurrent equipment choices leave only one item of each type active.
- New purchase burn allocation no longer appears as a second wallet debit; treasury combines historical and new burn totals.

- Game settlement now commits replay, ratings, statistics, wallet credits, vault movements and queued rewards together, with a durable receipt preventing duplicate settlement.
- Fixed concurrent wallet/vault debit races in the shared services, repeated unpaid daily bounties, and duplicate payout claims. Pending claims retain receipts for safe retries; daily eligibility uses UTC.
- Corrected recorded payout totals to include refunds and measure wager eligibility at game end. Live-game and wager-reservation recovery across server restarts remain unfinished.

- Public rate limits share one explicit client-address policy for direct hosting and Railway's HTTP edge. Address aliases share a bucket; rotating identities cannot grow limiter memory without bound. Railway configuration and edge verification remain deployment steps.

- Updated framework, socket and development dependencies; the local audit fell from 25 affected entries to three entries from one remaining Prisma configuration dependency. See docs/dependency-audit.md for exposure and follow-up. The full 330-test suite and production build passed after the updates.

- Added computer-opponent, two-kings endgame and variant-comparison guides, including a forced-win certificate covering every legal defence in the worked ending.
- Corrected bot score arithmetic so equivalent evaluations remain tied and move grades respect their exact thresholds. Regenerated the opening comparison and versioned the puzzle generator as 1.2.1; all 31 prepared puzzles passed deep re-verification.

- Added backward-capture and double-jump strategy guides; corrected existing rules and opening explanations, with reproducible bot-search evidence and engine-checked diagrams.
- Strategy diagrams now display each capture hop separately and expose legal targets and step changes to assistive technology.

- Strategy diagrams move bot search off the browser UI thread and cancel stale work on reset/navigation, sharing the worker scheduling core with server bots.

- Acknowledged chat delivery, durable retry IDs, safe text rendering, and shared reconnect/history recovery for both chat surfaces.
- Versioned room browsing, recoverable removal notices, accurate spectator counts and opponent reconnect deadlines.
- Keyboard board controls, shared modal focus handling and explicit feedback while commands and draw responses are confirming.

- Added public rankings, recent human-game discovery and a dynamic sitemap with one shared eligibility policy and consistent move notation.
- Moved bot thinking, optional move grading and generated preview images into bounded background workers.
- Added server-rendered daily puzzles, animated play, hints, reveal, UTC streaks and account-scoped progress recovery. Registered players can earn one coin for their first eligible solve of today's puzzle; retrying cannot award twice.
- Prepared a deeply verified 31-puzzle launch artifact, a bounded generator and an atomic, repeatable importer. Production publishing is still pending.
- Added shared result, replay, profile, puzzle and invitation sharing, generated PNG previews, and an optional public-profile setting.
- Fixed stale replay/profile data after navigation and replay animation cleanup. New replays retain the actual game-ending reason. Pending milestone payouts no longer appear as coins already received.
- These changes are local and have not been committed or deployed.

---

## 10 September 2026 — Colour Wheel Returns

- Every game, including bot games, quick play and rematches, opens with the colour wheel again. Skip it with the button or Space.
- The server now owns this stage: colours are assigned up front, the clock stays stopped and moves are refused until both players have finished or skipped the wheel. Bots count as finished, and a 12-second deadline starts the game if a player never responds.
- Reconnecting during the reveal restores the result instead of spinning again. Reduced-motion users see the result immediately.
- Removed the old 5-second clock bonus for the first mover, which only existed because the game used to start underneath the wheel.

---

## 10 September 2026 — PostgreSQL Storage

- Moved all persistence from a SQLite file inside the app container to PostgreSQL. Railway redeploys no longer erase users, games, coins or friendships. See docs/deployment.md.
- Startup now runs `prisma migrate deploy` instead of `db push`; the migration history was recreated for PostgreSQL and the SQLite files were archived under prisma/migrations-sqlite-archive.
- The server shares one Prisma client (server/db.js) instead of fifteen, keeping the database connection count bounded.
- Removed the SQLite-only prepareDatabase upgrade step. Tests and local development use a Dockerised PostgreSQL (`npm run db:up`).

---

## 10 September 2026 — Reliable Sessions & Animated Gameplay

- Rebuilt gameplay synchronization around authoritative server snapshots, explicit commands, duplicate-request protection and reconnect recovery.
- Fixed bot readiness and room cleanup. A shared bot registry now creates missing accounts safely and preserves existing identities and statistics.
- Unified browser navigation: screens and URLs follow accepted session state, including minimized rooms, reloads and Back/Forward.
- Added move slides, capture fade/shrink, promotion glow and result reveal after the final move, for players and spectators.
- Bounded animation queues cancel on recovery, tab suspension, board orientation changes or reduced-motion settings.
- Replay loading now reports errors and discards responses from obsolete navigation. Room departure remains visible until confirmed.
- Removed the legacy wheel screen and independent client gameplay-state mutations.
- Added regression coverage for session recovery, commands, bot provisioning, navigation, animation ordering and additive database upgrades.

---

## v1.3.0 — Game Polish

### Move Analysis
- Every move is evaluated against the best possible move using minimax (depth 6)
- Move log shows color-coded quality: gold (best), green (good), orange (inaccuracy), red (blunder)
- Hover over a move for a tooltip explaining the rating

### Bot Personalities
- Bots react to game moments with emotes (captures, blunders, kings, winning positions)
- Each difficulty has a unique personality: Easy is friendly, Medium is neutral, Hard is cocky
- Emotes are rare (20-second cooldown + probability roll) — they hit harder when they're unexpected

### Gameplay Feel
- Chain captures can be queued during animation — click the next target while the current animation plays
- Bot chain jumps are faster (150ms between each, down from 400-1000ms)
- Drag and drop pieces on both PC and mobile (touch support)
- Click-to-select still works alongside drag
- Wheel animation is skippable (click Skip or press Space)
- Game starts immediately — wheel is purely cosmetic, red gets 5s grace time

### Game Log
- Global game log in the Quick Play tab, updated in real time
- Toggle to filter "My games" only
- Personal game history in the Profile screen with "Find an opponent" link when empty
- All games (ranked + friendly) are now recorded in the database

### UI
- Treasury moved to bottom navigation
- Theme persists across page reloads (was resetting on refresh)
- Blunder moves in the log have a thicker red border + subtle background tint
- Spectator count visible during games

---

## v1.2.0 — Phase-Driven Client

### Architecture
- Two-layer rendering: game overlay (phase-driven) + browse tabs (user-controlled)
- Zero `goto()` calls in components — all state-driven via stores
- `gameScreen` derived store controls what overlay to show
- `browseTab` store for lobby/shop/friends/profile navigation
- URLs reflect state but never drive it

### Game Over
- Game over screen stays until player dismisses (was kicking to lobby instantly)
- Server keeps phase as `in-game` after game ends — client shows results
- `game:leave` event triggers cleanup when player dismisses
- 60-second auto-cleanup if player never dismisses
- Refreshing during game over restores the game over screen

### Navigation
- Phase-gated routes: can't visit /game without being in a game
- Browse freely while in a room or matchmaking (banners show active state)
- No more flickering, race conditions, or forced redirects

---

## v1.1.0 — Guest System + Server-Side Bots

### Guest Accounts
- Guests are real database users (`isGuest: true`, nullable email/password)
- Game history, ELO, wins/losses tracked for guests
- Upgrade to registered account preserves all stats + adds starter coins
- Username collision handled with retries
- Expired guests cleaned up hourly (tombstoned if they have game history)
- Old `GuestSession` table and negative userId hack removed

### Game Economy
- Both registered players: RANKED (ELO changes + coin rewards)
- Any guest or bot involved: FRIENDLY (no ELO, no coins)
- Room UI shows "Ranked" or "Friendly" badge before readying up
- Rooms with buy-in are naturally guest-proof (no coins = can't join)
- Leaderboard excludes guests and bots

### Server-Side Bots
- 3 bot accounts: Easy (depth 2), Medium (depth 4), Hard (depth 6)
- Bots are real database users — game history and ELO tracked
- "Call a Bot" UI in room waiting screen with difficulty radio selector
- Bot tab in lobby creates a room + calls a bot automatically
- Bot moves scheduled with natural delay, visible to spectators
- Room list shows bot games (spectatable)

### Quick Play
- Matchmaking creates rooms as output (all games happen in rooms)
- Registered players prioritized for registered-vs-registered matches
- Falls back to mixed matches after 10 seconds
- Room list sorted oldest-first (stable, no jumping)

---

## v1.0.0 — Server-Authoritative State

### sync:state
- Server pushes complete user state on every connect/reconnect
- Client renders from sync payload — no guessing, no timeouts, no races
- Single `applySync()` function atomically sets all stores

### Phase System
- `UserSession` with enforced phase transitions: idle, in-room, matchmaking, in-game, spectating
- Phase validation on room create/join, matchmaking, game start
- Invalid transitions rejected with clear error messages

### Presence
- Derived entirely from user sessions (removed separate `userStatus` Map)
- Auto-broadcast on every phase change
- Stats included in sync:state payload

### Disconnect Handling
- Centralized in `userState`: 30s for games, 2min for rooms
- Matchmaking immediately removed on disconnect
- Single entry point for all timeout logic

### Client
- Single `initSocket()` entry point (no duplicate socket init paths)
- `reconnectSocket()` for identity changes (guest upgrade)
- Old `client/` SPA directory deleted

---

## v0.x — Foundation

- P2P checkers prototype with animations
- Express + Socket.IO + Prisma/SQLite server
- Svelte client with auth, lobby, game, shop, friends screens
- ELO rating system + leaderboard
- Coin economy with vault, treasury, shop
- Room system with QR codes and join links
- Global chat with slide-out panels
- Room lifecycle with reconnect support
- Chat rewrite with unique IDs and system messages
