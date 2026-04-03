<svelte:head>
  <title>Changelog — Pure Checkers</title>
  <meta name="description" content="See what's new in Pure Checkers. Feature updates, improvements, and what we're building next." />
</svelte:head>

<section class="changelog">
  <h1 class="page-title">What's New</h1>
  <p class="page-sub">Latest updates to Pure Checkers</p>

  <article class="release">
    <div class="release-header">
      <h2>Game Intelligence</h2>
      <time>April 2026</time>
    </div>
    <ul>
      <li><strong>Move Analysis</strong> — every move is evaluated in real time. Your move log shows color-coded quality ratings so you can learn from each game.</li>
      <li><strong>Bot Personalities</strong> — bots now react to the game with emotes. Easy bot is friendly, Hard bot is cocky. They notice your blunders and your brilliant moves.</li>
      <li><strong>Faster Chain Captures</strong> — multi-jump sequences feel snappier. You can also queue your next jump while the current animation plays.</li>
      <li><strong>Drag & Drop</strong> — move pieces by dragging on desktop and mobile. Tap-to-select still works too.</li>
      <li><strong>Skip the Wheel</strong> — press Space or click Skip to jump straight into the game.</li>
      <li><strong>Game Log</strong> — live feed of all games being played, right on the main screen. See who's winning and who's losing in real time.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>Server-Side Bots</h2>
      <time>April 2026</time>
    </div>
    <ul>
      <li><strong>Three Difficulty Levels</strong> — Easy, Medium, and Hard bots with increasing AI depth. Each has its own ELO that adjusts naturally.</li>
      <li><strong>Real Games</strong> — bot matches are full server-side games. They show up in the room list, can be spectated, and are recorded in your history.</li>
      <li><strong>Call a Bot</strong> — create a room and invite a bot directly from the waiting screen. Pick your difficulty with one click.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>Guest Accounts Done Right</h2>
      <time>April 2026</time>
    </div>
    <ul>
      <li><strong>Real Accounts</strong> — guests now have real profiles with tracked stats, game history, and ELO.</li>
      <li><strong>Keep Your Progress</strong> — when you upgrade to a full account, all your games and stats carry over. Plus you get starter coins.</li>
      <li><strong>Fair Play</strong> — games with guests are always Friendly mode. Ranked matches require two registered players.</li>
    </ul>
  </article>

  <article class="release">
    <div class="release-header">
      <h2>Reliable State</h2>
      <time>April 2026</time>
    </div>
    <ul>
      <li><strong>No More Ghosts</strong> — the server is now the single source of truth for your game state. Refresh mid-game and everything restores perfectly.</li>
      <li><strong>Game Over Screen</strong> — see your results before being sent back to the lobby. Dismiss when you're ready.</li>
      <li><strong>Smooth Reconnects</strong> — disconnect and reconnect without losing your place. Works on both rooms and active games.</li>
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
      <li><strong>Coin Economy</strong> — earn coins by winning, spend them in the shop on themes, skins, and emotes.</li>
      <li><strong>Community Treasury</strong> — a shared vault that funds daily bounties and milestone rewards.</li>
      <li><strong>Themes</strong> — 9 themes from dark to light. Your pick persists across sessions.</li>
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

  .release { margin-bottom: var(--sp-3xl); }
  .release-header {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: var(--sp-md);
    padding-bottom: var(--sp-sm);
    border-bottom: 1px solid var(--surface2);
  }
  .release-header h2 { font-size: var(--fs-heading); font-weight: 700; }
  .release-header time { font-size: var(--fs-caption); color: var(--text-dim); }

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
</style>
