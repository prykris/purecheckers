<script>
  import { onMount, onDestroy } from 'svelte';
  import { screen, activeRoom, gameState } from '../stores/app.js';
  import { getSocket } from '../lib/socket.js';

  let socket;

  onMount(() => {
    socket = getSocket();
    if (socket) {
      socket.on('room:updated', onRoomUpdate);
    }
  });

  onDestroy(() => {
    if (socket) socket.off('room:updated', onRoomUpdate);
  });

  function onRoomUpdate({ room, closed }) {
    if (closed && $activeRoom?.id === room?.id) {
      $activeRoom = null;
      return;
    }
    if (room && $activeRoom && room.id === $activeRoom.id) {
      $activeRoom = room;
    }
  }

  function goToRoom() {
    $screen = 'room-waiting';
  }

  function leaveRoom() {
    socket?.emit('room:leave', { roomId: $activeRoom?.id });
    $activeRoom = null;
  }

  $: playerCount = $activeRoom?.players?.length || 0;
  $: hasOpponent = playerCount >= 2;
  $: allReady = hasOpponent && $activeRoom?.players?.every(p => p.ready);
  $: opponentOnline = $activeRoom?.players?.[1]?.online !== false;
</script>

{#if $activeRoom && $screen !== 'room-waiting' && $screen !== 'game' && $screen !== 'wheel' && $screen !== 'auth'}
  <div class="room-banner" class:has-opponent={hasOpponent} class:all-ready={allReady}>
    <button class="banner-content" on:click={goToRoom}>
      <span class="banner-icon">
        {#if allReady}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
        {:else if hasOpponent}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        {:else}
          <div class="mini-spinner"></div>
        {/if}
      </span>
      <span class="banner-text">
        {#if allReady}
          Both ready! Tap to start
        {:else if hasOpponent}
          {$activeRoom.players[1].username} joined{opponentOnline ? '' : ' (away)'} — tap to ready up
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
    border-bottom: 2px solid var(--surface2);
    padding: var(--sp-xs) var(--sp-sm);
    padding-top: max(var(--sp-xs), env(safe-area-inset-top));
  }
  .room-banner.has-opponent {
    background: rgba(34, 197, 94, 0.1);
    border-bottom-color: var(--success);
  }
  .room-banner.all-ready {
    background: rgba(34, 197, 94, 0.2);
    animation: pulse-bg 1s ease-in-out infinite;
  }
  @keyframes pulse-bg { 0%,100%{opacity:1;} 50%{opacity:0.7;} }

  .banner-content {
    flex: 1; display: flex; align-items: center; gap: var(--sp-sm);
    background: none; border: none; color: var(--text); cursor: pointer;
    font-family: var(--font); font-size: var(--fs-caption); font-weight: 500;
    text-align: left; padding: var(--sp-xs);
  }
  .banner-icon { display: flex; align-items: center; flex-shrink: 0; color: var(--success); }
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
