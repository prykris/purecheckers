# Design brief: first session and "challenge someone nearby" on purecheckers.com

Repo root: C:\Users\kdriv\Documents\Codex\2026-09-07\can\purecheckers (SvelteKit 2 / Svelte 5 client, Express 5 + socket.io server, Prisma + PostgreSQL). Read code before proposing; cite file paths.

## Situation
Free, no-ads online checkers built by one developer. Near-zero traffic today (4 clicks in 3 months), the database was just reset, so the server is empty: leaderboard empty, only bot games. SEO and community launches (docs/growth/) will soon send strangers to the site. A multiplayer site loses every one of them unless the first session works with zero other humans.

## What the owner has decided (constraints, do not argue these)
1. The lobby keeps its three tabs: Quick Play, Rooms, Bot. Do not merge them.
2. First-time players are auto-navigated to the Bot tab. There will be a nudge toward the real-players section. Onboarding today is minimal: at most one bubble/welcome message plus a Skip; a more comprehensive onboarding comes later, so the mechanism should be extendable.
3. "Find Opponent" (human matchmaking) stays. When nobody is found, the fallback to a bot must be offered inside the search screen itself (server-owned deadline), never by removing the feature. Someday there will be real players.
4. Scan-to-play: the waiting room already shows a QR code for the room. Scanning it must work with zero taps for the scanner: if the scanner's browser already has a token, use that profile; otherwise auto-create a guest profile; join the room; auto-ready both players; colour wheel; game. After the game the guest sees the offer to register as a real user.
5. The owner wants the "let someone scan this to challenge them" capability surfaced in a friendly, intuitive way WITHOUT scattering QR codes across many screens. Simple UI. An earlier idea was a QR icon left of the logo in the lobby header with a one-time expand animation; the owner is open to better alternatives. A previous suggestion of five surfaces was judged too many.
6. Mobile-first; assume a 360 px wide phone. Desktop must also work.
7. MOST IMPORTANT, in the owner's words: "the UI must stay sleek, designed for mobile users. So it's not crowded. If something doesn't fit, redesign the base model, not patch on top." A design that adds an icon, a bubble, a badge or a button to today's header or tabs because there happened to be room is a patch. If the current header, tab row or Quick Play panel cannot hold the new capability without crowding, propose the redesigned base layout of that screen instead, and say what was removed or merged to make space. Every element on the first screen must earn its place. Prefer fewer, larger, labelled controls over more small ones.

## Hard technical constraints (from docs/navigation-contract.md and server/domain)
- A session has exactly one phase (idle, in-room, matchmaking, in-game, spectating). Commands are bound to phases. Being in a room and in a bot game at the same time is impossible. Showing a live room QR means the host is in the in-room phase; the existing minimized-room banner (RoomBanner.svelte) lets the host browse the lobby while in a room.
- The client never mutates game or session state; it sends commands and renders server snapshots. Screens and URLs derive from the accepted snapshot.
- room:create already accepts { buyIn, turnTimer, isPrivate, allowSpectators } and generates the room QR server-side (server/domain/rooms.js). canStartRoom (server/domain/roomRules.js) requires both humans ready and online. Invite links are /join/CODE; the invite intent survives the auth step (src/lib/navigationController.js). A guest is created by POST /api/guest with a server-generated name (GET /api/guest/name). Account upgrade (POST /api/auth/upgrade) accepts a new username.
- Bot games: bot:play command; three difficulties (depth 2/4/6). Guest and bot games are FRIENDLY (no ELO); coins for bot wins are defined but unused.
- Presence: server broadcasts online and lookingToPlay counts; the online count includes the viewer.

## Today's lobby (src/lib/components)
- Lobby.svelte header row: h1 "Pure Checkers" on the left; on the right a presence pill (green dot + number) and a theme icon button. Second row: username, ELO, coins, "N searching" when > 0.
- lobby/PlayTabs.svelte: tabs Quick Play (default) | Rooms (badge) | Bot.
- lobby/QuickPlay.svelte: rating, "Find Opponent", "Play vs Friend" (opens RoomCreate form: buy-in, timer, private, spectators), then the global GameLog.
- lobby/RoomList.svelte: empty state "No rooms available. Create one!"
- lobby/BotPlay.svelte: robot icon, "Play vs Bot", Easy/Medium/Hard radios, "Challenge" button.
- lobby/RoomWaiting.svelte: QR (160 px), room code, copy link, two player slots, Ready Up button, hints.
- SearchScreen.svelte: "No other players searching right now", Minimize, Cancel; no timeout.
- GameScreen.svelte game-over block: Victory/Defeat/Draw, empty breakdown for guests/bots, one "Lobby" button, guest nudge text.
- RoomBanner.svelte: minimized room banner while in-room.
Also read docs/growth/04-first-session-empty-server.md for the full findings table. Its "merge into one Play tab" proposal is superseded by constraint 1; its findings, matchmaking fallback design, bot roster polish and post-game ideas are still valid input.

## The design questions to answer
A. Where does "challenge someone nearby by scanning" live, how many surfaces, and how does a first-time player discover it without a tour? Is the header icon the right home, or is "Play vs Friend" the right home, or something else?
B. What does the lobby look like on first visit versus for a returning player? What is the single onboarding bubble, and where is Skip?
C. The search screen fallback: what it shows, when, and what the options are.
D. The game-over screen: which actions, in what order, for bot games, human games, and for the guest who arrived by scan.
E. How the existing waiting room, its QR, "Play vs Friend" and any new quick-invite relate. Are they one room type or two? Does creating a room still require the settings form?
F. Copy: exact strings for the key elements (bubble, buttons, empty states, the text under the code, the toast the scanner sees).
G. The three user stories, tap by tap: (1) solo visitor from Google on a phone, (2) friend who scans the host's phone, (3) returning player on day three.

Score yourself honestly on: simplicity (few surfaces, no clutter), discoverability without a tour, feasibility under the session model, strength of the invite-and-register loop, honesty (no fake activity signals).
