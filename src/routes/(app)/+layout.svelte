<script>
  let { children } = $props();
  import { onMount, onDestroy, setContext } from 'svelte';
  import { PROFILE_VIEWER } from '$lib/profileLinks.js';
  import PlayerProfileDialog from '$lib/components/PlayerProfileDialog.svelte';
  import PlayerLink from '$lib/components/PlayerLink.svelte';
  import { gameState, browseTab, connectionStatus, replayData } from '$lib/stores/app.js';
  import { gameScreen, navigation, navigationController, closeReplay, browseTo, dismissNavigationNotice } from '$lib/stores/navigation.js';
  import { afterNavigate } from '$app/navigation';
  import { bootstrapState, retryBootstrap } from '$lib/stores/site.js';
  import { attachBrowserNavigation } from '$lib/browserNavigation.js';
  import { user } from '$lib/stores/user.js';
  import { notice, dismissNotice, showNotice, closeUpgradeSheet } from '$lib/stores/ui.js';
  import { appearance } from '$lib/stores/appearance.js';
  import BoardAppearance from '$lib/components/BoardAppearance.svelte';
  import { session, sendCommand } from '$lib/stores/session.js';
  import { SESSION_NOTICE_TEXT } from '../../../shared/sessionNotices.js';
  const serverNotice = $derived($session.snapshot?.notice);
  const displayedNotice = $derived(serverNotice ? { text: SESSION_NOTICE_TEXT[serverNotice.reason] || 'Your session changed.' } : $notice);
  function dismissDisplayedNotice() {
    if (serverNotice) sendCommand('notice:dismiss', { noticeId: serverNotice.id });
    else dismissNotice();
  }
  import { preloadAll, play } from '$lib/sounds.js';

  // Game layer components
  import GameScreen from '$lib/components/GameScreen.svelte';
  import SpectateScreen from '$lib/components/SpectateScreen.svelte';
  import RoomWaiting from '$lib/components/lobby/RoomWaiting.svelte';
  import SearchScreen from '$lib/components/SearchScreen.svelte';
  import ReplayBoard from '$lib/components/ReplayBoard.svelte';

  // Browse layer components
  import Lobby from '$lib/components/Lobby.svelte';
  import PlayerHeader from '$lib/components/PlayerHeader.svelte';
  import ShopScreen from '$lib/components/ShopScreen.svelte';
  import FriendsScreen from '$lib/components/FriendsScreen.svelte';
  import ProfileScreen from '$lib/components/ProfileScreen.svelte';
  import TreasuryScreen from '$lib/components/TreasuryScreen.svelte';

  // Chrome
  import DevPanel from '$lib/components/DevPanel.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import RoomBanner from '$lib/components/RoomBanner.svelte';
  import SearchBanner from '$lib/components/SearchBanner.svelte';
  import SlidePanel from '$lib/components/panels/SlidePanel.svelte';
  import GlobalChat from '$lib/components/panels/GlobalChat.svelte';
  import LeaderboardPanel from '$lib/components/panels/LeaderboardPanel.svelte';

  let chatOpen = $state(false);
  let lbOpen = $state(false);
  let barsHeight = $state(0);
  let profileUsername = $state(null);
  setContext(PROFILE_VIEWER, username => profileUsername = username);
  $effect(() => { $user?.id; $gameScreen; $session.snapshot?.context?.gameId; $session.snapshot?.context?.roomId; profileUsername = null; });
  $effect(() => { $gameScreen; chatOpen = false; lbOpen = false; });
  $effect(() => {
    if ($session.status !== 'ready' || $session.snapshot?.game?.gameOver || $session.snapshot?.game?.pendingDrawOffer != null) {
      chatOpen = false; lbOpen = false;
    }
  });
  const loading = $derived($bootstrapState.loading);
  const initializing = $derived(loading || (!!$user && !$session.snapshot));
  const kicked = $derived($session.status === 'replaced');
  let detachNavigation;
  afterNavigate(() => {
    if (!detachNavigation) detachNavigation = attachBrowserNavigation();
    else navigationController.locationChanged(window.location.href);
  });


  // Global UI click sound — plays for any button/link tap
  function onGlobalClick(e) {
    preloadAll();
    const el = e.target.closest('button, .btn, a');
    if (el) play('click');
  }

  onMount(() => {
    document.addEventListener('pointerdown', onGlobalClick);
  });
  onDestroy(() => {
    detachNavigation?.();
    dismissNotice();
    if (typeof document !== 'undefined') document.removeEventListener('pointerdown', onGlobalClick);
  });

  const inviteSplash = $derived($bootstrapState.joiningInvite || (!!$navigation.invite && (loading || (!!$user && !$session.snapshot) || $navigation.loading)));
  const inviteSplashHost = $derived($bootstrapState.hostName || $navigation.invite?.hostName);
  $effect(() => {
    const current = $navigation.notice;
    if (current?.kind !== 'invite-joined') return;
    const timer = setTimeout(() => { if ($navigation.notice === current) dismissNavigationNotice(); }, 6000);
    return () => clearTimeout(timer);
  });
  $effect(() => {
    if (!$user) { closeUpgradeSheet(); chatOpen = false; lbOpen = false; }
  });
  function startYourOwn() { dismissNavigationNotice(); if ($user) browseTo('lobby'); }

  const showGameLayer = $derived($gameScreen !== 'none');
  const showTabs = $derived(!showGameLayer && !!$user);
  const showRoom = $derived($gameScreen === 'room-waiting');
