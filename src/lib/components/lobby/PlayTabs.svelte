<script>
  import { onMount, onDestroy } from 'svelte';
  import { getSocket } from '$lib/socket.js';
  import QuickPlay from './QuickPlay.svelte';
  import RoomList from './RoomList.svelte';
  import BotPlay from './BotPlay.svelte';

  let activeTab = 'quick';
  let roomCount = 0;
  let socket;

  onMount(() => {
    socket = getSocket();
    if (socket) {
      socket.emit('room:list', {});
      socket.on('room:list', ({ rooms }) => { roomCount = rooms.length; });
      socket.on('room:list-update', () => {
        // Re-fetch count
        socket.emit('room:list', {});
      });
    }
  });

  onDestroy(() => {
    if (socket) {
      socket.off('room:list');
      socket.off('room:list-update');
    }
  });
</script>

<div class="play-tabs">
  <div class="tab-row">
    <button class="tab" class:active={activeTab==='quick'} on:click={() => activeTab='quick'}>Quick Play</button>
    <button class="tab" class:active={activeTab==='rooms'} on:click={() => activeTab='rooms'}>
      Rooms
      {#if roomCount > 0}<span class="tab-badge">{roomCount}</span>{/if}
    </button>
    <button class="tab" class:active={activeTab==='bot'} on:click={() => activeTab='bot'}>Bot</button>
  </div>

  <div class="tab-content">
    {#if activeTab === 'quick'}
      <QuickPlay />
    {:else if activeTab === 'rooms'}
      <RoomList />
    {:else}
      <BotPlay />
    {/if}
  </div>
</div>

<style>
  .play-tabs { width: 100%; display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .tab-row { display: flex; border-bottom: 1px solid var(--surface2); gap: 0; }
  .tab {
    flex: 1; padding: var(--sp-sm) var(--sp-md);
    background: none; border: none; border-bottom: 2px solid transparent;
    color: var(--text-dim); font-family: var(--font);
    font-size: var(--fs-caption); font-weight: 600;
    cursor: pointer; transition: color 0.15s, border-color 0.15s;
    text-transform: uppercase; letter-spacing: 1px;
    position: relative;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 16px; height: 16px;
    background: var(--accent); color: #fff;
    font-size: 0.55rem; font-weight: 700;
    border-radius: 8px; padding: 0 4px;
    margin-left: var(--sp-xs);
    line-height: 1;
  }
  .tab-content { padding: var(--sp-sm) 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
