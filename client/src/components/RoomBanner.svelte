<script>
  import { screen, activeRoom, roomChatMessages, roomUnreadChat } from '../stores/app.js';
  import { getSocket } from '../lib/socket.js';

  function goToRoom() { $screen = 'room-waiting'; }

  function leaveRoom(e) {
    e.stopPropagation();
    getSocket()?.emit('room:leave', { roomId: $activeRoom?.id });
    $activeRoom = null;
    $roomChatMessages = [];
    $roomUnreadChat = 0;
  }

  $: playerCount = $activeRoom?.players?.length || 0;
  $: hasOpponent = playerCount >= 2;
  $: allReady = hasOpponent && $activeRoom?.players?.every(p => p.ready);
  $: opponentName = $activeRoom?.players?.[1]?.username || '';
  $: opponentOnline = $activeRoom?.players?.[1]?.online !== false;

  $: dotClass = allReady ? 'ready' : hasOpponent ? 'joined' : 'waiting';
  $: label = allReady ? 'Ready!' : hasOpponent ? (opponentOnline ? opponentName : `${opponentName} (away)`) : 'Waiting...';
  $: show = $activeRoom && $screen !== 'room-waiting' && $screen !== 'game' && $screen !== 'wheel' && $screen !== 'auth';
</script>

{#if show}
  <div class="room-pill" class:joined={hasOpponent} class:ready={allReady} on:click={goToRoom} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && goToRoom()}>
    <span class="dot {dotClass}"></span>
    <span class="pill-text">{label}</span>
    <span class="pill-close" on:click={leaveRoom} role="button" tabindex="0" title="Leave room">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </span>
  </div>
{/if}

<style>
  .room-pill {
    position: fixed; z-index: 48;
    display: flex; align-items: center; gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-pill);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    cursor: pointer; font-family: var(--font); color: var(--text);
    transition: transform 0.15s, box-shadow 0.15s;
    bottom: calc(var(--tab-height) + var(--sp-sm) + env(safe-area-inset-bottom, 0px));
    left: 50%; transform: translateX(-50%);
  }
  .room-pill:hover { transform: translateX(-50%) translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.4); }
  .room-pill:active { transform: translateX(-50%) translateY(0); }
  .room-pill.joined { border-color: var(--success); }
  .room-pill.ready { border-color: var(--success); animation: pill-pulse 1.5s ease-in-out infinite; }
  @keyframes pill-pulse { 0%,100%{ box-shadow: 0 4px 20px rgba(0,0,0,0.3); } 50%{ box-shadow: 0 4px 20px rgba(34,197,94,0.3); } }

  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .dot.waiting { background: var(--text-dim); animation: dot-blink 1.5s ease-in-out infinite; }
  .dot.joined { background: var(--success); }
  .dot.ready { background: var(--success); animation: dot-blink 0.6s ease-in-out infinite; }
  @keyframes dot-blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }

  .pill-text { font-size: var(--fs-caption); font-weight: 600; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
  .pill-close {
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; color: var(--text-dim);
    cursor: pointer; padding: 2px; margin-left: var(--sp-xs); border-radius: 50%;
  }
  .pill-close:hover { color: var(--accent); }

  @media (min-width: 900px) {
    .room-pill { bottom: auto; top: var(--sp-md); left: auto; right: var(--sp-md); transform: none; }
    .room-pill:hover { transform: translateY(-2px); }
    .room-pill:active { transform: translateY(0); }
  }
</style>
