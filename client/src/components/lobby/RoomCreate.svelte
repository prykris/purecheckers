<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { screen, gameState } from '../../stores/app.js';
  import { getSocket } from '../../lib/socket.js';

  const dispatch = createEventDispatcher();

  let buyIn = 0;
  let turnTimer = 60;
  let isPrivate = false;
  let allowSpectators = true;
  let error = '';
  let socket;

  onMount(() => {
    socket = getSocket();
    if (socket) {
      socket.on('room:created', onCreated);
      socket.on('room:error', onError);
    }
  });

  onDestroy(() => {
    if (socket) {
      socket.off('room:created', onCreated);
      socket.off('room:error', onError);
    }
  });

  function onCreated({ room }) {
    $gameState = { roomId: room.id, mode: 'room', roomCode: room.settings.code };
    $screen = 'room-waiting';
    dispatch('close');
  }

  function onError({ error: e }) { error = e; }

  function create() {
    error = '';
    socket?.emit('room:create', { buyIn, turnTimer, isPrivate, allowSpectators });
  }
</script>

<div class="overlay" on:click|self={() => dispatch('close')}>
  <div class="card modal">
    <h3>Create Room</h3>

    <label class="field">
      <span>Buy-in (coins)</span>
      <input class="input" type="number" min="0" bind:value={buyIn} />
    </label>

    <label class="field">
      <span>Turn timer</span>
      <div class="radio-row">
        {#each [30, 60, 90, 0] as t}
          <button class="chip" class:active={turnTimer === t} on:click={() => turnTimer = t}>
            {t === 0 ? 'None' : `${t}s`}
          </button>
        {/each}
      </div>
    </label>

    <label class="field toggle-field">
      <span>Private room</span>
      <input type="checkbox" bind:checked={isPrivate} />
    </label>

    <label class="field toggle-field">
      <span>Allow spectators</span>
      <input type="checkbox" bind:checked={allowSpectators} />
    </label>

    {#if error}<p class="error">{error}</p>{/if}

    <button class="btn btn-primary" on:click={create}>Create Room</button>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center;
    z-index: 80; padding: var(--sp-md);
  }
  .modal {
    width: 100%; max-width: 360px;
    display: flex; flex-direction: column; gap: var(--sp-md);
    padding: var(--sp-lg);
  }
  h3 { font-size: var(--fs-heading); text-align: center; }
  .field { display: flex; flex-direction: column; gap: var(--sp-xs); }
  .field span { font-size: var(--fs-caption); color: var(--text-dim); font-weight: 500; }
  .toggle-field { flex-direction: row; align-items: center; justify-content: space-between; }
  .toggle-field input { width: 20px; height: 20px; accent-color: var(--accent); }
  .radio-row { display: flex; gap: var(--sp-xs); }
  .chip {
    padding: var(--sp-xs) var(--sp-md); border-radius: var(--radius-pill);
    background: var(--surface2); border: none; color: var(--text-dim);
    font-size: var(--fs-caption); font-family: var(--font); cursor: pointer;
  }
  .chip.active { background: var(--accent); color: #fff; }
  .error { color: var(--accent); font-size: var(--fs-caption); text-align: center; }
</style>
