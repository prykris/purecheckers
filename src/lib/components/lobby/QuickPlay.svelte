<script>
  import { locale } from '$lib/stores/locale.js';
  import { siteText } from '$lib/siteCopy.js';
  import { phase, presenceStats } from '$lib/stores/app.js';
  import { session, sendCommand } from '$lib/stores/session.js';
  import { NEARBY_ROOM } from '$lib/stores/ui.js';
  import GameLog from '../GameLog.svelte';
  import SessionLine from './SessionLine.svelte';
  let { onplaybot } = $props();

  // Two labelled buttons in a fixed order. Only the colour follows the live count:
  // Play with a friend is red when nobody is searching, Find Opponent otherwise.

  const idle = $derived($phase === 'idle');
  const canSend = $derived($session.status === 'ready' && !$session.pending);
  const others = $derived(Math.max(0, ($presenceStats.humansOnline || 0) - 1));
  const searchingCount = $derived($presenceStats.searching || 0);
  const nearbyPrimary = $derived(searchingCount === 0);
  const presenceLine = $derived(others <= 0
    ? 'Nobody else is online right now'
    : `${others} online · ${searchingCount === 0 ? 'nobody searching' : `${searchingCount} searching`}`);

  function findOpponent() {
    if (!canSend) return;
    sendCommand('matchmaking:join');
  }
  function playNearby() {
    if (!canSend) return;
    sendCommand('room:create', { ...NEARBY_ROOM });
  }
</script>

<div class="quick">

  {#if idle}
    <div class="door">
      <button type="button" class="btn play-btn" class:btn-primary={!nearbyPrimary} class:btn-dark={nearbyPrimary}
        onclick={findOpponent} disabled={!canSend}>
        {$session.pending === 'matchmaking:join' ? 'Starting search…' : siteText('Find Opponent', $locale)}
      </button>
      <p class="caption">{presenceLine}</p>
    </div>

    <div class="door">
      <button type="button" class="btn play-btn" class:btn-primary={nearbyPrimary} class:btn-dark={!nearbyPrimary}
        onclick={playNearby} disabled={!canSend}>
        {$session.pending === 'room:create' ? 'Opening your room…' : siteText('Play with a friend', $locale)}
      </button>
      <p class="caption">They scan your screen, or you send a link. No account needed.</p>
    </div>
  {:else}
    <SessionLine />
  {/if}
</div>

<GameLog {onplaybot} />

<style>
  .quick { display: flex; flex-direction: column; align-items: stretch; gap: var(--sp-md); padding: var(--sp-sm) 0 var(--sp-lg); width: 100%; flex-shrink: 0; }
  .door { display: flex; flex-direction: column; gap: var(--sp-xs); }
  .play-btn { width: 100%; min-height: 52px; font-size: 1rem; }
  .caption { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; line-height: 1.4; }
</style>
