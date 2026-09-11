<script>
  import PlayerLink from '../PlayerLink.svelte';
  import { onMount } from 'svelte';
  import { activeRoom } from '$lib/stores/app.js';
  import { minimizeSession } from '$lib/stores/navigation.js';
  import { user } from '$lib/stores/user.js';
  import { sendCommand, session, serverNow } from '$lib/stores/session.js';
  import { botDifficulty, difficultyLabel } from '$lib/stores/ui.js';
  import { track } from '$lib/analytics.js';
  import { ScreenWakeLock } from '$lib/screenWakeLock.js';
  import RoomChat from '../chat/RoomChat.svelte';
  import ShareActions from '../ShareActions.svelte';
  import RoomSettings from './RoomSettings.svelte';
  import RoomFriendship from './RoomFriendship.svelte';

  // Every room uses the same controls. Invitation context adds a sharing section.
  const room = $derived($activeRoom);
  const me = $derived(room?.players?.find(p => p.userId === $user?.id) || null);
  const opponent = $derived(me && room.players.find(p => p.userId !== me.userId && !p.isBot));
  let expandedFriend = $state(null);
  const isHost = $derived(!!room && room.hostId === $user?.id);
  const host = $derived(room?.players?.find(p => p.userId === room.hostId) || null);
  const hostName = $derived(room?.hostName || host?.username || 'your friend');
  const autoReady = $derived(!!room?.settings?.autoReady);
  const seatFree = $derived(!!room && room.players.length < 2);
  const starting = $derived(room?.status === 'starting');
  const updating = $derived(room?.status === 'updating');
  const startAvailable = $derived(autoReady && room?.readyToStart === true);
  const canSend = $derived($session.status === 'ready' && !$session.pending && !updating);
  const leaving = $derived($session.pending === 'room:leave');
  const timerLabel = $derived(room?.settings?.turnTimer ? `Timer: ${room.settings.turnTimer}s` : 'No clock');
  const effectiveMode = $derived(room?.effectiveMode || 'RANKED');
  const settingBadges = $derived(room ? [
    { field: 'buyIn', label: room.settings.buyIn > 0 ? `Buy-in: ${room.settings.buyIn}c` : 'Free', name: 'buy-in' },
    { field: 'turnTimer', label: timerLabel, name: 'turn timer' },
    { field: 'allowSpectators', label: room.settings.allowSpectators ? 'Spectators OK' : 'Spectators off', name: 'spectator access' },
    { field: 'isPrivate', label: room.settings.isPrivate ? 'Private · invite required' : 'Public · open to join', name: 'room privacy' },
  ] : []);

  let showSettings = $state(false);
  let focusSetting = $state('buyIn');
  function editSetting(field) {
    if (!isHost || !canSend || !room?.canEditSettings) return;
    focusSetting = field; showSettings = true;
  }
  function toggleReady() { sendCommand('room:ready', { roomId: room?.id, ready: !me?.ready, expectedSettings: room?.settings }); }
  function retryStart() { sendCommand('room:ready', { roomId: room?.id, ready: true, expectedSettings: room?.settings }); }
  function leaveRoom() { sendCommand('room:leave', { roomId: room?.id }); }
  function kick(userId) { sendCommand('room:kick', { roomId: room?.id, userId }); }
  function addBot() { sendCommand('bot:join', { roomId: room?.id, difficulty: $botDifficulty }); }

  // Both nearby and configured rooms show their code only to the waiting host.
  let wakeLock = $state.raw(null);
  onMount(() => {
    const owner = new ScreenWakeLock({ document, request: type => navigator.wakeLock?.request(type) });
    wakeLock = owner;
    return () => owner.dispose();
  });
  $effect(() => {
    wakeLock?.setTarget(isHost && seatFree && room?.qrDataUrl ? room.id : null);
  });
</script>

