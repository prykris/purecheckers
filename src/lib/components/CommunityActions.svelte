<script>
  import { locale } from '$lib/stores/locale.js';
  import { siteText } from '$lib/siteCopy.js';
  let { docked = false, onchat, onranks, chatOpen = false, ranksOpen = false } = $props();
</script>

<div class="community-actions" class:docked>
  <button type="button" onclick={onchat} aria-label="Open global chat" aria-haspopup="dialog" aria-expanded={chatOpen} title="Global chat">
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    <span>{siteText('Chat', $locale)}</span>
  </button>
  <button type="button" onclick={onranks} aria-label="Open leaderboard" aria-haspopup="dialog" aria-expanded={ranksOpen} title="Leaderboard">
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4" /></svg>
    <span>{siteText('Ranks', $locale)}</span>
  </button>
</div>

<style>
  .community-actions { display: flex; flex-shrink: 0; gap: 2px; }
  button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 44px; min-height: 44px; color: var(--text-dim); background: none; border: 0; border-radius: 8px; font: inherit; cursor: pointer; }
  button:hover { background: var(--surface); color: var(--text); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; }
  span { font-size: .6rem; }
  .docked button { position: fixed; top: 50%; transform: translateY(-50%); z-index: 55; background: var(--surface); border: 1px solid var(--surface2); }
  .docked button:first-child { left: 0; border-radius: 0 8px 8px 0; }
  .docked button:last-child { right: 0; border-radius: 8px 0 0 8px; }
</style>
