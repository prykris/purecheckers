<script>
  let { data } = $props();
  // svelte-ignore state_referenced_locally
  const { player, games, activity } = data;

  const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;

  // Build activity grid — 52 weeks x 7 days, starting from today going back
  function buildActivityGrid() {
    const grid = [];
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    // Start from the first Sunday, 52 weeks ago
    const start = new Date(today);
    start.setDate(start.getDate() - dayOfWeek - (52 * 7));

    for (let week = 0; week < 53; week++) {
      const col = [];
      for (let day = 0; day < 7; day++) {
        const d = new Date(start);
        d.setDate(d.getDate() + week * 7 + day);
        const key = d.toISOString().slice(0, 10);
        const count = activity[key] || 0;
        const future = d > today;
        col.push({ key, count, future });
      }
      grid.push(col);
    }
    return grid;
  }
  const activityGrid = buildActivityGrid();
  const maxActivity = Math.max(1, ...Object.values(activity));
  const initials = (player.username || '?').slice(0, 2).toUpperCase();
  const avatarHue = player.username.split('').reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  const memberSince = new Date(player.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  function fmtDate(d) {
    const ms = Date.now() - new Date(d).getTime();
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function resultFor(g) {
    const isRed = g.myColor === 'red';
    if (g.result === 'DRAW') return 'draw';
    if (isRed && g.result === 'RED_WIN') return 'win';
    if (!isRed && g.result === 'BLACK_WIN') return 'win';
    return 'loss';
  }
</script>

<svelte:head>
  <title>{player.username} — Pure Checkers Player Profile</title>
  <meta name="description" content="{player.username} has played {player.gamesPlayed} games with an ELO of {player.elo} on Pure Checkers. Win rate: {winRate}%." />
  <link rel="canonical" href="https://purecheckers.com/player/{player.username}" />
  <meta property="og:title" content="{player.username} — Pure Checkers" />
  <meta property="og:description" content="ELO {player.elo} · {player.wins}W / {player.losses}L · {winRate}% win rate" />
  <meta property="og:url" content="https://purecheckers.com/player/{player.username}" />
  <script type="application/ld+json">
  {JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "mainEntity": {
      "@type": "Person",
      "name": player.username,
      "url": `https://purecheckers.com/player/${player.username}`
    }
  })}
  </script>
</svelte:head>

