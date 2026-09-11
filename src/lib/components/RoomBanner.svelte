<script>
  import PlayerLink from './PlayerLink.svelte';
  import { activeRoom } from '$lib/stores/app.js';
  import { gameScreen, openSession } from '$lib/stores/navigation.js';
  import { sendCommand, session } from '$lib/stores/session.js';
  import { user } from '$lib/stores/user.js';

  // The pill stays until departure is acknowledged: the leaving flag derives from the
  // command lifecycle, never from a local guess. Participants are identified by user id.
  const room = $derived($activeRoom);
  const leaving = $derived($session.pending === 'room:leave');
  const updating = $derived(room?.status === 'updating');
  const show = $derived(!!room && $gameScreen === 'none');
  const isHost = $derived(!!room && room.hostId === $user?.id);
  const opponent = $derived(room?.players?.find(p => p.userId !== $user?.id) || null);
  const hasOpponent = $derived(!!opponent);
  const allReady = $derived(!updating && hasOpponent && (room.settings?.autoReady || room.players.every(p => p.ready)));
  const dotClass = $derived(allReady ? 'ready' : hasOpponent ? 'joined' : 'waiting');
  const label = $derived(updating ? 'Confirming room change…' : allReady ? 'Ready!'
    : hasOpponent ? (opponent.online === false ? 'Player away' : 'Player joined')
    : isHost ? 'Waiting for a friend' : 'Waiting…');

  function leaveRoom(e) {
    e.stopPropagation();
    if (leaving) return;
    sendCommand('room:leave', { roomId: room?.id });
  }
</script>

{#if show}
  <div class="room-pill" class:joined={hasOpponent} class:ready={allReady} role="group" aria-label="Your room">
    <button type="button" class="pill-main" onclick={() => openSession()}>
      <span class="dot {dotClass}"></span>
      <span class="pill-text">{label}</span>
    </button>
    {#if opponent}<span class="pill-text"><PlayerLink username={opponent.username} /></span>{/if}
    <button type="button" class="pill-close" onclick={leaveRoom} disabled={leaving || updating} aria-busy={leaving || updating}>
      Leave
    </button>
  </div>
{/if}

<style>
  .room-pill {
    position: fixed; z-index: 48;
    display: flex; align-items: center; gap: var(--sp-xs);
    padding: 0 var(--sp-xs) 0 0;
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-pill);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    font-family: var(--font); color: var(--text);
    bottom: calc(var(--tab-height) + var(--sp-sm) + env(safe-area-inset-bottom, 0px));
    left: 50%; transform: translateX(-50%);
  }
  .room-pill.joined { border-color: var(--success); }
  .room-pill.ready { border-color: var(--success); animation: pill-pulse 1.5s ease-in-out infinite; }
  @keyframes pill-pulse { 0%,100%{ box-shadow: 0 4px 20px rgba(0,0,0,0.3); } 50%{ box-shadow: 0 4px 20px rgba(34,197,94,0.3); } }

  .pill-main {
    display: flex; align-items: center; gap: var(--sp-sm);
    min-height: 44px; padding: 0 var(--sp-sm) 0 var(--sp-md);
    background: none; border: none; color: var(--text); font-family: var(--font); cursor: pointer;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .dot.waiting { background: var(--text-dim); animation: dot-blink 1.5s ease-in-out infinite; }
  .dot.joined { background: var(--success); }
  .dot.ready { background: var(--success); animation: dot-blink 0.6s ease-in-out infinite; }
  @keyframes dot-blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }

  .pill-text { font-size: var(--fs-caption); font-weight: 600; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
  .pill-close {
    min-height: 36px; padding: 0 var(--sp-sm);
    background: none; border: none; border-left: 1px solid var(--surface2);
    color: var(--text-dim); font-family: var(--font); font-size: var(--fs-caption); font-weight: 600;
    cursor: pointer; border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
  }
  .pill-close:hover { color: var(--accent); }
  .pill-close:disabled { opacity: 0.5; cursor: default; }

  @media (min-width: 900px) {
    .room-pill { bottom: auto; top: var(--sp-md); left: auto; right: var(--sp-md); transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .room-pill.ready, .dot.waiting, .dot.ready { animation: none; }
  }
</style>
