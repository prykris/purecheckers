<script>
  import { locale } from '$lib/stores/locale.js';
  import { siteText } from '$lib/siteCopy.js';
  import { onDestroy } from 'svelte';
  import { roomDirectory } from '$lib/stores/roomDirectory.js';
  import { user } from '$lib/stores/user.js';
  import { createPlayTabs } from '$lib/hints.js';
  import QuickPlay from './QuickPlay.svelte';
  import RoomList from './RoomList.svelte';
  import BotPlay from './BotPlay.svelte';

  // Three tabs, title case, sized so "Quick Play" fits a 109 px tab at 360 px.
  // First visit lands on Bot (hints.js); afterwards the last used tab is remembered.
  const tabs = createPlayTabs({ user: $user });
  onDestroy(() => tabs.dispose());
  const activeTab = $derived($tabs);
  const roomCount = $derived($roomDirectory.rooms?.length || 0);

  function select(tab) {
    tabs.select(tab);
  }

</script>

<div class="play-tabs">
  <div class="tab-row" role="tablist" aria-label="Play">
    <button type="button" class="tab" role="tab" aria-selected={activeTab === 'quick'} class:active={activeTab === 'quick'} onclick={() => select('quick')}>{siteText('Quick Play', $locale)}</button>
    <button type="button" class="tab" role="tab" aria-selected={activeTab === 'rooms'} class:active={activeTab === 'rooms'} onclick={() => select('rooms')}>
      {siteText('Rooms', $locale)}
      {#if roomCount > 0}<span class="tab-badge">{roomCount}</span>{/if}
    </button>
    <button type="button" class="tab" role="tab" aria-selected={activeTab === 'bot'} class:active={activeTab === 'bot'} onclick={() => select('bot')}>{siteText('Bot', $locale)}</button>
  </div>

  <div class="tab-content">
    {#if activeTab === 'quick'}
      <QuickPlay onplaybot={() => select('bot')} />
    {:else if activeTab === 'rooms'}
      <RoomList onplaybot={() => select('bot')} />
    {:else}
      <BotPlay onskip={() => select('quick')} />
    {/if}
  </div>
</div>

<style>
  .play-tabs { width: 100%; display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .tab-row { display: flex; border-bottom: 1px solid var(--surface2); gap: 0; flex-shrink: 0; }
  .tab {
    flex: 1 1 0; min-width: 0; min-height: 44px; padding: var(--sp-sm) var(--sp-xs);
    background: none; border: none; border-bottom: 2px solid transparent;
    color: var(--text-dim); font-family: var(--font);
    font-size: var(--fs-body); font-weight: 600; line-height: 1.3;
    white-space: nowrap; letter-spacing: 0;
    cursor: pointer; transition: color 0.15s, border-color 0.15s;
    display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-xs);
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 16px; height: 16px;
    background: var(--accent); color: #fff;
    font-size: 0.55rem; font-weight: 700;
    border-radius: 8px; padding: 0 4px;
    line-height: 1;
  }
  .tab-content { padding: var(--sp-sm) 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  @media (prefers-reduced-motion: reduce) { .tab { transition: none; } }
</style>