<section class="profile-page">
  <nav class="breadcrumb">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <span>{player.username}</span>
  </nav>

  <div class="profile-header">
    <div class="avatar" style="background: hsl({avatarHue}, 45%, 35%)">{initials}</div>
    <div class="header-info">
      <div class="name-row">
        <h1 class:bot={player.isBot}>{player.username}</h1>
        {#if player.isBot}
          <span class="badge bot" title="AI opponent">Bot</span>
        {:else if player.isGuest}
          <span class="badge guest">Guest</span>
        {/if}
      </div>
      <span class="since">{player.isBot ? 'AI Opponent' : `Member since ${memberSince}`}</span>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <span class="stat-value">{player.elo}</span>
      <span class="stat-label">ELO Rating</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{player.peakElo}</span>
      <span class="stat-label">Peak ELO</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{player.gamesPlayed}</span>
      <span class="stat-label">Games</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{winRate}%</span>
      <span class="stat-label">Win Rate</span>
    </div>
    <div class="stat-card">
      <span class="stat-value win">{player.wins}</span>
      <span class="stat-label">Wins</span>
    </div>
    <div class="stat-card">
      <span class="stat-value loss">{player.losses}</span>
      <span class="stat-label">Losses</span>
    </div>
  </div>

  <div class="activity-section">
    <h2 class="section-heading">Activity</h2>
    <div class="activity-grid">
      {#each activityGrid as week}
        <div class="activity-col">
          {#each week as day}
            <div
              class="activity-cell"
              class:future={day.future}
              style="opacity: {day.future ? 0.05 : day.count === 0 ? 0.1 : 0.2 + 0.8 * (day.count / maxActivity)};
                     background: {day.count > 0 ? 'var(--success)' : 'var(--text-dim)'};"
              title="{day.key}: {day.count} game{day.count !== 1 ? 's' : ''}"
            ></div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  {#if games.length > 0}
    <h2 class="section-heading">Recent Games</h2>
    <div class="game-list">
      {#each games as g}
        {@const result = resultFor(g)}
        <div class="game-row" class:win={result === 'win'} class:loss={result === 'loss'}>
          <span class="game-result">{result === 'win' ? 'W' : result === 'loss' ? 'L' : 'D'}</span>
          <span class="game-opponent">vs {g.opponent}</span>
          <span class="game-mode">{g.mode === 'RANKED' ? 'Ranked' : 'Friendly'}</span>
          <span class="game-date">{fmtDate(g.date)}</span>
          <a class="game-replay" href="/game/{g.id}" title="Watch replay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </a>
        </div>
      {/each}
    </div>
  {:else}
    <p class="no-games">No games played yet.</p>
  {/if}

  <div class="cta">
    <a href="/auth" class="play-link">Challenge {player.username} — Play Now</a>
  </div>
</section>

<style>
  .breadcrumb { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-caption); margin-bottom: var(--sp-md); }
  .breadcrumb a { color: var(--text-dim); text-decoration: none; }
  .breadcrumb a:hover { color: var(--accent); }
  .breadcrumb .sep { color: var(--text-dim); opacity: 0.4; }
  .breadcrumb span:last-child { color: var(--text); font-weight: 500; }

  .profile-page {
    max-width: 600px; margin: 0 auto;
    padding: 64px var(--sp-md) 120px;
  }

  .profile-header { display: flex; align-items: center; gap: var(--sp-md); margin-bottom: var(--sp-xl); }
  .avatar {
    width: 64px; height: 64px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .header-info { display: flex; flex-direction: column; gap: 2px; justify-content: center; }
  .name-row { display: flex; align-items: center; gap: var(--sp-sm); }
  .header-info h1 { font-size: var(--fs-heading); font-weight: 700; }
  .badge { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: var(--radius-pill); }
  .badge.guest { background: rgba(168,162,158,0.15); color: var(--text-dim); width: fit-content; }
  .badge.bot { background: rgba(168,85,247,0.15); color: var(--accent2); width: fit-content; }
  h1.bot { color: var(--accent2); }
  .since { font-size: var(--fs-caption); color: var(--text-dim); }

  .stats-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-sm);
    margin-bottom: var(--sp-xl);
  }
  .stat-card {
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md); padding: var(--sp-md);
    display: flex; flex-direction: column; align-items: center; gap: 2px;
  }
  .stat-value { font-size: 1.3rem; font-weight: 700; }
  .stat-value.win { color: var(--success); }
  .stat-value.loss { color: var(--accent); }
  .stat-label { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; }

  .section-heading { font-size: var(--fs-body); font-weight: 600; margin-bottom: var(--sp-sm); color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; }

  .activity-section { width: 100%; margin-bottom: var(--sp-xl); }
  .activity-grid {
    display: flex; gap: 2px; overflow-x: auto;
    padding: var(--sp-sm) 0;
    scrollbar-width: none;
  }
  .activity-grid::-webkit-scrollbar { display: none; }
  .activity-col { display: flex; flex-direction: column; gap: 2px; }
  .activity-cell {
    width: 10px; height: 10px; border-radius: 2px;
  }
  .activity-cell.future { visibility: hidden; }

  .game-list {
    display: flex; flex-direction: column; gap: 1px;
    background: var(--surface2); border-radius: var(--radius-md); overflow: hidden;
    margin-bottom: var(--sp-xl);
  }
  .game-row {
    display: flex; align-items: center; gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md); background: var(--surface);
    font-size: var(--fs-caption);
  }
  .game-row.win { border-left: 2px solid var(--success); }
  .game-row.loss { border-left: 2px solid var(--accent); }
  .game-result { font-weight: 700; width: 20px; text-align: center; }
  .game-row.win .game-result { color: var(--success); }
  .game-row.loss .game-result { color: var(--accent); }
  .game-opponent { flex: 1; font-weight: 500; }
  .game-mode { font-size: 0.6rem; color: var(--text-dim); }
  .game-date { font-size: 0.6rem; color: var(--text-dim); transition: opacity 0.15s; }
  .game-replay {
    display: none; color: var(--accent); text-decoration: none;
    flex-shrink: 0;
  }
  .game-row:hover .game-date { display: none; }
  .game-row:hover .game-replay { display: flex; }

  .no-games { color: var(--text-dim); font-size: var(--fs-body); text-align: center; padding: var(--sp-xl) 0; }

  .cta { text-align: center; }
  .play-link {
    display: inline-block; padding: var(--sp-sm) var(--sp-xl);
    background: linear-gradient(135deg, var(--accent), #dc2626);
    color: #fff; font-weight: 600; font-size: var(--fs-body);
    border-radius: var(--radius-md); text-decoration: none;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .play-link:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

  @media (max-width: 400px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
