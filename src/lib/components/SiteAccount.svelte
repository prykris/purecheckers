<script>
  import { onMount } from 'svelte';
  let mounted = $state(false);
  onMount(() => mounted = true);
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { user, token } from '$lib/stores/user.js';
  import { bootstrapState, retryBootstrap } from '$lib/stores/site.js';
  import { locale } from '$lib/stores/locale.js';
  import { authHref } from '$lib/siteNavigation.js';
  import { siteText } from '$lib/siteCopy.js';
  import AccountMenu from './AccountMenu.svelte';
  import GameEntryLink from './GameEntryLink.svelte';
  let { language = null, navigation = null } = $props();
  const lang = $derived(language || $locale);
  const destination = $derived(page.url.pathname + (mounted ? page.url.search + page.url.hash : ''));
</script>

<div class="site-account" aria-label={siteText('Your account', lang)}>
  {#if $user}
    <a class="identity" href="/profile" onclick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); goto('/profile', { state: { returnTo: destination } }); } }}>{$user.username}</a>
    <span class="rating">{$user.elo} ELO · {$user.coins ?? 0} {lang === 'es' ? 'monedas' : 'coins'}</span>
    <GameEntryLink language={lang} class="resume-link" />
    <div class="account-links guest-save">
      {#if $user.isGuest}<a href={authHref('register', destination, lang)}>{siteText('Save account', lang)}</a>{/if}
    </div>
  {:else if $token && $bootstrapState.error}
    <span role="status">{lang === 'es' ? 'No se pudo comprobar la cuenta.' : 'Could not check your account.'}</span>
    <button type="button" onclick={retryBootstrap}>{lang === 'es' ? 'Reintentar' : 'Retry'}</button>
  {:else}
    <div class="account-links">
      <a href={authHref('login', destination, lang)}>{siteText('Log in', lang)}</a>
      <a href={authHref('register', destination, lang)}>{siteText('Create account', lang)}</a>
    </div>
    {#if $token && $bootstrapState.loading}<span role="status">{lang === 'es' ? 'Comprobando cuenta…' : 'Checking account…'}</span>{/if}
  {/if}
  <div class="menu-slot"><AccountMenu {navigation}/></div>
</div>

<style>
  .site-account { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 16px; padding: 12px 16px; border-bottom: 1px solid var(--surface2); font-size: var(--fs-caption); }
  .identity { color: var(--text); font-weight: 600; overflow-wrap: anywhere; }
  .rating { color: var(--text-dim); }
  .account-links { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; }
  button { color: var(--text-dim); font: inherit; background: none; border: 0; cursor: pointer; text-decoration: underline; min-height: 32px; }
  .site-account :global(a) { display: inline-flex; align-items: center; min-height: 32px; }
  .menu-slot{flex:none;}
  @media (max-width:899px){
    .site-account{display:flex;flex-wrap:nowrap;justify-content:flex-start;gap:10px;min-height:64px;padding:8px 12px;padding-top:max(8px,env(safe-area-inset-top));}
    .identity{display:block!important;min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:44px;}
    .rating,.guest-save{display:none;}
    .site-account :global(.resume-link){flex:none;white-space:nowrap;min-height:44px;}
    .menu-slot{margin-left:auto;}
    .account-links{flex-wrap:nowrap;gap:12px;min-width:0;}
    .site-account :global(a){min-height:44px;}
    .site-account > span[role=status]{min-width:0;font-size:11px;}
  }
</style>
