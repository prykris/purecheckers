<script>
  import RoomActivity from '../RoomActivity.svelte';
  import { phase } from '$lib/stores/app.js';
  import { openSession } from '$lib/stores/navigation.js';

  // While a search or a waiting room is minimized, every tab's action area becomes one
  // line and the one button the session can accept. No other command is offered.
  const searching = $derived($phase === 'matchmaking');
  const text = $derived(searching ? "You're searching for an opponent" : 'Your room is open');
  const label = $derived(searching ? 'Open search' : 'Open room');
</script>

{#if !searching}
  <RoomActivity/>
{:else}
<div class="session-line" role="status">
  <span class="session-text">{text}</span>
  <button type="button" class="btn btn-dark btn-small" onclick={() => openSession()}>{label}</button>
</div>
{/if}

<style>
  .session-line {
    width: 100%;
    display: flex; align-items: center; justify-content: space-between; gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface); border: 1px solid var(--surface2); border-radius: var(--radius-md);
  }
  .session-text { font-size: var(--fs-body); color: var(--text); }
  .btn-small { min-height: 40px; flex-shrink: 0; }
</style>
