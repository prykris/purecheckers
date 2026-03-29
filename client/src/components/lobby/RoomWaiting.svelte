<script>
  import { onMount, onDestroy } from 'svelte';
  import { screen, gameState } from '../../stores/app.js';
  import { user } from '../../stores/user.js';
  import { getSocket } from '../../lib/socket.js';

  // Initialize from gameState if available (host gets roomData from create)
  let room = $gameState?.roomData || null;
  let socket;
  let myReady = false;

  onMount(() => {
    socket = getSocket();
    if (!socket) return;
    socket.on('room:updated', onUpdate);
    socket.on('room:kicked', onKicked);
    socket.on('matchmaking:found', onGameStart);

    // Sync ready state from initial data
    if (room) {
      const me = room.players?.find(p => p.userId === $user?.id);
      if (me) myReady = me.ready;
    }
  });

  onDestroy(() => {
    if (socket) {
      socket.off('room:updated', onUpdate);
      socket.off('room:kicked', onKicked);
      socket.off('matchmaking:found', onGameStart);
    }
  });

  function onUpdate({ room: r, closed }) {
    if (closed) { $screen = 'lobby'; return; }
    if (r.id === $gameState?.roomId) {
      room = r;
      const me = room?.players?.find(p => p.userId === $user?.id);
      if (me) myReady = me.ready;
    }
  }

  function onKicked() { $screen = 'lobby'; }

  function onGameStart(data) {
    $gameState = { gameId: data.gameId, myColor: data.yourColor, opponentName: data.opponent.username, opponentId: data.opponent.id, mode: 'online' };
    $screen = 'wheel';
  }

  function toggleReady() {
    socket?.emit('room:ready', { roomId: $gameState?.roomId });
  }

  function leave() {
    socket?.emit('room:leave', { roomId: $gameState?.roomId });
    $screen = 'lobby';
  }

  function kick(userId) {
    socket?.emit('room:kick', { roomId: $gameState?.roomId, userId });
  }

  $: isHost = room?.hostId === $user?.id;
  $: code = $gameState?.roomCode;
</script>

<div class="page-center">
  <div class="waiting">
    <h2>Game Room</h2>

    {#if room}
      <div class="settings-row">
        {#if room.settings.buyIn > 0}
          <span class="tag gold">Buy-in: {room.settings.buyIn}c</span>
        {:else}
          <span class="tag green">Free</span>
        {/if}
        <span class="tag">Timer: {room.settings.turnTimer}s</span>
        {#if room.settings.allowSpectators}<span class="tag">Spectators OK</span>{/if}
      </div>

      {#if code}
        <div class="code-section">
          <span class="code-label">Room Code</span>
          <span class="code">{code}</span>
          <p class="code-hint">Share this with your friend to join</p>
        </div>
      {/if}

      <div class="slots">
        {#each [0, 1] as i}
          <div class="card slot" class:filled={room.players[i]} class:ready={room.players[i]?.ready}>
            {#if room.players[i]}
              <div class="player-row">
                <span class="pname">{room.players[i].username}</span>
                <span class="pelo">ELO {room.players[i].elo}</span>
                {#if room.players[i].ready}
                  <span class="ready-badge">Ready</span>
                {:else}
                  <span class="not-ready">Not ready</span>
                {/if}
                {#if isHost && room.players[i].userId !== $user?.id}
                  <button class="kick-btn" on:click={() => kick(room.players[i].userId)} title="Kick">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                {/if}
              </div>
            {:else}
              <div class="empty-slot">
                <div class="spinner-small"></div>
                <span>Waiting for opponent...</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if room.spectators?.length > 0}
        <p class="spectators">Spectators: {room.spectators.map(s => s.username).join(', ')}</p>
      {/if}

      <div class="actions">
        {#if room.players.length === 2}
          <button class="btn" class:btn-primary={!myReady} class:btn-secondary={myReady} on:click={toggleReady}>
            {myReady ? 'Unready' : 'Ready Up'}
          </button>
        {/if}
        <button class="btn btn-dark btn-small" on:click={leave}>Leave</button>
      </div>

      {#if room.players.length < 2}
        <p class="waiting-hint">Share the room code or wait for someone to join from the room list</p>
      {:else if !room.players.every(p => p.ready)}
        <p class="waiting-hint">Both players must ready up to start</p>
      {/if}
    {:else}
      <div class="spinner"></div>
      <p class="dim">Loading room...</p>
    {/if}
  </div>
</div>

<style>
  .waiting { display: flex; flex-direction: column; align-items: center; gap: var(--sp-md); max-width: 400px; width: 100%; }
  h2 { font-size: var(--fs-heading); }

  .settings-row { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; }
  .tag { font-size: var(--fs-caption); padding: 2px var(--sp-sm); border-radius: var(--radius-pill); background: var(--surface2); color: var(--text-dim); }
  .gold { color: var(--gold); background: rgba(251,191,36,0.1); }
  .green { color: var(--success); background: rgba(34,197,94,0.1); }

  .code-section { display: flex; flex-direction: column; align-items: center; gap: var(--sp-xs); padding: var(--sp-md) 0; }
  .code-label { font-size: var(--fs-caption); color: var(--text-dim); text-transform: uppercase; letter-spacing: 2px; }
  .code { font-size: 2rem; font-weight: 700; letter-spacing: 6px; color: var(--accent); font-family: var(--font-mono); }
  .code-hint { font-size: var(--fs-caption); color: var(--text-dim); }

  .slots { display: flex; flex-direction: column; gap: var(--sp-sm); width: 100%; }
  .slot { padding: var(--sp-md); min-height: 60px; display: flex; align-items: center; }
  .slot.ready { border-color: var(--success); }
  .player-row { display: flex; align-items: center; gap: var(--sp-sm); width: 100%; }
  .pname { font-weight: 600; font-size: var(--fs-body); }
  .pelo { font-size: var(--fs-caption); color: var(--text-dim); }
  .ready-badge { font-size: 0.65rem; color: var(--success); font-weight: 700; text-transform: uppercase; margin-left: auto; }
  .not-ready { font-size: 0.65rem; color: var(--text-dim); margin-left: auto; }
  .empty-slot { display: flex; align-items: center; gap: var(--sp-sm); color: var(--text-dim); font-size: var(--fs-caption); }
  .spinner-small { width: 16px; height: 16px; border: 2px solid var(--surface2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .kick-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; margin-left: auto; }
  .kick-btn:hover { color: var(--accent); }

  .spectators { font-size: var(--fs-caption); color: var(--text-dim); }
  .actions { display: flex; gap: var(--sp-sm); }
  .dim { color: var(--text-dim); }
  .waiting-hint { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; max-width: 280px; }
</style>
