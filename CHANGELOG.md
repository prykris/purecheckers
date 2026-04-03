# Changelog

All notable changes to Pure Checkers.

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
