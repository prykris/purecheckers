<script>
  import ReplayBoard from '$lib/components/ReplayBoard.svelte';

  let { data } = $props();
  // svelte-ignore state_referenced_locally
  const g = data.game;
  const winner = g.result === 'RED_WIN' ? g.redPlayer : g.result === 'BLACK_WIN' ? g.blackPlayer : null;
  const resultText = winner ? `${winner} wins` : 'Draw';
  const fmtDate = new Date(g.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
</script>

<svelte:head>
  <title>{g.redPlayer} vs {g.blackPlayer} — Game Replay — Pure Checkers</title>
  <meta name="description" content="Watch the checkers game between {g.redPlayer} and {g.blackPlayer}. {resultText}. {(g.moveHistory||[]).length} moves played." />
  <link rel="canonical" href="https://purecheckers.com/game/{g.id}" />
  <meta property="og:title" content="{g.redPlayer} vs {g.blackPlayer} — Checkers Replay" />
  <meta property="og:description" content="{resultText} · {(g.moveHistory||[]).length} moves · {g.mode}" />
  <meta property="og:url" content="https://purecheckers.com/game/{g.id}" />
</svelte:head>

<section class="replay-page">
  <nav class="breadcrumb">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <span>Game #{g.id}</span>
  </nav>

  <div class="meta">
    <span class="mode">{g.mode === 'RANKED' ? 'Ranked' : 'Friendly'}</span>
    <span class="date">{fmtDate}</span>
  </div>

  <ReplayBoard gameData={g} />

  <div class="players">
    <a href="/player/{g.redPlayer}" class="player-link">
      <span class="dot red"></span> {g.redPlayer}
    </a>
    <a href="/player/{g.blackPlayer}" class="player-link">
      <span class="dot black"></span> {g.blackPlayer}
    </a>
  </div>
</section>

<style>
  .breadcrumb { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-caption); }
  .breadcrumb a { color: var(--text-dim); text-decoration: none; }
  .breadcrumb a:hover { color: var(--accent); }
  .breadcrumb .sep { color: var(--text-dim); opacity: 0.4; }
  .breadcrumb span:last-child { color: var(--text); font-weight: 500; }

  .replay-page {
    max-width: 500px; margin: 0 auto;
    padding: 48px var(--sp-md) 120px;
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg);
  }

  .meta { display: flex; gap: var(--sp-sm); align-items: center; font-size: var(--fs-caption); }
  .mode { color: var(--text-dim); padding: 1px 6px; background: var(--surface2); border-radius: var(--radius-pill); }
  .date { color: var(--text-dim); }

  .players { display: flex; gap: var(--sp-lg); }
  .player-link { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-body); font-weight: 500; color: var(--text-dim); text-decoration: none; transition: color 0.15s; }
  .player-link:hover { color: var(--text); }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot.red { background: var(--accent); }
  .dot.black { background: var(--text-dim); }
</style>
