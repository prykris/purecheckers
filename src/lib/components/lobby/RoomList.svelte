<script>
  import PlayerLink from '../PlayerLink.svelte';
  import { roomDirectory, roomDirectoryClient } from '$lib/stores/roomDirectory.js';
  import { filterRooms } from '../../../../shared/roomList.js';
  import { openSession } from '$lib/stores/navigation.js';
  import { user } from '$lib/stores/user.js';
  import { phase } from '$lib/stores/app.js';
  import { sendCommand, session } from '$lib/stores/session.js';
  import RoomSettings from './RoomSettings.svelte';
  import Modal from '../Modal.svelte';
  import { JOIN_CODE_PATTERN } from '../../../../shared/rooms.js';
  import SessionLine from './SessionLine.svelte';
  let { onplaybot } = $props();

  // Rooms > Create Room keeps the settings form and the ready dance. Bot rooms stay
  // listed as watchable and are tagged; the empty state points at the two real doors.
  const list = $derived($roomDirectory);
  const rooms = $derived(list.rooms === null ? null : filterRooms(list.rooms, filter));

  let filter = $state('all'); // 'all' | 'free' | 'available'
  let showCreate = $state(false);
  let joinError = $state('');
  let lockedRoom = $state(null);
  let inviteCode = $state('');


  const idle = $derived($phase === 'idle');
  const canSend = $derived($session.status === 'ready' && !$session.pending);

  function setFilter(value) { filter = value; }

  function joinRoom(room) {
    joinError = '';
    sendCommand('room:join', { roomId: room.id }).then(result => { joinError = result.error || ''; });
  }
  function spectateRoom(room) {
    joinError = '';
    sendCommand('room:spectate', { roomId: room.id }).then(result => { joinError = result.error || ''; });
  }
  async function joinLocked() {
    const code = inviteCode.trim().toUpperCase();
    if (!canSend || !JOIN_CODE_PATTERN.test(code)) return;
    const result = await sendCommand(lockedRoom.status === 'playing' ? 'room:spectate' : 'room:join', { roomId: lockedRoom.id, code });
    joinError = result.error || '';
    if (result.ok) lockedRoom = null;
  }
  const isBotRoom = room => room.players?.some(p => p.isBot);
  const timerLabel = room => (room.settings.turnTimer ? `${room.settings.turnTimer}s` : 'No clock');
</script>