<div class="waiting-screen">
  <div class="topbar">
    <button type="button" class="back-btn" onclick={() => minimizeSession()}>Back</button>
    <h2 class="topbar-title">{#if room}<PlayerLink username={hostName} />'s room{:else}Game room{/if}</h2>
    <span class="topbar-spacer" aria-hidden="true"></span>
  </div>

  <div class="column">
    {#if updating}<p class="status-line" role="status">Confirming room change…</p>{/if}
    {#if !room}
      <div class="spinner"></div>
      <p class="dim">Loading room…</p>

    {:else}
      <div class="settings-row">
        <span class="tag" class:green={effectiveMode === 'RANKED'} class:gold={effectiveMode === 'FRIENDLY'}>{effectiveMode === 'RANKED' ? 'Ranked' : 'Friendly'}</span>
        {#each settingBadges as badge (badge.field)}
          {#if isHost && !room.challenge}
            <button type="button" class="tag setting-badge" onclick={() => editSetting(badge.field)} disabled={!canSend || !room.canEditSettings}
              aria-label={`Edit ${badge.name}: ${badge.label}`} aria-haspopup="dialog">
              {badge.label}
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>
            </button>
          {:else}<span class="tag">{badge.label}</span>{/if}
        {/each}
      </div>
      {#if isHost && !room.challenge}
        {#if room.canEditSettings}<p class="waiting-hint">Tap a setting to edit it.</p>
        {:else if !starting && !updating}<p class="waiting-hint">Settings are locked while a player is ready.</p>{/if}
      {/if}

      {#if room.challenge && seatFree}
        <p class="status-line" role="status">Invitation sent. Waiting for the player to accept.</p>
        <p class="dim">Expires in {Math.max(0, Math.ceil((room.challenge.expiresAt - ($serverNow ?? room.challenge.expiresAt)) / 1000))} seconds. You can leave to cancel.</p>
      {:else if isHost && seatFree}
        <div class="invite-section">
          {#if room.qrDataUrl}
            <img class="scan-image small" src={room.qrDataUrl} width="160" height="160" alt="Scannable code to join this game" />
          {/if}
          <p class="scan-caption">Point a phone camera at this, or send the link. No account needed.</p>
          <p class="invite-code">Room code <strong>{room.joinCode}</strong></p>
          <ShareActions surface="invite" url={room.joinUrl} data={{ hostName, buyIn: room.settings.buyIn }} label="Share link" onshared={method => track('invite_link_shared', { method })} />
        </div>
      {/if}

      <div class="slots">
        {#each [0, 1] as i}
          {@const p = room.players[i]}
          <div class="card slot" class:ready={p?.ready}>
            {#if p}
              <div class="player-row">
                <span class="presence-dot" class:online={p.online !== false} class:offline={p.online === false}></span>
                <span class="pname">
                  <PlayerLink username={p.username} />
                  {#if p.userId === $user?.id}<span class="you-tag">You</span>{/if}
                  {#if p.isBot}<span class="you-tag">Bot</span>{/if}
                </span>
                <span class="pelo">ELO {p.elo}</span>
                {#if me && p.userId !== me.userId && !p.isBot}
                  <button type="button" class="player-link" onclick={() => expandedFriend = `${room.id}:${p.userId}`} aria-label={`Friendship options for ${p.username}`}>Friend options</button>
                {/if}
                {#if p.ready}
                  <span class="ready-badge">Ready</span>
                {:else}
                  <span class="not-ready">Not ready</span>
                {/if}
                {#if isHost && p.userId !== $user?.id}
                  <button type="button" class="kick-btn" onclick={() => kick(p.userId)} disabled={!canSend}>Remove</button>
                {/if}
              </div>
            {:else}
              <div class="player-row empty">
                <div class="empty-left">
                  <span class="spinner-small"></span>
                  <span class="pname dim">Waiting…</span>
                </div>
                {#if isHost && room.canAddBot}
                  <button type="button" class="btn btn-dark btn-small" onclick={addBot} disabled={!canSend}>Add a bot · {difficultyLabel($botDifficulty)}</button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if opponent}
        {#key `${room.id}:${opponent.userId}`}
          <RoomFriendship {opponent} suggested={room.suggestFriendship} expanded={expandedFriend === `${room.id}:${opponent.userId}`} onclose={() => expandedFriend = null} />
        {/key}
      {/if}

      {#if room.spectators?.length > 0}
        <p class="spectators">Spectators: {#each room.spectators as spectator, i}{#if i}, {/if}<PlayerLink username={spectator.username} />{/each}</p>
      {/if}

      <div class="actions">
        {#if starting}
          <p class="status-line"><span class="spinner-small"></span>Starting…</p>
        {:else if startAvailable && me}
          <p class="status-line">Ready to start.</p>
          <button type="button" class="btn btn-primary" onclick={retryStart} disabled={!canSend}>Start game</button>
        {:else if me && !me.isBot && room.players.length === 2 && !autoReady}
          <button type="button" class="btn" class:btn-primary={!me.ready} class:btn-secondary={me.ready} onclick={toggleReady} disabled={!canSend}>
            {me.ready ? 'Unready' : 'Ready Up'}
          </button>
        {/if}
        <button type="button" class="btn btn-dark btn-small leave-btn" onclick={leaveRoom} disabled={!canSend} aria-busy={leaving}>
          {isHost ? 'Close room' : 'Leave'}
        </button>
      </div>

      {#if seatFree}
        <p class="waiting-hint">{room.challenge ? 'Waiting for the invited player.' : room.settings.isPrivate ? 'Share the link or room code with your friend. Both players ready up when they’re happy with the settings.' : 'Share the link, add a bot, or wait for someone from the room list.'}</p>
      {:else if !autoReady && !room.players.every(p => p.ready)}
        <p class="waiting-hint">Both players must ready up to start</p>
      {/if}

      <div class="chat-box card">
        <RoomChat channelId={`room:${room.id}`} />
      </div>
    {/if}
  </div>
</div>
{#if showSettings && room}
  <RoomSettings {room} focusField={focusSetting} onclose={() => showSettings = false} />
{/if}

<style>
  .waiting-screen {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    background: radial-gradient(ellipse at 50% 30%, var(--bg-subtle) 0%, var(--bg) 70%);
    padding-top: env(safe-area-inset-top, 0px);
  }
  .topbar {
    flex-shrink: 0; height: 44px; display: flex; align-items: center; gap: var(--sp-sm);
    padding: 0 var(--sp-sm); border-bottom: 1px solid var(--surface2);
  }
  .back-btn, .topbar-spacer {
    min-width: 56px; min-height: 44px; display: inline-flex; align-items: center;
    background: none; border: none; color: var(--text-dim);
    font-family: var(--font); font-size: var(--fs-caption); font-weight: 600; cursor: pointer; padding: 0 var(--sp-xs);
  }
  .back-btn:hover { color: var(--text); }
  .topbar-title { flex: 1; text-align: center; font-size: var(--fs-body); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .column {
    flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-md);
    padding: var(--sp-md); padding-bottom: max(var(--sp-md), env(safe-area-inset-bottom));
    width: 100%; max-width: 520px; margin: 0 auto;
  }

  .scan-image { width: 200px; height: 200px; border-radius: var(--radius-md); background: #fff; padding: var(--sp-xs); flex-shrink: 0; }
  .scan-image.small { width: 160px; height: 160px; }
  .scan-caption { font-size: var(--fs-body); color: var(--text-dim); text-align: center; line-height: 1.5; max-width: 300px; }
  .status-line { display: flex; align-items: center; justify-content: center; gap: var(--sp-sm); font-size: var(--fs-body); color: var(--text-dim); text-align: center; }
  .invite-code { color: var(--text-dim); font-size: var(--fs-caption); }
  .invite-code strong { margin-left: var(--sp-sm); color: var(--text); letter-spacing: 0.12em; font-family: var(--font-mono); }

  .settings-row { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; }
  .tag { font-size: var(--fs-caption); padding: 2px var(--sp-sm); border-radius: var(--radius-pill); background: var(--surface2); color: var(--text-dim); }
  .settings-row { align-items: center; }
  .setting-badge { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 8px 12px; border: 1px solid transparent; font-family: var(--font); cursor: pointer; }
  .setting-badge svg { width: 13px; height: 13px; flex-shrink: 0; }
  .setting-badge:enabled:hover { border-color: var(--text-dim); color: var(--text); }
  .setting-badge:focus-visible { outline: 2px solid var(--text); outline-offset: 3px; }
  .setting-badge:disabled { opacity: 0.6; cursor: not-allowed; }
  .gold { color: var(--gold); background: rgba(251,191,36,0.1); }
  .green { color: var(--success); background: rgba(34,197,94,0.1); }

  .invite-section { display: flex; flex-direction: column; align-items: center; gap: var(--sp-sm); }

  .slots { display: flex; flex-direction: column; gap: var(--sp-sm); width: 100%; }
  .slot { padding: var(--sp-md); min-height: 60px; display: flex; align-items: center; }
  .slot.ready { border-color: var(--success); }
  .player-row { display: flex; align-items: center; gap: var(--sp-sm); width: 100%; flex-wrap: wrap; }
  .presence-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .presence-dot.online { background: var(--success); }
  .presence-dot.offline { background: var(--text-dim); }
  .pname { font-weight: 600; font-size: var(--fs-body); display: flex; align-items: center; gap: var(--sp-xs); }
  .player-link { min-height: 44px; padding: 0; border: none; background: none; color: inherit; font: inherit; text-align: left; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .you-tag { font-size: 0.55rem; color: var(--accent); font-weight: 700; text-transform: uppercase; background: var(--accent-glow, rgba(239,68,68,0.1)); padding: 1px 5px; border-radius: var(--radius-pill); }
  .pelo { font-size: var(--fs-caption); color: var(--text-dim); }
  .ready-badge { font-size: 0.65rem; color: var(--success); font-weight: 700; text-transform: uppercase; margin-left: auto; }
  .not-ready { font-size: 0.65rem; color: var(--text-dim); margin-left: auto; }
  .player-row.empty { justify-content: space-between; }
  .empty-left { display: flex; align-items: center; gap: var(--sp-sm); }
  .dim { color: var(--text-dim); }
  .spinner-small { width: 16px; height: 16px; border: 2px solid var(--surface2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .kick-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; font-family: var(--font); font-size: var(--fs-caption); min-height: 32px; }
  .kick-btn:hover { color: var(--accent); }

  .spectators { font-size: var(--fs-caption); color: var(--text-dim); }
  .actions { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; align-items: center; }
  .actions .btn { min-height: 44px; }
  .leave-btn { color: var(--accent); }
  .waiting-hint { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; max-width: 300px; line-height: 1.4; }
  .chat-box { width: 100%; height: 180px; padding: 0; overflow: hidden; flex-shrink: 0; }
  @media (prefers-reduced-motion: reduce) { .spinner-small { animation-duration: 2s; } }
</style>
