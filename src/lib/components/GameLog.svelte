<script>
  import { onMount, onDestroy } from 'svelte';
  import { getSocket } from '$lib/socket.js';
  import { user } from '$lib/stores/user.js';
  import { browseTab } from '$lib/stores/app.js';
  import { api } from '$lib/api.js';

  export let mode = 'global'; // 'global' | 'personal'

  let allGames = [];
  let loading = true;
  let socket;
  let showMineOnly = false;

  $: games = (mode === 'personal' || showMineOnly)
    ? allGames.filter(g => g.redPlayer === $user?.username || g.blackPlayer === $user?.username)
    : allGames;

  function fmtAgo(d) {
    const ms = Date.now() - new Date(d).getTime();
    if (ms < 60000) return 'just now';
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function resultFor(g) {
    if (!$user) return '';
    const isRed = g.redPlayer === $user.username;
    const isBlack = g.blackPlayer === $user.username;
    if (!isRed && !isBlack) return '';
    if (g.result === 'DRAW') return 'draw';
    if (isRed && g.result === 'RED_WIN') return 'win';
    if (isBlack && g.result === 'BLACK_WIN') return 'win';
    return 'loss';
  }

  function onGameEnded(game) {
    allGames = [game, ...allGames].slice(0, 50);
  }

  function goToQuickPlay() {
    $browseTab = 'lobby';
  }

  onMount(async () => {
    try {
      const data = await api.get('/leaderboard/games');
      allGames = data.games || [];
    } catch {}
    loading = false;

    if (mode === 'global') {
      socket = getSocket();
      if (socket) socket.on('global:game-ended', onGameEnded);
    }
  });

  onDestroy(() => {
    if (socket) socket.off('global:game-ended', onGameEnded);
  });
</script>

<div class="game-log">
  <div class="log-header">
    <h3 class="log-title">{mode === 'personal' ? 'Your Games' : 'Recent Games'}</h3>
    {#if mode === 'global'}
      <button class="filter-toggle" class:active={showMineOnly} on:click={() => showMineOnly = !showMineOnly}>
        {showMineOnly ? 'Show all' : 'My games'}
      </button>
    {/if}
  </div>

  {#if loading}
    <div class="log-placeholder">
      <div class="spinner-small"></div>
    </div>
  {:else if games.length === 0}
    <div class="log-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      {#if mode === 'personal'}
        <span>You haven't played any games yet</span>
        <!-- svelte-ignore a11y_invalid_attribute -->
        <a href="#" class="play-link" on:click|preventDefault={goToQuickPlay}>Find an opponent</a>
      {:else if showMineOnly}
        <span>You haven't played any games yet</span>
      {:else}
        <span>No games played yet</span>
      {/if}
    </div>
  {:else}
    <div class="log-list">
      {#each games as g}
        {@const myResult = resultFor(g)}
        <div class="log-row" class:my-win={myResult === 'win'} class:my-loss={myResult === 'loss'}>
          <div class="log-players">
            <span class="log-name" class:winner={g.result === 'RED_WIN'}>{g.redPlayer}</span>
            <span class="log-vs">vs</span>
            <span class="log-name" class:winner={g.result === 'BLACK_WIN'}>{g.blackPlayer}</span>
          </div>
          <div class="log-meta">
            <span class="log-mode {g.mode === 'RANKED' ? 'ranked' : 'friendly'}">{g.mode === 'RANKED' ? 'Ranked' : 'Friendly'}</span>
            <span class="log-time">{fmtAgo(g.date)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .game-log {
    width: 100%;
    display: flex; flex-direction: column; gap: var(--sp-sm);
    min-height: 0; flex: 1;
  }
  .log-header {
    display: flex; justify-content: space-between; align-items: center;
  }
  .log-title {
    font-size: var(--fs-caption); font-weight: 600;
    color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;
  }
  .filter-toggle {
    background: none; border: 1px solid var(--surface2); color: var(--text-dim);
    font-family: var(--font); font-size: 0.6rem; font-weight: 600;
    padding: 2px 8px; border-radius: var(--radius-pill); cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .filter-toggle:hover { color: var(--text); border-color: var(--text-dim); }
  .filter-toggle.active { color: var(--accent); border-color: var(--accent); }

  .log-placeholder {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-sm); padding: var(--sp-xl);
    min-height: 160px;
    color: var(--text-dim); font-size: var(--fs-caption);
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md);
  }
  .play-link {
    color: var(--accent); font-size: var(--fs-caption); text-decoration: underline;
    cursor: pointer;
  }
  .play-link:hover { color: var(--text); }

  .spinner-small {
    width: 16px; height: 16px;
    border: 2px solid var(--surface2); border-top-color: var(--accent);
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  .log-list {
    display: flex; flex-direction: column; gap: 1px;
    background: var(--surface2); border-radius: var(--radius-md);
    overflow-y: auto; overflow-x: hidden;
    flex: 1; min-height: 0;
    scrollbar-width: thin; scrollbar-color: var(--surface2) transparent;
  }
  .log-list::-webkit-scrollbar { width: 4px; }
  .log-list::-webkit-scrollbar-track { background: transparent; }
  .log-list::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 2px; }
  .log-list::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }
  .log-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
  }
  .log-row.my-win { border-left: 2px solid var(--success); }
  .log-row.my-loss { border-left: 2px solid var(--accent); }
  .log-players {
    display: flex; align-items: center; gap: var(--sp-xs);
    font-size: var(--fs-caption); font-weight: 500;
  }
  .log-name { color: var(--text-dim); }
  .log-name.winner { color: var(--text); font-weight: 700; }
  .log-vs { color: var(--text-dim); font-size: 0.6rem; opacity: 0.5; }
  .log-meta {
    display: flex; align-items: center; gap: var(--sp-sm);
    font-size: 0.6rem;
  }
  .log-mode {
    padding: 1px 6px; border-radius: var(--radius-pill); font-weight: 600;
  }
  .log-mode.ranked { color: var(--success); background: rgba(34,197,94,0.1); }
  .log-mode.friendly { color: var(--text-dim); background: var(--surface2); }
  .log-time { color: var(--text-dim); }
</style>
