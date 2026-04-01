<script>
  import { screen, searching } from '../stores/app.js';
  import { getSocket } from '../lib/socket.js';

  function openSearch() { $screen = 'search'; }

  function cancel(e) {
    e.stopPropagation();
    getSocket()?.emit('matchmaking:leave');
    $searching = false;
  }

  $: show = $searching && $screen !== 'search' && $screen !== 'wheel' && $screen !== 'game' && $screen !== 'auth';
</script>

{#if show}
  <div class="search-pill" on:click={openSearch} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && openSearch()}>
    <span class="dot"></span>
    <span class="pill-text">Searching...</span>
    <span class="pill-close" on:click={cancel} on:keydown={(e) => e.key === 'Enter' && cancel(e)} role="button" tabindex="0" title="Cancel search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </span>
  </div>
{/if}

<style>
  .search-pill {
    position: fixed; z-index: 48;
    display: flex; align-items: center; gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface); border: 1px solid var(--accent2);
    border-radius: var(--radius-pill);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    cursor: pointer; font-family: var(--font); color: var(--text);
    transition: transform 0.15s, box-shadow 0.15s;
    bottom: calc(var(--tab-height) + var(--sp-sm) + env(safe-area-inset-bottom, 0px));
    left: 50%; transform: translateX(-50%);
  }
  .search-pill:hover { transform: translateX(-50%) translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.4); }
  .search-pill:active { transform: translateX(-50%) translateY(0); }

  .dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    background: var(--accent2);
    animation: dot-blink 1.2s ease-in-out infinite;
  }
  @keyframes dot-blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }

  .pill-text { font-size: var(--fs-caption); font-weight: 600; white-space: nowrap; }
  .pill-close {
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; color: var(--text-dim);
    cursor: pointer; padding: 2px; margin-left: var(--sp-xs); border-radius: 50%;
  }
  .pill-close:hover { color: var(--accent); }

  @media (min-width: 900px) {
    .search-pill { bottom: auto; top: var(--sp-md); left: auto; right: var(--sp-md); transform: none; }
    .search-pill:hover { transform: translateY(-2px); }
    .search-pill:active { transform: translateY(0); }
  }
</style>
