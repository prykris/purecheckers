<script>
  // Release dates — each date gets a dot on the activity grid
  const releases = [
    '2026-04-06', '2026-04-06', // Navigation + SEO
    '2026-04-05', '2026-04-05', '2026-04-05', '2026-04-05', '2026-04-05', // Game intelligence, bots, guests, state, polish
    '2026-03-28', // Launch
  ];

  // Count releases per day
  const activity = {};
  for (const d of releases) activity[d] = (activity[d] || 0) + 1;
  const maxActivity = Math.max(1, ...Object.values(activity));

  // Build grid: 52 weeks x 7 days going back from today
  function buildGrid() {
    const grid = [];
    const today = new Date();
    const dow = today.getDay();
    const start = new Date(today);
    start.setDate(start.getDate() - dow - 52 * 7);

    for (let w = 0; w < 53; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start);
        dt.setDate(dt.getDate() + w * 7 + d);
        const key = dt.toISOString().slice(0, 10);
        const count = activity[key] || 0;
        const future = dt > today;
        col.push({ key, count, future });
      }
      grid.push(col);
    }
    return grid;
  }
  const grid = buildGrid();
</script>

<svelte:head>
  <title>Changelog — Pure Checkers</title>
  <meta name="description" content="See what's new in Pure Checkers. Feature updates, improvements, and what we're building next." />
  <link rel="canonical" href="https://purecheckers.com/changelog" />
  <meta property="og:title" content="Changelog — Pure Checkers" />
  <meta property="og:description" content="See what's new in Pure Checkers. Feature updates and improvements." />
  <meta property="og:url" content="https://purecheckers.com/changelog" />
</svelte:head>

