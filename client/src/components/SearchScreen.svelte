<script>
  import { screen } from '../stores/app.js';
  import { getSocket } from '../lib/socket.js';

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