<div class="rooms">
  {#if idle}
    <div class="rooms-header">
      <button type="button" class="btn btn-primary btn-small" onclick={() => showCreate = true}>Create Room</button>
      <div class="filters">
        <button type="button" class="chip" class:active={filter === 'all'} onclick={() => setFilter('all')}>All</button>
        <button type="button" class="chip" class:active={filter === 'free'} onclick={() => setFilter('free')}>Free</button>
        <button type="button" class="chip" class:active={filter === 'available'} onclick={() => setFilter('available')}>Open</button>
      </div>
    </div>
  {:else}
    <SessionLine />
  {/if}

  {#if joinError}<p class="error" role="alert">{joinError}</p>{/if}

  {#if list.error}<p class="error" role="status">{list.error} <button class="btn btn-small" onclick={() => roomDirectoryClient.refresh()}>Retry</button></p>{/if}
  <div class="room-list">
    {#if rooms === null && !list.error}
      <p class="empty">Loading rooms…</p>
    {:else if rooms?.length === 0}
      <div class="empty">
        {#if list.rooms.length > 0}
          <p>No rooms match this filter.</p>
          <button type="button" class="btn btn-dark btn-small" onclick={() => setFilter('all')}>Show all rooms</button>
        {:else}
          <p>No rooms yet. Play a bot, or play someone nearby from Quick Play.</p>
          <button type="button" class="btn btn-dark btn-small" onclick={onplaybot}>Play a bot</button>
        {/if}
      </div>
    {:else}
      {#each rooms || [] as room (room.id)}
        {@const isMine = room.players.some(p => p.userId === $user?.id)}
        <div class="card room-card" class:my-room={isMine}>
          <div class="room-info">
            <div class="host-row">
              <span class="host"><PlayerLink username={room.hostName} /></span>
              <span class="elo">{room.players[0]?.elo || '?'}</span>
              {#if isMine}<span class="my-badge">Your room</span>{/if}
              {#if isBotRoom(room)}<span class="bot-tag">vs Bot</span>{/if}
            </div>
            <div class="details">
              {#if room.settings.buyIn > 0}
                <span class="tag buy-in">{room.settings.buyIn}c</span>
              {:else}
                <span class="tag free">Free</span>
              {/if}
              <span class="tag">{timerLabel(room)}</span>
              <span class="tag">{room.players.length}/2</span>
              {#if room.spectators?.length > 0}
                <span class="tag">{room.spectators.length} watching</span>
              {/if}
              {#if room.settings.isPrivate}<span class="tag lock-tag"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Private</span>{/if}
            </div>
          </div>
          <div class="room-actions">
            {#if isMine}
              <button type="button" class="btn btn-secondary btn-small" onclick={() => openSession()}>Open</button>
            {:else if !idle}
              <span class="full-tag">{room.status === 'playing' ? 'Live' : room.status === 'starting' ? 'Starting' : room.status === 'updating' ? 'Updating' : 'Waiting'}</span>
            {:else if room.status === 'waiting' && room.players.length < 2}
              {#if room.settings.isPrivate}
                <button type="button" class="btn btn-dark btn-small" onclick={() => { lockedRoom = room; inviteCode = ''; joinError = ''; }} disabled={!canSend}>Enter code</button>
              {:else}
                <button type="button" class="btn btn-primary btn-small" onclick={() => joinRoom(room)} disabled={!canSend}>Join</button>
              {/if}
            {:else if room.status === 'playing' && room.settings.allowSpectators}
              {#if room.settings.isPrivate}
                <button type="button" class="btn btn-dark btn-small" onclick={() => { lockedRoom = room; inviteCode = ''; joinError = ''; }} disabled={!canSend}>Enter code</button>
              {:else}
                <button type="button" class="btn btn-dark btn-small" onclick={() => spectateRoom(room)} disabled={!canSend}>Watch</button>
              {/if}
            {:else if room.status === 'playing'}
              <span class="live-tag">Live</span>
            {:else if room.status === 'starting'}
              <span class="full-tag">Starting</span>
            {:else if room.status === 'updating'}
              <span class="full-tag">Updating</span>
            {:else}
              <span class="full-tag">Full</span>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

{#if showCreate}
  <RoomSettings onclose={() => showCreate = false} />
{/if}
{#if lockedRoom}
  <Modal label="Join private room" busy={!!$session.pending} on:close={() => lockedRoom = null}>
    <form class="card code-form" onsubmit={event => { event.preventDefault(); joinLocked(); }}>
      <h3>Join <PlayerLink username={lockedRoom.hostName} />'s room</h3>
      <label for="room-invite-code">Enter the six-character code from your invitation.</label>
      <input id="room-invite-code" class="input" bind:value={inviteCode} maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" />
      {#if joinError}<p class="error" role="alert">{joinError}</p>{/if}
      <button class="btn btn-primary" type="submit" disabled={!canSend || !JOIN_CODE_PATTERN.test(inviteCode.trim().toUpperCase())}>{lockedRoom.status === 'playing' ? 'Watch game' : 'Join room'}</button>
      <button class="btn btn-dark" type="button" onclick={() => lockedRoom = null}>Cancel</button>
    </form>
  </Modal>
{/if}

<style>
  .rooms { display: flex; flex-direction: column; gap: var(--sp-sm); width: 100%; }
  .code-form { display: flex; flex-direction: column; gap: var(--sp-md); padding: var(--sp-lg); width: min(360px, 100%); }
  .code-form label { color: var(--text-dim); font-size: var(--fs-body); }
  .lock-tag { display: inline-flex; align-items: center; gap: 4px; }
  .lock-tag svg { width: 12px; height: 12px; }
  .rooms-header { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-sm); flex-wrap: wrap; }
  .filters { display: flex; gap: var(--sp-xs); }
  .chip {
    min-height: 32px; padding: var(--sp-xs) var(--sp-sm); border-radius: var(--radius-pill);
    background: var(--surface2); border: none; color: var(--text-dim);
    font-size: var(--fs-caption); font-family: var(--font); cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }
  .chip.active { background: var(--accent); color: #fff; }
  .chip:hover:not(.active) { color: var(--text); }

  .error { color: var(--accent); font-size: var(--fs-caption); text-align: center; }
  .empty { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; padding: var(--sp-xl) var(--sp-md); line-height: 1.5; }

  .room-list { display: flex; flex-direction: column; gap: var(--sp-sm); }
  .room-card { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md); }
  .room-card.my-room { border-color: var(--accent); background: var(--accent-glow, rgba(239,68,68,0.06)); }
  .my-badge, .bot-tag { font-size: 0.55rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 1px 6px; border-radius: var(--radius-pill); }
  .my-badge { color: var(--accent); background: var(--accent-glow, rgba(239,68,68,0.1)); }
  .bot-tag { color: var(--accent2); background: rgba(168,85,247,0.12); }
  .room-info { display: flex; flex-direction: column; gap: var(--sp-xs); min-width: 0; }
  .host-row { display: flex; align-items: center; gap: var(--sp-sm); flex-wrap: wrap; }
  .host { font-weight: 600; font-size: var(--fs-body); }
  .elo { font-size: var(--fs-caption); color: var(--text-dim); }
  .details { display: flex; gap: var(--sp-xs); align-items: center; flex-wrap: wrap; }
  .tag { font-size: 0.65rem; padding: 1px 6px; border-radius: var(--radius-pill); background: var(--surface2); color: var(--text-dim); }
  .buy-in { color: var(--gold); background: rgba(251,191,36,0.1); }
  .free { color: var(--success); background: rgba(34,197,94,0.1); }
  .room-actions { flex-shrink: 0; }
  .full-tag { font-size: var(--fs-caption); color: var(--text-dim); }
  .live-tag { font-size: var(--fs-caption); color: var(--success); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { .chip { transition: none; } }
</style>
