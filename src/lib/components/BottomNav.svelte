<script>
  import { browseTab } from '$lib/stores/app.js';
</script>

<nav class="tab-bar">
  <button class="tab" class:active={$browseTab === 'lobby'} on:click={() => $browseTab = 'lobby'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
    <span>Play</span>
  </button>
  <button class="tab" class:active={$browseTab === 'shop'} on:click={() => $browseTab = 'shop'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
    <span>Shop</span>
  </button>
  <button class="tab" class:active={$browseTab === 'friends'} on:click={() => $browseTab = 'friends'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
    <span>Friends</span>
  </button>
  <button class="tab" class:active={$browseTab === 'profile'} on:click={() => $browseTab = 'profile'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
    <span>Profile</span>
  </button>
</nav>

<style>
  .tab-bar {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: var(--tab-height);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--surface);
    border-top: 1px solid var(--surface2);
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: 50;
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    background: none;
    border: none;
    color: var(--text-dim);
    font-family: var(--font);
    font-size: 0.6rem;
    font-weight: 500;
    cursor: pointer;
    padding: var(--sp-xs) var(--sp-sm);
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s;
  }
  .tab svg { width: 20px; height: 20px; }
  .tab.active { color: var(--accent); }
  .tab:not(.active):hover { color: var(--text); }

  @media (min-width: 900px) {
    .tab-bar { max-width: 480px; margin: 0 auto; border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
  }
</style>
