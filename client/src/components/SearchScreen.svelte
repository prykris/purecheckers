<script>
  import { screen } from '../stores/app.js';
  import { getSocket } from '../lib/socket.js';

  function cancel() {
    getSocket()?.emit('matchmaking:leave');
    $screen = 'lobby';
  }
</script>

<div class="search">
  <div class="spinner"></div>
  <p>Looking for an opponent...</p>
  <button class="btn btn-dark btn-small" on:click={cancel}>Cancel</button>
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }
  p { color: var(--text-dim); }
  .spinner {
    width: 48px; height: 48px;
    border: 4px solid var(--surface2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
