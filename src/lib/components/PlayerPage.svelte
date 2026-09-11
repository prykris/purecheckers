<script>
  import GameEntryLink from './GameEntryLink.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import ShareActions from './ShareActions.svelte';
  import GameHistory from './GameHistory.svelte';

  let { data, embedded = false, allowChallenge = true } = $props();
  // svelte-ignore state_referenced_locally
  const { player, games, activity, indexable } = data;

  const siteUrl = 'https://purecheckers.com';
  const profileUrl = `${siteUrl}/player/${encodeURIComponent(player.username)}`;
  const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;

  const profileSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${profileUrl}#profile`,
    "url": profileUrl,
    "isPartOf": { "@id": `${siteUrl}/#website` },
    "dateCreated": player.createdAt,
    "mainEntity": {
      "@type": "Person",
      "name": player.username,
      "url": profileUrl,
      "identifier": player.username
    }
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${siteUrl}/` },
      { "@type": "ListItem", "position": 2, "name": player.username, "item": profileUrl }
    ]
  };

  // Build activity grid — 52 weeks x 7 days, starting from today going back
  function buildActivityGrid() {
    const grid = [];
    const today = new Date();
    const year = today.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const start = new Date(jan1);
    start.setDate(start.getDate() - start.getDay());

    let d = new Date(start);
    while (d <= dec31 || d.getDay() !== 0) {
      const col = [];
      for (let day = 0; day < 7; day++) {
        const key = d.toISOString().slice(0, 10);
        const count = activity[key] || 0;
        const inYear = d.getFullYear() === year;
        const future = d > today;
        col.push({ key, count, future, outOfRange: !inYear });
        d = new Date(d); d.setDate(d.getDate() + 1);
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


</script>

<svelte:head>
{#if !embedded}
  <title>{player.username} — Pure Checkers Player Profile</title>
  <meta name="description" content="{player.username} has played {player.gamesPlayed} games with an ELO of {player.elo} on Pure Checkers. Win rate: {winRate}%." />
  <link rel="canonical" href={profileUrl} />
  <meta property="og:title" content="{player.username} — Pure Checkers" />
  <meta property="og:description" content="ELO {player.elo} · {player.wins}W / {player.losses}L · {winRate}% win rate" />
  <meta property="og:url" content={profileUrl} />
  {#if !indexable}
    <meta name="robots" content="noindex,follow" />
  {/if}
{/if}
</svelte:head>

{#if !embedded}
<JsonLd data={profileSchema} />
<JsonLd data={breadcrumbSchema} />
{/if}

<section class="profile-page" class:embedded>
  {#if !embedded}
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <span aria-current="page">{player.username}</span>
  </nav>
  {/if}

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

  <div class="profile-sharing"><ShareActions surface="profile" url={profileUrl} data={player} label="Share profile" /></div>
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
              class:out={day.outOfRange}
              style="opacity: {day.outOfRange ? 0 : day.count === 0 ? 0.1 : 0.2 + 0.8 * (day.count / maxActivity)};
                     background: {day.count > 0 ? 'var(--success)' : day.future ? 'var(--surface2)' : 'var(--text-dim)'};"
              title="{day.outOfRange ? '' : `${day.key}: ${day.count} game${day.count !== 1 ? 's' : ''}`}"
            ></div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  {#if games.length > 0}
    <h2 class="section-heading">Recent Games</h2>
    <GameHistory {games} playerId={player.id} opponentsOnly replayTarget={embedded ? '_blank' : undefined} />
  {:else}
    <p class="no-games">No games played yet.</p>
  {/if}

  <div class="cta">
    {#if allowChallenge && !player.isBot && !player.isGuest}
      <a href="/challenge/{player.id}" class="play-link">Challenge {player.username}</a>
    {:else if !embedded}
      <GameEntryLink class="play-link" label="Play Now" />
    {/if}
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
  .profile-page.embedded { padding: var(--sp-lg) var(--sp-md); }

  .profile-header { display: flex; align-items: center; gap: var(--sp-md); margin-bottom: var(--sp-xl); }
  .avatar {
    width: 64px; height: 64px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .header-info { display: flex; flex-direction: column; gap: 2px; justify-content: center; min-width: 0; overflow-wrap: anywhere; }
  .name-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-sm); }
  .header-info h1 { font-size: var(--fs-heading); font-weight: 700; }
  .badge { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: var(--radius-pill); }
  .badge.guest { background: rgba(168,162,158,0.15); color: var(--text-dim); width: fit-content; }
  .badge.bot { background: rgba(168,85,247,0.15); color: var(--accent2); width: fit-content; }
  h1.bot { color: var(--accent2); }
  .since { font-size: var(--fs-caption); color: var(--text-dim); }

  .profile-sharing { margin-bottom: var(--sp-lg); }

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
  .activity-cell.out { visibility: hidden; }

  .no-games { color: var(--text-dim); font-size: var(--fs-body); text-align: center; padding: var(--sp-xl) 0; }

  .cta { text-align: center; }
  .cta :global(.play-link) {
    display: inline-block; padding: var(--sp-sm) var(--sp-xl);
    background: linear-gradient(135deg, var(--accent), #dc2626);
    color: #fff; font-weight: 600; font-size: var(--fs-body);
    border-radius: var(--radius-md); text-decoration: none;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .cta :global(.play-link):hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

  @media (max-width: 400px) {
    .profile-sharing { margin-bottom: var(--sp-lg); }

  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
