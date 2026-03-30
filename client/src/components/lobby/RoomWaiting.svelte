<script>
  import { onMount, onDestroy } from 'svelte';
  import { screen, gameState, activeRoom } from '../../stores/app.js';
  import { user } from '../../stores/user.js';
  import { getSocket } from '../../lib/socket.js';
  import RoomChat from '../chat/RoomChat.svelte';

  let socket;
  let copied = false;

  // Room data comes from the activeRoom store (kept in sync by RoomBanner)
  $: room = $activeRoom;
  $: joinUrl = room?.joinUrl || null;
  $: qrDataUrl = room?.qrDataUrl || $gameState?.roomData?.qrDataUrl || null;
  $: code = room?.joinCode || '';
  $: isHost = room?.hostId === $user?.id;
  $: myPlayer = room?.players?.find(p => p.userId === $user?.id);
  $: myReady = myPlayer?.ready || false;

  function copyLink() {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl).then(() => {
      copied = true;
      setTimeout(() => copied = false, 2000);
    });
  }

  onMount(() => {
    socket = getSocket();
    if (!socket) return;
    socket.on('room:kicked', onKicked);
    socket.on('matchmaking:found', onGameStart);
  });

  onDestroy(() => {
    if (socket) {
      socket.off('room:kicked', onKicked);
      socket.off('matchmaking:found', onGameStart);
    }
  });

  function onKicked() { $activeRoom = null; $screen = 'lobby'; }

  function onGameStart(data) {
    $activeRoom = null;
    $gameState = { gameId: data.gameId, myColor: data.yourColor, opponentName: data.opponent.username, opponentId: data.opponent.id, mode: 'online' };
    $screen = 'wheel';
  }

  function toggleReady() {
    socket?.emit('room:ready', { roomId: room?.id });
  }

  function backToLobby() {
    // Just navigate away — room stays active (banner shows)
    $screen = 'lobby';
  }

  function leaveRoom() {
    socket?.emit('room:leave', { roomId: room?.id });
    $activeRoom = null;
    $screen = 'lobby';
  }

  function kick(userId) {
    socket?.emit('room:kick', { roomId: room?.id, userId });
  }
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

      <div class="invite-section">
        {#if qrDataUrl}
          <img class="qr-code" src={qrDataUrl} alt="Join QR code" />
        {/if}
        <span class="code-label">Room Code</span>
        <span class="code">{code}</span>
        {#if joinUrl}
          <button class="btn btn-dark btn-small copy-btn" on:click={copyLink}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        {/if}
        <p class="code-hint">Scan QR or share the link to invite</p>
      </div>

      <div class="slots">
        {#each [0, 1] as i}
          <div class="card slot" class:filled={room.players[i]} class:ready={room.players[i]?.ready}>
            {#if room.players[i]}
              <div class="player-row">
                <span class="presence-dot" class:online={room.players[i].online !== false} class:offline={room.players[i].online === false}></span>
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
        <button class="btn btn-dark btn-small" on:click={backToLobby}>Back</button>
        <button class="btn btn-dark btn-small leave-btn" on:click={leaveRoom}>
          {isHost ? 'Close Room' : 'Leave'}
        </button>
      </div>

      {#if room.players.length < 2}
        <p class="waiting-hint">Share the room code or wait for someone to join from the room list</p>
      {:else if !room.players.every(p => p.ready)}
        <p class="waiting-hint">Both players must ready up to start</p>
      {/if}

      <div class="chat-box card">
        <RoomChat roomId={room.id} />
      </div>
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

  .invite-section { display: flex; flex-direction: column; align-items: center; gap: var(--sp-sm); }
  .qr-code { width: 160px; height: 160px; border-radius: var(--radius-md); background: #fff; padding: var(--sp-xs); }
  .code-label { font-size: var(--fs-caption); color: var(--text-dim); text-transform: uppercase; letter-spacing: 2px; }
  .code { font-size: 1.8rem; font-weight: 700; letter-spacing: 6px; color: var(--accent); font-family: var(--font-mono); }
  .copy-btn { gap: var(--sp-xs); }
  .code-hint { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; }

  .slots { display: flex; flex-direction: column; gap: var(--sp-sm); width: 100%; }
  .slot { padding: var(--sp-md); min-height: 60px; display: flex; align-items: center; }
  .slot.ready { border-color: var(--success); }
  .player-row { display: flex; align-items: center; gap: var(--sp-sm); width: 100%; }
  .presence-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .presence-dot.online { background: var(--success); }
  .presence-dot.offline { background: var(--text-dim); }
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
  .actions { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; }
  .leave-btn { color: var(--accent); }
  .dim { color: var(--text-dim); }
  .waiting-hint { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; max-width: 280px; }
  .chat-box { width: 100%; height: 180px; padding: 0; overflow: hidden; }
</style>
