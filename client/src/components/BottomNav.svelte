<script>
  import { screen } from '../stores/app.js';
</script>

<nav class="tab-bar">
  <button class="tab" class:active={$screen === 'lobby'} on:click={() => $screen = 'lobby'}>
    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    <span>Play</span>
  </button>
  <button class="tab" class:active={$screen === 'shop'} on:click={() => $screen = 'shop'}>
    <svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7.16 6.26l.54 2h12.15l-3.09 5.59H8.53L7.16 6.26zM6 2L4.27 2l1.46 3H2v2h2.05l3.48 7.31L6.22 17H20v-2H8.14l.96-1.74h7.43c.75 0 1.41-.41 1.75-1.03l3.09-5.59A1 1 0 0020.51 5H5.21L4.27 2H2"/></svg>
    <span>Shop</span>
  </button>
  <button class="tab" class:active={$screen === 'friends'} on:click={() => $screen = 'friends'}>
    <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5C23 14.17 18.33 13 16 13z"/></svg>
    <span>Friends</span>
  </button>
  <button class="tab" class:active={$screen === 'profile'} on:click={() => $screen = 'profile'}>
    <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
    <span>Profile</span>
  </button>
</nav>

<style>
  .tab-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
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
    gap: 2px;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 0.6rem;
    font-weight: 600;
    cursor: pointer;
    padding: var(--sp-xs) var(--sp-sm);
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s;
  }
  .tab svg {
    width: 22px;
    height: 22px;
    fill: currentColor;
  }
  .tab.active {
    color: var(--accent);
  }

  @media (min-width: 900px) {
    .tab-bar { display: none; }
  }
</style>
