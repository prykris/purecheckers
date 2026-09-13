# Component reuse audit — 2026-09-13

Scope: source inventory of all 64 Svelte files under `src/lib/components`, with
call-site checks in routes. This is a UI ownership/reuse audit, not a claim that
all application bugs have been found. The isolated prototype is excluded from
production duplication counts.

## Findings

Six areas need attention. They are not six independently reproduced bugs.

| Area | Evidence and impact | Status / appropriate shared owner |
| --- | --- | --- |
| Modal surface ownership | `Modal.svelte` reused the native modal action but defaulted to a transparent surface. `GameScreen` settings, spectators and reactions, plus `MoveHistory` details supplied no background: four affected views. Other callers supplied cards themselves. | Fixed: the shared Modal now owns an opaque theme surface. All four inherit it. Padding/content remain caller-owned. |
| Public/app header and navigation composition | Marketing had its own floating hamburger/overlay in addition to SiteAccount's AccountMenu. Account identity/stat markup also exists separately in SiteAccount and PlayerHeader. | Competing marketing menu removed; site navigation is now supplied to AccountMenu. Remaining header identity/stat presentation should be composed from shared primitives, with public/auth/game-entry context kept explicit. |
| Player avatars | `PlayerHeader`, `PlayerPage`, `ProfileScreen` each calculate initials and username color; `table/PlayerSeat` independently renders initials with a game-color treatment. | Four renderers should share an Avatar primitive with size and game-color variants. Profile buttons and player links retain their distinct navigation behavior. Not migrated in this fix. |
| Sound controls | `AccountMenu`, `TableSettings`, and `(app)/+layout` each implement a sound control. All use the same muted store, but AccountMenu/app layout preload before toggling while TableSettings does not. | Three controls, one state source. Centralize the user-gesture sound action and reuse a control with compact/setting variants. The initialization discrepancy is source-confirmed, not a reproduced audio failure. Not migrated here. |
| Interactive board presentation | `PuzzleBoard` owns DOM pieces, pointer-down/up state, target feedback and animation separately from canvas `BoardView`. Both share keyboard helpers and use their respective controllers. | Two interactive presentation/input implementations. Share the board view/input contract while preserving puzzle solution/reward logic. Do not replace puzzle validation with live-game rules. Article `DiagramBoard` has an explicit SSR/indexability purpose and is not automatically an erroneous duplicate. Not migrated here. |
| Icons | TableIcon centralizes table icons while equivalent close/menu/chat glyphs remain inline in AccountMenu, SlidePanel, ChatPanel and other components. | Move reusable interface glyphs to an app-wide icon primitive; retain custom artwork and diagram SVGs. This is consistency debt, not proof of state bugs. Not migrated here. |

## Reuse that is already present

- Global and room chat both render `ChatPanel`; table chat is a variant. They do
  not have separate message/draft implementations.
- Recent games, personal history, public games and player profiles render
  `GameHistory`; `GameLog` supplies its data and filtering.
- Public profiles and profile popups render `PlayerPage` through
  `PlayerProfileDialog`. ProfileScreen additionally handles private account
  settings; sharing the whole public page is not sufficient for that context.
- Live game and replay use `GameBoard` → `BoardView`. `ReplayBoard` owns playback
  rather than another renderer; SpectateScreen delegates to GameScreen.
- Sharing uses `ShareActions` in rooms, results, replays, profiles and puzzles.
- Modal, SlidePanel and UpgradeSheet all use the same `modal` action for focus,
  Escape and backdrop behavior. Their different placement is intentional;
  repeated shell styling could later become placement variants.
- Settings switches have one implementation in TableSettings. Room/privacy
  checkboxes are native checkbox controls; they are not another switch system.

## Validation and limitations

The shared modal surface was checked in the browser at 320px: the settings
panel has the opaque theme background (`rgb(41, 37, 36)`), a 288px width and an
accessible close control. Modal behavior, result rendering and navigation suites
pass: 67 tests. The header changes passed the production build before this
one-property modal surface correction. Broader remaining refactors above have
not been performed or represented as complete.

The unified signed-in marketing header was also verified at 320px: 64px tall,
username/game-entry/menu controls all share the same 44px row, with no horizontal
overflow. Its single menu opens the native dialog with Save account, sound and
12 site/language links.

Waiting-room follow-up: RoomWaiting now renders inside the existing browse shell,
under its single PlayerHeader. The separate fixed room header and docked
CommunityActions variant were removed, as was the remaining floating sound
control in the app layout (sound remains in AccountMenu and TableSettings).
At 320 × 740, browser checks found exactly one player header, no legacy edge
controls, room content scrolling below the header, and room chat still mounted.
The production build and 42 navigation/room-restoration tests pass.
