<script>
  import { onMount, onDestroy, untrack } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { user, clearSession, beginAuthentication, establishSession, isCurrentSession } from '$lib/stores/user.js';
  import { bootstrapState, retryBootstrap } from '$lib/stores/site.js';
  import { locale } from '$lib/stores/locale.js';
  import { siteText } from '$lib/siteCopy.js';
  import { authHref, safeReturnTo } from '$lib/siteNavigation.js';
  import { AuthenticationFlow } from '$lib/authenticationFlow.js';
  import { api } from '$lib/api.js';
  import { track } from '$lib/analytics.js';
  import UpgradeSheet from './UpgradeSheet.svelte';

  let { initialView = 'guest' } = $props();
  let state = $state({ loading: false, error: '' });
  let username = $state(''), email = $state(''), password = $state(''), guestName = $state('');
  let guestNameEdited = false;
  const language = $derived(page.url.searchParams.get('lang') === 'es' ? 'es' : $locale);
  const text = label => siteText(label, language);
  const destination = $derived(safeReturnTo(page.url.searchParams.get('returnTo')));
  const link = view => authHref(view, destination, language);
  const flow = new AuthenticationFlow({ initialView: untrack(() => initialView), api, beginAuthentication, establishSession, isCurrentSession,
    publish: value => state = value, onGuestCreated: source => track('guest_created', { source }) });
  $effect(() => { if (initialView !== 'recovery') flow.switchView(initialView); });
  onMount(() => { if (initialView === 'guest') flow.suggestName({ untouched: () => !guestNameEdited, apply: value => guestName = value }); });
  onDestroy(() => flow.dispose());
  $effect(() => {
    if (!$bootstrapState.loading && $user && (initialView === 'guest' || (initialView === 'register' && !$user.isGuest))) goto(destination, { replaceState: true });
  });
  async function submit() {
    const success = await flow.submit({ username, email, password, guestName });
    if (success) { password = ''; await goto(destination, { replaceState: true }); }
  }
</script>

<svelte:head><title>{text(initialView === 'login' ? 'Log in' : initialView === 'register' ? 'Create account' : initialView === 'recovery' ? 'Password recovery' : 'Play as guest')} — Pure Checkers</title></svelte:head>

<main class="auth-page">
  <div class="auth-wrapper">
    <nav class="auth-nav" aria-label="Account navigation">
      <a href={language === 'es' ? '/es' : '/'}>← {text('Home')}</a>
      {#if destination !== '/lobby'}<a href={destination}>{language === 'es' ? 'Volver' : 'Back'}</a>{/if}
    </nav>
    <a class="logo" href={language === 'es' ? '/es' : '/'}><span>Pure</span> Checkers</a>
    {#if $bootstrapState.loading}
      <p role="status">{language === 'es' ? 'Comprobando cuenta…' : 'Checking account…'}</p>
    {:else if $bootstrapState.error}
      <p role="alert">{$bootstrapState.error}</p><button class="btn btn-dark" onclick={retryBootstrap}>{language === 'es' ? 'Reintentar' : 'Retry'}</button>
    {:else if initialView === 'recovery'}
      <h1>{text('Password recovery')}</h1>
      <p>{text('Email delivery is not connected yet, so password-reset emails are currently unavailable.')}</p>
      <a href={link('login')}>{text('Back to log in')}</a>
    {:else if initialView === 'register' && $user?.isGuest}
      <UpgradeSheet inline />
    {:else if $user && !$user.isGuest}
      <h1>{$user.username}</h1>
      <a class="btn btn-primary" href={destination}>{text('Return to game')}</a>
      <button class="switch-link" onclick={clearSession}>{text('Log out')}</button>
    {:else}
      <h1>{text(initialView === 'guest' ? 'Pick a name and play' : initialView === 'login' ? 'Welcome back' : 'Create your account')}</h1>
      {#if $user?.isGuest && initialView === 'login'}
        <p>{text('Save this guest profile before switching accounts if you want to keep its progress.')} <a href={link('register')}>{text('Save account')}</a></p>
      {/if}
      <form class="form-area" onsubmit={event => { event.preventDefault(); submit(); }}>
        {#if initialView === 'guest'}
          <label>{text('Nickname')}<input class="input name-input" type="text" bind:value={guestName} maxlength="20" disabled={state.loading} autocomplete="nickname" oninput={() => guestNameEdited = true} /></label>
        {:else}
          {#if initialView === 'register'}<label>{text('Username')}<input class="input" type="text" bind:value={username} maxlength="16" disabled={state.loading} required autocomplete="username" /></label>{/if}
          <label>{text('Email')}<input class="input" type="email" bind:value={email} disabled={state.loading} required autocomplete="email" /></label>
          <label>{text('Password')}<input class="input" type="password" bind:value={password} disabled={state.loading} minlength="6" required autocomplete={initialView === 'login' ? 'current-password' : 'new-password'} /></label>
        {/if}
        {#if state.error}<p class="error" role="alert">{state.error}</p>{/if}
        <button class="btn btn-primary play-btn" type="submit" disabled={state.loading}>{text(state.loading ? (initialView === 'guest' ? 'Starting…' : initialView === 'login' ? 'Signing in…' : 'Creating account…') : initialView === 'guest' ? 'Play' : initialView === 'login' ? 'Log in' : 'Create account')}</button>
      </form>
      {#if initialView === 'login'}<a href={link('recovery')}>{text('Forgot password?')}</a>{/if}
      <nav class="switch-row" aria-label="Account options">
        {#if initialView !== 'guest'}<a href={link('guest')}>{text('Play as guest')}</a>{/if}
        {#if initialView !== 'login'}<a href={link('login')}>{text('Log in')}</a>{/if}
        {#if initialView !== 'register'}<a href={link('register')}>{text('Create account')}</a>{/if}
      </nav>
    {/if}
    {#if language === 'es'}<p class="language-note">{text('Some game screens and guides are currently available only in English.')}</p>{/if}
  </div>
</main>

<style>
  .auth-page { min-height: 100dvh; display: grid; align-items: center; justify-items: center; padding: 24px 16px; background: radial-gradient(ellipse at 50% 30%, var(--bg-subtle), var(--bg)); }
  .auth-wrapper { display: flex; flex-direction: column; align-items: stretch; gap: 20px; width: 100%; max-width: 360px; }
  .auth-nav { display: flex; justify-content: space-between; gap: 12px; }
  .auth-nav a, .switch-row a { min-height: 44px; display: inline-flex; align-items: center; }
  .logo { font-size: var(--fs-title); font-weight: 700; color: var(--text); text-align: center; text-decoration: none; }
  .logo span { color: var(--accent); }
  h1 { font-size: 1.2rem; text-align: center; }
  p { color: var(--text-dim); font-size: var(--fs-caption); line-height: 1.6; }
  .form-area { display: flex; flex-direction: column; gap: 12px; }
  label { display: grid; gap: 6px; font-size: var(--fs-caption); }
  .play-btn { min-height: 48px; width: 100%; }
  .switch-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 20px; font-size: var(--fs-caption); }
  .switch-link { border: 0; background: none; color: var(--text-dim); font: inherit; cursor: pointer; min-height: 44px; }
  .error { color: var(--accent); }
  .language-note { text-align: center; }
</style>
