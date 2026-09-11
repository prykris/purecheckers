<script>
  import { presenceStats, matchmaking } from '$lib/stores/app.js';
  import { minimizeSession } from '$lib/stores/navigation.js';
  import { sendCommand, session } from '$lib/stores/session.js';
  import { botDifficulty, difficultyLabel } from '$lib/stores/ui.js';

  // Two states from the snapshot's `matchmaking.fallbackOpen`, republished by the server
  // at its deadline. No clock math here; the snapshot is the only source of truth.
  const fallbackOpen = $derived(!!$matchmaking?.fallbackOpen);
  // The viewer is in this count while searching; subtract self here only.
  const others = $derived(Math.max(0, ($presenceStats.searching || 0) - 1));
  const othersLine = $derived(others === 0 ? 'Nobody else is searching' : `${others} other${others === 1 ? '' : 's'} searching`);
  const canSend = $derived($session.status === 'ready' && !$session.pending);
  const startingBot = $derived($session.pending === 'bot:play');

  function cancel() { sendCommand('matchmaking:leave'); }
  function playBot() {
    if (!canSend) return;
    sendCommand('bot:play', { difficulty: $botDifficulty });
  }
</script>

<div class="page-center">
  <div class="search" role="status" aria-live="polite">
    {#if fallbackOpen}
      <h2 class="headline">{others ? 'No match yet' : "No one's searching right now"}</h2>
      <p class="queue-line"><span class="spinner-small"></span>Still in the queue. A match starts when a suitable opponent is found.</p>
      <button type="button" class="btn btn-primary bot-btn" onclick={playBot} disabled={!canSend}>
        {startingBot ? 'Starting…' : `Play a bot instead · ${difficultyLabel($botDifficulty)}`}
      </button>
    {:else}
      <div class="spinner"></div>
      <p class="headline-plain">Looking for an opponent…</p>
      <p class="count">{othersLine}</p>
    {/if}
    <div class="search-actions">
      <button type="button" class="btn btn-dark btn-small" onclick={() => minimizeSession()}>Minimize</button>
      <button type="button" class="btn btn-dark btn-small" onclick={cancel} disabled={!canSend}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .search { display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg); width: 100%; max-width: 320px; text-align: center; }
  .headline { font-size: var(--fs-heading); font-weight: 600; color: var(--text); }
  .headline-plain { color: var(--text-dim); font-size: var(--fs-body); }
  .count { font-size: var(--fs-caption); color: var(--text-dim); opacity: 0.8; margin-top: calc(-1 * var(--sp-sm)); }
  .queue-line { display: flex; align-items: flex-start; gap: var(--sp-sm); font-size: var(--fs-caption); color: var(--text-dim); text-align: left; line-height: 1.5; }
  .spinner-small { width: 14px; height: 14px; margin-top: 2px; border: 2px solid var(--surface2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .bot-btn { width: 100%; min-height: 52px; font-size: 1rem; }
  .search-actions { display: flex; gap: var(--sp-sm); }
  .search-actions .btn { min-height: 40px; }
  @media (prefers-reduced-motion: reduce) { .spinner-small { animation-duration: 2s; } }
</style>
