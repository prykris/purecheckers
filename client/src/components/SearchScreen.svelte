<script>
  import { onMount, onDestroy } from 'svelte';
  import { screen, gameState } from '../stores/app.js';
  import { getSocket } from '../lib/socket.js';

  let socket;

  onMount(() => {
    socket = getSocket();
    if (socket) socket.on('matchmaking:found', onFound);
  });

  onDestroy(() => {
    if (socket) socket.off('matchmaking:found', onFound);
  });

  function onFound(data) {
    $gameState = {
      gameId: data.gameId,
      myColor: data.yourColor,
      opponentName: data.opponent.username,
      opponentId: data.opponent.id,
      mode: 'online'
    };
    $screen = 'wheel';
  }

  function cancel() {
    getSocket()?.emit('matchmaking:leave');
    $screen = 'lobby';
  }
</script>

<div class="page-center">
  <div class="search">
    <div class="spinner"></div>
    <p>Looking for an opponent...</p>
    <button class="btn btn-dark btn-small" on:click={cancel}>Cancel</button>
  </div>
</div>

<style>
  .search { display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg); }
  p { color: var(--text-dim); font-size: var(--fs-body); }
</style>
