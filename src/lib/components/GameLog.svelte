<script>
  import GameHistory from './GameHistory.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { getSocket } from '$lib/socket.js';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { GameLogFeed } from '$lib/gameLogFeed.js';
  import { browseTo, openReplay } from '$lib/stores/navigation.js';
  import { api } from '$lib/api.js';

  // Recent games. `global:game-ended` carries the database replay id (the broadcast is
  // skipped when persistence failed), bot games stay visible and are tagged, and a
  // tombstoned guest reads "Guest" instead of its expiry marker.
  let { mode = 'global', onplaybot = null } = $props(); // 'global' | 'personal'

  let log = $state({ data: null, status: 'idle', error: null });
  let showMineOnly = $state(false);
  let unsubscribe;
  const personal = $derived(mode === 'personal' || showMineOnly);
  const games = $derived(log.data || []);
  const feed = new GameLogFeed({ request: api.get, isCurrent: isCurrentSession, publish: value => log = value });
  $effect(() => { feed.setQuery(personal, { id: $user?.id, ...captureSession() }); });

  onMount(() => {
    unsubscribe = user.subscribe(value => feed.setQuery(personal, { id: value?.id, ...captureSession() }));
    feed.start(getSocket());
  });
  onDestroy(() => { unsubscribe?.(); feed.dispose(); });
</script>

<div class="game-log">
  <div class="log-header">
    <h3 class="log-title">{mode === 'personal' ? 'Your Games' : 'Recent Games'}</h3>
    {#if mode === 'global'}
      <button type="button" class="filter-toggle" class:active={showMineOnly} aria-pressed={showMineOnly} onclick={() => showMineOnly = !showMineOnly}>
        {showMineOnly ? 'Show all' : 'My games'}
      </button>
    {/if}
  </div>

  {#if log.status === 'error' && log.data !== null}
    <div class="log-placeholder" role="status"><span>Could not refresh recent games.</span><button type="button" class="play-link" onclick={() => feed.refresh()}>Retry</button></div>
  {/if}
  {#if log.data === null && (log.status === 'idle' || log.status === 'loading')}
    <div class="log-placeholder" role="status">
      <div class="spinner-small"></div>
      <span>Loading games…</span>
    </div>
  {:else if log.status === 'error' && log.data === null}
    <div class="log-placeholder" role="status">
      <span>{log.error}</span>
      <button type="button" class="play-link" onclick={() => feed.refresh()}>Retry</button>
    </div>
  {:else if games.length === 0}
    <div class="log-placeholder">
      {#if mode === 'personal' || showMineOnly}
        <span>You haven't played any games yet.</span>
      {:else}
        <span>No games yet. Yours will be the first.</span>
      {/if}
      <button type="button" class="play-link" onclick={() => onplaybot ? onplaybot() : browseTo('lobby')}>{onplaybot ? 'Play a bot' : 'Go to Play'}</button>
    </div>
  {:else}
    <GameHistory {games} playerId={$user?.id} opponentsOnly={personal} scrollable onreplay={openReplay} />
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
    min-height: 28px; padding: 2px 8px; border-radius: var(--radius-pill); cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .filter-toggle:hover { color: var(--text); border-color: var(--text-dim); }
  .filter-toggle.active { color: var(--accent); border-color: var(--accent); }

  .log-placeholder {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-sm); padding: var(--sp-lg);
    min-height: 96px;
    color: var(--text-dim); font-size: var(--fs-caption); text-align: center;
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md);
  }
  .play-link {
    background: none; border: none; font-family: var(--font);
    color: var(--accent); font-size: var(--fs-caption); text-decoration: underline;
    cursor: pointer; min-height: 32px;
  }
  .play-link:hover { color: var(--text); }

  .spinner-small {
    width: 16px; height: 16px;
    border: 2px solid var(--surface2); border-top-color: var(--accent);
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) { .spinner-small { animation-duration: 2s; } .filter-toggle { transition: none; } }
</style>
