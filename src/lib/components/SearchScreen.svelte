<script>
  import { searching, presenceStats } from '$lib/stores/app.js';
  import { minimizeSession } from '$lib/stores/navigation.js';
  import { sendCommand } from '$lib/stores/session.js';

  $: others = $presenceStats.lookingToPlay - 1;

  function cancel() {
    sendCommand('matchmaking:leave');
  }

  function minimize() {
    minimizeSession();
  }
</script>

<div class="page-center">
  <div class="search">
    <div class="spinner"></div>
    <p>Looking for an opponent...</p>
    {#if others > 0}
      <p class="count">{others} other {others === 1 ? 'player' : 'players'} looking to play</p>
    {:else}
      <p class="count">No other players searching right now</p>
    {/if}
    <div class="search-actions">
      <button class="btn btn-dark btn-small" on:click={minimize}>Minimize</button>
      <button class="btn btn-dark btn-small" on:click={cancel}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .search { display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg); }
  p { color: var(--text-dim); font-size: var(--fs-body); }
  .count { font-size: var(--fs-caption); color: var(--text-dim); opacity: 0.7; margin-top: calc(-1 * var(--sp-sm)); }
  .search-actions { display: flex; gap: var(--sp-sm); }
</style>
