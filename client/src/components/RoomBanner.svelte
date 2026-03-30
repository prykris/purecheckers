<script>
  import { screen, activeRoom } from '../stores/app.js';

  function goToRoom() {
    $screen = 'room-waiting';
  }

  function leaveRoom() {
    // Will be handled by RoomWaiting's leave logic
    import('../lib/socket.js').then(({ getSocket }) => {
      getSocket()?.emit('room:leave', { roomId: $activeRoom?.id });
    });
    $activeRoom = null;
  }

  $: playerCount = $activeRoom?.players?.length || 0;
  $: hasOpponent = playerCount >= 2;
</script>

{#if $activeRoom && $screen !== 'room-waiting' && $screen !== 'game' && $screen !== 'wheel'}
  <div class="room-banner" class:has-opponent={hasOpponent}>
    <button class="banner-content" on:click={goToRoom}>
      <span class="banner-icon">
        {#if hasOpponent}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        {:else}
          <div class="mini-spinner"></div>
        {/if}
      </span>
      <span class="banner-text">
        {#if hasOpponent}
          Opponent joined! Tap to ready up
        {:else}
          Waiting for opponent... ({playerCount}/2)
        {/if}
      </span>
    </button>
    <button class="banner-close" on:click={leaveRoom} title="Leave room">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
{/if}

<style>
  .room-banner {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 45;
    display: flex;
    align-items: center;
    background: var(--surface);
    border-bottom: 1px solid var(--surface2);
    padding: var(--sp-xs) var(--sp-sm);
    padding-top: max(var(--sp-xs), env(safe-area-inset-top));
  }
  .room-banner.has-opponent {
    background: rgba(34, 197, 94, 0.15);
    border-bottom-color: var(--success);
  }
  .banner-content {
    flex: 1; display: flex; align-items: center; gap: var(--sp-sm);
    background: none; border: none; color: var(--text); cursor: pointer;
    font-family: var(--font); font-size: var(--fs-caption); font-weight: 500;
    text-align: left; padding: var(--sp-xs);
  }
  .banner-icon { display: flex; align-items: center; flex-shrink: 0; }
  .mini-spinner {
    width: 14px; height: 14px;
    border: 2px solid var(--surface2); border-top-color: var(--accent);
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .banner-close {
    background: none; border: none; color: var(--text-dim); cursor: pointer;
    padding: var(--sp-xs); flex-shrink: 0;
  }
  .banner-close:hover { color: var(--accent); }
</style>
