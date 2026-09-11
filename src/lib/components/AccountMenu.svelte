<script>
  import Modal from './Modal.svelte';
  import { user, clearSession } from '$lib/stores/user.js';
  import { locale, setLocale } from '$lib/stores/locale.js';
  import { siteText } from '$lib/siteCopy.js';
  import { openUpgradeSheet } from '$lib/stores/ui.js';
  import { muted, toggleMute, preloadAll } from '$lib/sounds.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  let accountOpen = $state(false);
  const text = value => siteText(value, $locale);
  function profile() { accountOpen = false; goto('/profile', { state: { returnTo: page.url.pathname + page.url.search } }); }
  function save() { accountOpen = false; openUpgradeSheet(); }
  $effect(() => { page.url.pathname; accountOpen = false; });
</script>
<button class="account" type="button" onclick={() => accountOpen = true} aria-label={text('Your account')} aria-haspopup="dialog">
  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
</button>
{#if accountOpen}
  <Modal label={text('Your account')} on:close={() => accountOpen = false}>
    <div class="account-menu">
      <div class="menu-heading"><h2>{text('Your account')}</h2><button type="button" onclick={() => accountOpen = false} aria-label="Close account menu">{text('Close')}</button></div>
      <p>{$user?.gamesPlayed ?? 0} {text('games')} · {$user?.wins ?? 0} {text('wins')} · {$user?.losses ?? 0} {text('losses')}</p>
      <button type="button" onclick={profile}>{text('Profile & statistics')}</button>
      <button type="button" onclick={() => { accountOpen = false; goto('/treasury', { state: { returnTo: page.url.pathname + page.url.search } }); }}>{text('Treasury')} · {$user?.coins ?? 0} {text('coins')}</button>
      <button type="button" onclick={() => { preloadAll(); toggleMute(); }}>{text('Sound')}: {text($muted ? 'off' : 'on')}</button>
      {#if $user?.isGuest}<button type="button" onclick={save}>{text('Save account')}</button><p>{text('Save before logging out to keep access to this guest profile.')}</p>{/if}
      <nav class="site-links" aria-label={text('Browse the site')}>
        <a href={$locale === 'es' ? '/es' : '/'}>{text('Home')}</a>
        <a href="/puzzle">{text('Daily puzzle')}</a>
        <a href="/strategy/checkers-rules">{text('Rules')}</a>
        <a href="/strategy">{text('Guides')}</a>
        <a href="/changelog">{text('Changelog')}</a><a href="/faq">FAQ</a>
      </nav>
      <div class="languages"><button type="button" aria-pressed={$locale === 'en'} onclick={() => setLocale('en')}>English</button><button type="button" aria-pressed={$locale === 'es'} onclick={() => setLocale('es')}>Español</button></div>
      {#if $locale === 'es'}<p>{text('Some game screens and guides are currently available only in English.')}</p>{/if}
      <button type="button" class="logout" onclick={() => { accountOpen = false; clearSession(); }}>{text('Log out')}</button>
    </div>
  </Modal>
{/if}

<style>
  .account { width: 44px; min-height: 44px; display: grid; place-items: center; background: none; color: var(--text-dim); border: 0; border-radius: 8px; cursor: pointer; }
  .account:hover { color: var(--text); background: var(--surface); }
  .account-menu { display: flex; flex-direction: column; gap: 12px; padding: 20px; background: var(--surface); }
  .menu-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { font-size: 1.1rem; }
  .account-menu p { color: var(--text-dim); font-size: .8rem; }
  .account-menu button, .account-menu a { display: flex; align-items: center; justify-content: center; min-height: 44px; padding: 8px 12px; color: var(--text); background: var(--surface2); border: 0; border-radius: 8px; font: inherit; cursor: pointer; text-decoration: none; }
  .account-menu .logout { color: var(--accent); }
  .site-links { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid var(--surface2); padding-top: 12px; }
  .languages { display: flex; gap: 8px; }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
