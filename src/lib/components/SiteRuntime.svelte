<script>
  import { onMount, onDestroy } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authHref } from '$lib/siteNavigation.js';
  import { locale } from '$lib/stores/locale.js';
  import { user, token, clearSession, establishSession, captureSession } from '$lib/stores/user.js';
  import { session } from '$lib/stores/session.js';
  import { bootstrapState, bindBootstrapRetry } from '$lib/stores/site.js';
  import { api, fetchInvite, refreshSession } from '$lib/api.js';
  import { AppBootstrap } from '$lib/appBootstrap.js';
  import { parseLocation } from '$lib/navigationPolicy.js';
  import { navigationController } from '$lib/stores/navigation.js';
  import { initSocket, detachSocketListeners } from '$lib/socketService.js';
  import { disconnectSocket } from '$lib/socket.js';
  import { startAppearance } from '$lib/stores/appearance.js';
  import { hints } from '$lib/hints.js';
  import { track } from '$lib/analytics.js';
  import { showNotice, closeUpgradeSheet } from '$lib/stores/ui.js';
  import UpgradeSheet from './UpgradeSheet.svelte';

  const readInvite = () => { const intent = parseLocation(location.href); return intent.kind === 'invite' ? intent.code : null; };
  const bootstrap = new AppBootstrap({
    readToken: () => $token, readSessionGeneration: () => captureSession().generation, readInvite, restoreSession: refreshSession,
    clearSession, checkInvite: fetchInvite, createGuest: options => api.post('/guest', {}, { ...options, authToken: null }),
    acceptGuest: data => { establishSession(data); track('guest_created', { source: 'invite' }); },
    abandonInvite: code => navigationController.abandonInvite(code), showNotice,
    publish: patch => bootstrapState.update(value => ({ ...value, ...patch }))
  });
  let started = false, previousInvite = null, preparing = Promise.resolve();
  async function locationChanged(retry = false) {
    const href = location.href, code = readInvite();
    if (retry || !started || (!$token && code && code !== previousInvite)) {
      started = true;
      preparing = bootstrap.start();
    }
    previousInvite = code;
    await preparing;
    // The site owner decides entry only after invitation/account preparation.
    // A route that was left while preparing cannot redirect the new page.
    if (location.href === href && page.route.id?.startsWith('/(app)')
      && !$bootstrapState.loading && !$bootstrapState.error && !$user) {
      await goto(authHref('guest', page.url.pathname + page.url.search, $locale), { replaceState: true });
    }
  }
  afterNavigate(() => { void locationChanged(); });
  const identity = $derived($token && $user?.id ? $user.id : null);
  $effect(() => {
    if (!identity) return;
    initSocket();
    return () => { detachSocketListeners(); disconnectSocket(); };
  });
  $effect(() => { if (!$user) closeUpgradeSheet(); });
  onMount(() => {
    void locationChanged();
    const unbind = bindBootstrapRetry(() => locationChanged(true));
    const stopAppearance = startAppearance();
    const unbindHints = hints.bindSession(session);
    return () => { unbind(); stopAppearance(); unbindHints(); closeUpgradeSheet(); };
  });
  onDestroy(() => bootstrap.dispose());
</script>

{#key $user?.id}<UpgradeSheet />{/key}
