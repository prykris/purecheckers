<script>
  import PlayerAvatar from './PlayerAvatar.svelte';
  import PlayerLink from './PlayerLink.svelte';
  import CommunityActions from './CommunityActions.svelte';
  import AccountMenu from './AccountMenu.svelte';
  import { locale } from '$lib/stores/locale.js';
  import { siteText } from '$lib/siteCopy.js';
  const text = value => siteText(value, $locale);
  import { user } from '$lib/stores/user.js';
  import { browseTo } from '$lib/stores/navigation.js';
  import { openUpgradeSheet } from '$lib/stores/ui.js';

  let { onchat, onranks, chatOpen, ranksOpen } = $props();
  function profile() { browseTo('profile'); }
  function save() { openUpgradeSheet(); }
</script>

<header class="player-header">
  <div class="header-row">
    <button class="avatar" type="button" onclick={profile} aria-label="Your profile and statistics"><PlayerAvatar username={$user?.username} size={44}/></button>
    <div class="identity">
      <h2><PlayerLink username={$user?.username} profilePublic={$user?.profilePublic} /></h2>
      <div class="stats">
        <span title="Your rating">{$user?.elo ?? 1000} <small>ELO</small></span>
        <span class="coins" aria-label={`${$user?.coins ?? 0} coins`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" /><path d="M12 7v10m3-8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>{$user?.coins ?? 0}
        </span>
      </div>
    </div>
    <CommunityActions {onchat} {onranks} {chatOpen} {ranksOpen} />
    <AccountMenu />
  </div>
  {#if $user?.isGuest}
    <button class="save-nudge" type="button" onclick={save}><span>{text('Keep your name & game history')}</span><strong>{text('Save account')} <span aria-hidden="true">↗</span></strong></button>
  {/if}
</header>


<style>
  .player-header { width: 100%; max-width: 520px; justify-self: center; padding: max(8px, env(safe-area-inset-top)) 16px 0; flex-shrink: 0; }
  .header-row { display: flex; align-items: center; gap: 8px; min-height: 56px; }
  .avatar { flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; border: 0; background:none; padding:0; color: white; font: inherit; font-weight: 700; cursor: pointer; }
  .identity { min-width: 0; flex: 1; }
  h2 { font-size: .95rem; line-height: 1.3; overflow-wrap: anywhere; }
  h2 :global(a) { text-decoration: none; }
  .stats { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; color: var(--text-dim); font-size: .7rem; }
  small { font-size: .55rem; letter-spacing: .03em; }
  .coins { display: inline-flex; align-items: center; gap: 4px; color: var(--gold); background: none; border: 0; font: inherit; min-height: 24px; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .save-nudge { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 36px; margin-top: 4px; border: 0; border-bottom: 1px solid var(--surface2); background: none; color: var(--text-dim); text-align: left; font: inherit; font-size: .65rem; cursor: pointer; }
  .save-nudge strong { color: var(--accent2); white-space: nowrap; font-weight: 600; }
  @media (max-width: 360px) { .header-row { gap: 4px; } .player-header { padding-inline: 12px; } }
</style>
