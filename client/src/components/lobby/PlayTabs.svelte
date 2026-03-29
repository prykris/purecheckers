<script>
  import QuickPlay from './QuickPlay.svelte';
  import RoomList from './RoomList.svelte';
  import BotPlay from './BotPlay.svelte';

  let activeTab = 'quick'; // 'quick' | 'rooms' | 'bot'
</script>

<div class="play-tabs">
  <div class="tab-row">
    <button class="tab" class:active={activeTab==='quick'} on:click={() => activeTab='quick'}>Quick Play</button>
    <button class="tab" class:active={activeTab==='rooms'} on:click={() => activeTab='rooms'}>Rooms</button>
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
  .play-tabs { width: 100%; display: flex; flex-direction: column; }
  .tab-row {
    display: flex; border-bottom: 1px solid var(--surface2);
    gap: 0;
  }
  .tab {
    flex: 1; padding: var(--sp-sm) var(--sp-md);
    background: none; border: none; border-bottom: 2px solid transparent;
    color: var(--text-dim); font-family: var(--font);
    font-size: var(--fs-caption); font-weight: 600;
    cursor: pointer; transition: color 0.15s, border-color 0.15s;
    text-transform: uppercase; letter-spacing: 1px;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-content { padding: var(--sp-sm) 0; }
</style>