</script>

<svelte:head><title>Pure Checkers</title></svelte:head>

{#if kicked}
  <div class="kicked-overlay">
    <div class="card kicked-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <h3>Session Ended</h3>
      <p>You logged in from another device or tab.</p>
      <button class="btn btn-primary" onclick={() => window.location.reload()}>Reconnect</button>
    </div>
  </div>
{/if}

{@render children()}
<DevPanel />
{#if profileUsername && !kicked}
  <PlayerProfileDialog username={profileUsername} viewerId={$user?.id} allowChallenge={$session.status === 'ready' && $session.snapshot?.phase === 'idle' && !$session.pending} onclose={() => profileUsername = null} />
{/if}

<div class="bars" bind:clientHeight={barsHeight}>
  {#if ($session.error || $navigation.error) && !kicked}
    <div class="session-error" role="alert">{$session.error || $navigation.error}</div>
  {/if}
  {#if $navigation.notice?.kind === 'invite-gone' && !kicked}
    <div class="notice-bar" role="status">
      <span>This invite is no longer open. Ask for a new one, or start your own.</span>
      <button type="button" class="notice-action" onclick={startYourOwn}>Start your own</button>
    </div>
  {:else if $navigation.notice?.kind === 'invite-joined' && !kicked}
    <div class="notice-bar" role="status">
      <span>You're in as <PlayerLink username={$user?.username} />.{#if $navigation.notice.hostName} Playing <PlayerLink username={$navigation.notice.hostName} />.{/if}</span>
      <button type="button" class="notice-action" onclick={dismissNavigationNotice}>OK</button>
    </div>
  {/if}
  {#if displayedNotice && !kicked}
    <div class="notice-bar" role="status">
      <span>{displayedNotice.text}</span>
      {#if displayedNotice.action}<button type="button" class="notice-action" onclick={displayedNotice.action.run}>{displayedNotice.action.label}</button>{/if}
      <button type="button" class="notice-action" onclick={dismissDisplayedNotice} disabled={!!serverNotice && ($session.status !== 'ready' || !!$session.pending)}>Dismiss</button>
    </div>
  {/if}
</div>

{#if $connectionStatus !== 'connected' && $user && !loading}
  <div class="connection-bar" class:disconnected={$connectionStatus === 'disconnected'}>
    {#if $connectionStatus === 'reconnecting'}
      <div class="conn-spinner"></div>
      <span>Reconnecting...</span>
    {:else}
      <span>Connection lost</span>
      <button class="conn-retry" onclick={() => window.location.reload()}>Retry</button>
    {/if}
  </div>
{/if}

{#if initializing || inviteSplash || $bootstrapState.error}
  <div class="splash">
    <h1 class="splash-title">Checkers</h1>
    {#if $bootstrapState.error}
      <p class="splash-text" role="alert">{$bootstrapState.error}</p>
      <button type="button" class="btn btn-primary" onclick={() => retryBootstrap()}>Retry</button>
    {:else}
      <div class="splash-spinner"></div>
      {#if inviteSplash}<p class="splash-text" role="status">{inviteSplashHost ? `Joining ${inviteSplashHost}'s game…` : 'Opening your invitation…'}</p>{/if}
    {/if}
  </div>
{/if}

{#if !loading && !inviteSplash && !$bootstrapState.error && !$user}
  <div class="splash"><p role="status">Opening account options…</p></div>
{:else if !initializing && !!$user}
  <!-- Game layer: full-screen overlay when active -->
  {#if $gameScreen === 'game' && $gameState?.state}
    {#key $gameState?.gameId}
    {#if $gameState?.mode === 'spectator'}
      <SpectateScreen view={$gameState} noticeInset={barsHeight ? barsHeight + 52 : 0} />
    {:else}
      <GameScreen view={$gameState} noticeInset={barsHeight ? barsHeight + 52 : 0} />
    {/if}
    {/key}
  {:else if $gameScreen === 'search'}
    <SearchScreen />
  {:else if $gameScreen === 'replay'}
    <div class="replay-overlay">
      <div class="replay-overlay-inner">
        <button class="replay-close" onclick={closeReplay}>Close</button>
        {#if $navigation.loading}
          <p role="status">Loading replay…</p>
        {:else if $replayData}
          <ReplayBoard gameData={$replayData} skin={$appearance.data?.skin?.palette} />
          <BoardAppearance />
        {/if}
      </div>
    </div>
  {/if}

  <!-- Banners (visible on browse layer only) -->
  {#if !showGameLayer}
    <RoomBanner />
    <SearchBanner />
  {/if}

  <!-- Shared app shell: waiting rooms use the same header as browsing screens. -->
  <div class="browse-shell" class:behind={showGameLayer && !showRoom}>
  <PlayerHeader onchat={() => chatOpen = true} onranks={() => lbOpen = true} {chatOpen} ranksOpen={lbOpen} />
  <div class="browse-layer">
    {#if showRoom}
      <RoomWaiting />
    {:else if $browseTab === 'lobby'}
      <Lobby />
    {:else if $browseTab === 'shop'}
      <ShopScreen />
    {:else if $browseTab === 'friends'}
      <FriendsScreen />
    {:else if $browseTab === 'profile'}
      <ProfileScreen />
    {:else if $browseTab === 'treasury'}
      <TreasuryScreen />
    {/if}
  </div>

  {#if showTabs}
    <BottomNav />
  {/if}
  </div>

  <SlidePanel bind:open={chatOpen} side="left" title="Global Chat">
    <GlobalChat visible={chatOpen} />
  </SlidePanel>

  <SlidePanel bind:open={lbOpen} side="right" title="Leaderboard">
    <LeaderboardPanel onnavigate={() => lbOpen = false} />
  </SlidePanel>
{/if}

<style>
  .bars { position: fixed; top: 36px; left: 50%; transform: translateX(-50%); z-index: 1100; display: flex; flex-direction: column; gap: var(--sp-xs); max-width: 90vw; width: max-content; }
  .session-error { padding: 12px 18px; border-radius: 8px; background: var(--surface2); color: var(--text); font-size: var(--fs-caption); }
  .notice-bar { display: flex; align-items: center; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; padding: var(--sp-sm) var(--sp-md); border-radius: 8px; background: var(--surface); border: 1px solid var(--surface2); color: var(--text); font-size: var(--fs-caption); box-shadow: var(--shadow-card); }
  .notice-action { min-height: 36px; padding: 0 var(--sp-sm); background: none; border: 1px solid var(--accent); border-radius: var(--radius-pill); color: var(--accent); font-family: var(--font); font-size: var(--fs-caption); font-weight: 600; cursor: pointer; }
  .notice-action:hover { background: var(--accent-glow); }
  .kicked-overlay {
    position: fixed; inset: 0; z-index: 999;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: var(--sp-md);
  }
  .kicked-box {
    display: flex; flex-direction: column; align-items: center;
    gap: var(--sp-md); padding: var(--sp-xl); text-align: center;
    max-width: 320px; color: var(--text);
  }
  .kicked-box :global(svg) { color: var(--warning); }
  .kicked-box h3 { font-size: var(--fs-heading); }
  .kicked-box p { font-size: var(--fs-caption); color: var(--text-dim); }

  .splash {
    position: fixed; inset: 0; z-index: 200; background: var(--bg);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-lg); animation: splash-fade-in 0.3s ease-out;
  }
  .splash-title { font-size: 2.5rem; font-weight: 700; color: var(--accent); letter-spacing: 3px; }
  .splash-text { font-size: var(--fs-body); color: var(--text-dim); text-align: center; padding: 0 var(--sp-md); }
  .splash-spinner {
    width: 32px; height: 32px; border: 3px solid var(--surface2);
    border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes splash-fade-in { from { opacity: 0; } to { opacity: 1; } }

  /* The viewport owns one content row and one navigation row. Only the
     screen inside the content row scrolls; navigation never overlays it. */
  .browse-shell { position: fixed; inset: 0; height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; background: var(--bg); }
  .browse-shell.behind { visibility: hidden; pointer-events: none; }
  .browse-layer { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
  :global(html:has(.browse-shell)), :global(body:has(.browse-shell)) { height: 100%; overflow: hidden; }


  .connection-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 900;
    display: flex; align-items: center; justify-content: center; gap: var(--sp-sm);
    padding: var(--sp-xs) var(--sp-md);
    background: var(--warning); color: #000;
    font-size: var(--fs-caption); font-weight: 600;
    animation: conn-slide-in 0.3s ease-out;
  }
  .connection-bar.disconnected { background: var(--accent); color: #fff; }
  .conn-spinner {
    width: 12px; height: 12px;
    border: 2px solid rgba(0,0,0,0.3); border-top-color: #000;
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  .conn-retry {
    background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4);
    color: #fff; font-family: var(--font); font-size: 0.6rem; font-weight: 600;
    padding: 2px 8px; border-radius: var(--radius-pill); cursor: pointer;
  }
  .conn-retry:hover { background: rgba(255,255,255,0.3); }
  @keyframes conn-slide-in { from { transform: translateY(-100%); } to { transform: translateY(0); } }

  .replay-overlay {
    position: fixed; inset: 0; z-index: 45;
    background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    padding: var(--sp-md);
  }
  .replay-overlay-inner {
    position: relative; width: 100%; max-width: 500px;
  }
  .replay-close {
    position: absolute; top: calc(-1 * var(--sp-xl)); right: 0;
    background: var(--surface); border: 1px solid var(--surface2);
    color: var(--text-dim); cursor: pointer;
    min-height: 32px; padding: 0 var(--sp-md); border-radius: var(--radius-pill); font-family: var(--font);
    display: flex; align-items: center; justify-content: center;
    transition: color 0.15s;
  }
  .replay-close:hover { color: var(--text); }

</style>