<section class="changelog">
  <h1 class="page-title">What's New</h1>
  <p class="page-sub">Latest updates to Pure Checkers</p>

  <div class="activity-section">
    <div class="activity-grid">
      {#each grid as week}
        <div class="activity-col">
          {#each week as day}
            <div
              class="activity-cell"
              class:future={day.future}
              style="opacity: {day.future ? 0.05 : day.count === 0 ? 0.1 : 0.3 + 0.7 * (day.count / maxActivity)};
                     background: {day.count > 0 ? 'var(--accent)' : 'var(--text-dim)'};"
              title="{day.key}: {day.count} update{day.count !== 1 ? 's' : ''}"
            ></div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <article class="release">
    <div class="release-header">
      <h2>Navigation, Profiles & Replays</h2>
      <time>6 April 2026</time>
    </div>
    <ul>
      <li><strong>Mobile Navigation</strong> — floating hamburger menu on all marketing pages. No more dead ends on mobile.</li>
      <li><strong>Breadcrumbs</strong> — player profiles and game replays now show a breadcrumb trail (Home / Page) for easy navigation back.</li>
      <li><strong>Game Replay Outcome</strong> — when you reach the last move, a card shows who won and why (forfeit, all pieces captured, no valid moves).</li>
      <li><strong>Replay Links Everywhere</strong> — hover over any game in the game log or player profile to reveal a replay button.</li>
      <li><strong>Bot Profiles</strong> — bot player pages show a purple "Bot" badge and "AI Opponent" label. Their game history is viewable.</li>
      <li><strong>Activity Heatmap</strong> — player profiles now show a GitHub-style activity grid of games played per day over the last year.</li>
      <li><strong>Footer Links</strong> — added Strategy, Home, and language switcher (English / Español) to the footer.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>SEO, Analytics & Public Pages</h2>
      <time>6 April 2026</time>
    </div>
    <ul>
      <li><strong>Player Profiles</strong> — every player now has a public profile page at <code>/player/username</code> showing their ELO, win rate, and recent games.</li>
      <li><strong>Game Replays</strong> — watch any finished game move-by-move at <code>/game/id</code> with keyboard navigation. Share replays with friends.</li>
      <li><strong>FAQ Page</strong> — frequently asked questions with structured data for Google rich snippets.</li>
      <li><strong>Self-Hosted Fonts</strong> — Poppins is now served locally instead of from Google Fonts. Faster page loads, no third-party requests.</li>
      <li><strong>Google Analytics</strong> — tracking enabled to understand how players use the site.</li>
      <li><strong>Open Graph & Twitter Cards</strong> — proper social sharing previews when links are posted on social media.</li>
      <li><strong>Sitemap & Robots</strong> — search engines can now discover and index all public pages.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>Developer Tools & Quality of Life</h2>
      <time>6 April 2026</time>
    </div>
    <ul>
      <li><strong>Connection Status</strong> — a warning bar appears when your connection drops, showing reconnection progress. No more silent disconnects.</li>
      <li><strong>Dev Panel</strong> — press F2 to inspect live game state, socket events, and stores. Copy a full diagnostic report with one click. Admin users get economy tools.</li>
      <li><strong>Admin System</strong> — designated admin accounts can manage the game economy directly from the dev panel.</li>
      <li><strong>Scrollable Game Log</strong> — the game log in the Quick Play tab now scrolls within its own container with a styled scrollbar.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>Game Intelligence & Polish</h2>
      <time>5 April 2026</time>
    </div>
    <ul>
      <li><strong>Move Analysis</strong> — every move is evaluated in real time against the best possible play. Your move log shows color-coded quality ratings: gold for best moves, green for good, orange for inaccuracies, red for blunders.</li>
      <li><strong>Bot Personalities</strong> — bots now react to the game with emotes. Easy bot is friendly, Hard bot is cocky. They notice your blunders and your brilliant moves.</li>
      <li><strong>Faster Chain Captures</strong> — multi-jump sequences are snappier. You can also queue your next jump while the current animation plays — no more waiting.</li>
      <li><strong>Drag & Drop</strong> — move pieces by dragging on desktop and mobile. Touch and mouse both supported. Tap-to-select still works too.</li>
      <li><strong>Skip the Wheel</strong> — press Space or click Skip to jump straight into the game. The game starts immediately on the server — the wheel is purely visual.</li>
      <li><strong>Game Log</strong> — live feed of all games being played, right in the Quick Play tab. Toggle between all games and your own. Profile page shows your personal game history.</li>
      <li><strong>All Games Recorded</strong> — both ranked and friendly games are now saved to the database with full history.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>Server-Side Bots</h2>
      <time>5 April 2026</time>
    </div>
    <ul>
      <li><strong>Three Difficulty Levels</strong> — Easy, Medium, and Hard bots with increasing AI depth. Each has its own ELO that adjusts naturally from games played.</li>
      <li><strong>Real Games</strong> — bot matches are full server-side games. They show up in the room list, can be spectated by anyone, and are recorded in your history.</li>
      <li><strong>Call a Bot</strong> — create a room and invite a bot directly from the waiting screen. Pick your difficulty with colored radio buttons. Or use the Bot tab for a one-click start.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>Guest Accounts Done Right</h2>
      <time>5 April 2026</time>
    </div>
    <ul>
      <li><strong>Real Accounts</strong> — guests now have real profiles with tracked stats, game history, and ELO ratings.</li>
      <li><strong>Keep Your Progress</strong> — when you upgrade to a full account, all your games and stats carry over. Plus you get starter coins as a welcome bonus.</li>
      <li><strong>Fair Play</strong> — games involving guests are always Friendly mode. Ranked matches with ELO changes and coin rewards require two registered players.</li>
      <li><strong>Username Taken?</strong> — if you try to play as a guest with a name that belongs to a registered player, you'll be told the name is taken instead of crashing.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>Reliable State & Navigation</h2>
      <time>5 April 2026</time>
    </div>
    <ul>
      <li><strong>Server-Authoritative State</strong> — the server is now the single source of truth. Refresh mid-game and everything restores perfectly — board position, timers, whose turn it is.</li>
      <li><strong>Game Over Screen</strong> — see your results, ELO changes, and coin rewards before being sent back to the lobby. Dismiss when you're ready.</li>
      <li><strong>Phase-Driven UI</strong> — no more phantom screens, stuck spinners, or ghost room indicators. The UI renders from server state, not URL guessing.</li>
      <li><strong>Quick Play Creates Rooms</strong> — matchmaking now creates proper rooms that appear in the room list and can be spectated. All games happen in rooms.</li>
      <li><strong>Room List Stability</strong> — rooms are sorted oldest-first so the list doesn't jump around as new rooms are created.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>Launch</h2>
      <time>March 2026</time>
    </div>
    <ul>
      <li><strong>Play Online</strong> — real-time multiplayer checkers with matchmaking, private rooms, and QR code invites.</li>
      <li><strong>ELO Rating</strong> — compete on the leaderboard. Your skill rating adjusts after every ranked game.</li>
      <li><strong>Coin Economy</strong> — earn coins by winning, spend them in the shop on themes, skins, and emotes. Closed economy — no pay-to-win.</li>
      <li><strong>Community Treasury</strong> — a shared vault funded by game taxes that pays out daily bounties and milestone rewards.</li>
      <li><strong>9 Themes</strong> — from dark to light, including Ocean, Forest, Sunset, Midnight, Latte, Paper, Sand, and Cloud. Your pick persists across sessions.</li>
      <li><strong>In-Game Chat</strong> — global chat, room chat, and game chat with system messages for connects, disconnects, and game events.</li>
      <li><strong>Mobile First</strong> — designed for phones and tablets with touch support, safe area handling, and responsive layouts.</li>
      <li><strong>No Ads, No Paywalls</strong> — free forever. Play as much as you want.</li>
    </ul>
  </article>
</section>

<style>
  .changelog {
    max-width: 700px; margin: 0 auto;
    padding: 64px var(--sp-md) 120px;
  }
  .page-title { font-size: var(--fs-title); font-weight: 700; text-align: center; margin-bottom: var(--sp-xs); }
  .page-sub { text-align: center; color: var(--text-dim); font-size: var(--fs-body); margin-bottom: var(--sp-3xl); }

  .release { margin-bottom: 64px; padding-top: 48px; }
  .release-header {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: var(--sp-md);
    padding-bottom: var(--sp-sm);
    border-bottom: 1px solid var(--surface2);
  }
  .release-header h2 { font-size: var(--fs-heading); font-weight: 700; }
  .release-header time { font-size: var(--fs-caption); color: var(--text-dim); flex-shrink: 0; }

  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--sp-sm); }
  li {
    font-size: var(--fs-body); color: var(--text-dim); line-height: 1.6;
    padding-left: var(--sp-md);
    position: relative;
  }
  li::before {
    content: ''; position: absolute; left: 0; top: 10px;
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent);
  }
  li strong { color: var(--text); }

  .activity-section { margin-bottom: var(--sp-xl); }
  .activity-grid {
    display: flex; gap: 2px; overflow-x: auto;
    padding: var(--sp-sm) 0;
    scrollbar-width: none;
  }
  .activity-grid::-webkit-scrollbar { display: none; }
  .activity-col { display: flex; flex-direction: column; gap: 2px; }
  .activity-cell { width: 10px; height: 10px; border-radius: 2px; }
  .activity-cell.future { visibility: hidden; }
</style>
