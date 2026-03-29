<script>
  import { onMount, onDestroy } from 'svelte';
  import { screen, gameState } from '../../stores/app.js';
  import { user } from '../../stores/user.js';
  import { getSocket } from '../../lib/socket.js';
  import RoomCreate from './RoomCreate.svelte';

  let rooms = [];
  let filter = 'all'; // 'all' | 'free' | 'available'
  let showCreate = false;
  let joinCode = '';
  let joinError = '';
  let socket;

  onMount(() => {
    socket = getSocket();
    if (!socket) return;
    socket.emit('room:list', { filter });
    socket.on('room:list', onList);
    socket.on('room:list-update', onUpdate);
    socket.on('room:joined', onJoined);
    socket.on('room:error', onError);
  });

  onDestroy(() => {
    if (socket) {
      socket.off('room:list', onList);
      socket.off('room:list-update', onUpdate);
      socket.off('room:joined', onJoined);
      socket.off('room:error', onError);
    }
  });

  function onList({ rooms: r }) { rooms = r; }
  function onUpdate({ room }) {
    if (room.closed) { rooms = rooms.filter(r => r.id !== room.id); return; }
    const idx = rooms.findIndex(r => r.id === room.id);
    if (idx >= 0) rooms[idx] = room; else if (!room.settings?.isPrivate) rooms = [room, ...rooms];
    rooms = rooms;
  }
  function onJoined({ room }) {
    $gameState = { roomId: room.id, mode: 'room' };
    $screen = 'room-waiting';
  }
  function onError({ error }) { joinError = error; setTimeout(() => joinError = '', 3000); }

  function refreshList() {
    socket?.emit('room:list', { filter: filter === 'all' ? undefined : filter });
  }

  function joinRoom(room) {
    joinError = '';
    socket?.emit('room:join', { roomId: room.id });
  }

  function spectateRoom(room) {
    socket?.emit('room:spectate', { roomId: room.id });
  }

  function onCreated() {
    showCreate = false;
    // room:created handler in RoomCreate transitions to waiting screen
  }

  $: if (filter) refreshList();
</script>

<div class="rooms">
  <div class="rooms-header">
    <button class="btn btn-primary btn-small" on:click={() => showCreate = true}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Create Room
    </button>
    <div class="filters">
      <button class="chip" class:active={filter==='all'} on:click={() => filter='all'}>All</button>
      <button class="chip" class:active={filter==='free'} on:click={() => filter='free'}>Free</button>
      <button class="chip" class:active={filter==='available'} on:click={() => filter='available'}>Open</button>
    </div>
  </div>

  {#if joinError}<p class="error">{joinError}</p>{/if}

  <div class="room-list">
    {#if rooms.length === 0}
      <p class="empty">No rooms available. Create one!</p>
    {:else}
      {#each rooms as room}
        <div class="card room-card">
          <div class="room-info">
            <div class="host-row">
              <span class="host">{room.hostName}</span>
              <span class="elo">{room.players[0]?.elo || '?'}</span>
            </div>
            <div class="details">
              {#if room.settings.buyIn > 0}
                <span class="tag buy-in">{room.settings.buyIn}c</span>
              {:else}
                <span class="tag free">Free</span>
              {/if}
              <span class="tag">{room.settings.turnTimer}s</span>
              <span class="tag">{room.players.length}/2</span>
              {#if room.settings.isPrivate}
                <svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              {/if}
            </div>
          </div>
          <div class="room-actions">
            {#if room.status === 'waiting' && room.players.length < 2}
              <button class="btn btn-primary btn-small" on:click={() => joinRoom(room)}>Join</button>
            {:else if room.status === 'playing' && room.settings.allowSpectators}
              <button class="btn btn-dark btn-small" on:click={() => spectateRoom(room)}>Watch</button>
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
  <RoomCreate on:close={() => showCreate = false} />
{/if}

<style>
  .rooms { display: flex; flex-direction: column; gap: var(--sp-sm); width: 100%; }
  .rooms-header { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-sm); flex-wrap: wrap; }
  .filters { display: flex; gap: var(--sp-xs); }
  .chip {
    padding: var(--sp-xs) var(--sp-sm); border-radius: var(--radius-pill);
    background: var(--surface2); border: none; color: var(--text-dim);
    font-size: var(--fs-caption); font-family: var(--font); cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }
  .chip.active { background: var(--accent); color: #fff; }
  .chip:hover:not(.active) { color: var(--text); }

  .error { color: var(--accent); font-size: var(--fs-caption); text-align: center; }
  .empty { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; padding: var(--sp-xl) 0; }

  .room-list { display: flex; flex-direction: column; gap: var(--sp-sm); }
  .room-card { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md); }
  .room-info { display: flex; flex-direction: column; gap: var(--sp-xs); min-width: 0; }
  .host-row { display: flex; align-items: center; gap: var(--sp-sm); }
  .host { font-weight: 600; font-size: var(--fs-body); }
  .elo { font-size: var(--fs-caption); color: var(--text-dim); }
  .details { display: flex; gap: var(--sp-xs); align-items: center; flex-wrap: wrap; }
  .tag { font-size: 0.65rem; padding: 1px 6px; border-radius: var(--radius-pill); background: var(--surface2); color: var(--text-dim); }
  .buy-in { color: var(--gold); background: rgba(251,191,36,0.1); }
  .free { color: var(--success); background: rgba(34,197,94,0.1); }
  .lock { color: var(--text-dim); }
  .room-actions { flex-shrink: 0; }
  .full-tag { font-size: var(--fs-caption); color: var(--text-dim); }
</style>
