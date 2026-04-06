<script>
  import { onMount } from 'svelte';
  import { phase, gameState, browseTab, gameOverVisible, connectionStatus, replayData } from '$lib/stores/app.js';
  import { gameScreen, recompute, clearScreenOverride } from '$lib/stores/gameScreen.js';
  import { user, token } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';
  import { getSocket } from '$lib/socket.js';
  import { initSocket } from '$lib/socketService.js';
  import { muted, toggleMute, preloadAll, play } from '$lib/sounds.js';

  // Game layer components
  import GameScreen from '$lib/components/GameScreen.svelte';
  import SpectateScreen from '$lib/components/SpectateScreen.svelte';
  import WheelScreen from '$lib/components/WheelScreen.svelte';
  import RoomWaiting from '$lib/components/lobby/RoomWaiting.svelte';
  import SearchScreen from '$lib/components/SearchScreen.svelte';
  import ReplayBoard from '$lib/components/ReplayBoard.svelte';

  // Browse layer components
  import AuthScreen from '$lib/components/AuthScreen.svelte';
  import Lobby from '$lib/components/Lobby.svelte';
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
  let loading = $state(true);
  let kicked = $state(false);
  let socketInitialized = false;

  // Recompute gameScreen whenever phase or gameOverVisible changes
  $effect(() => {
    // Read both stores to establish dependency
    $phase;
    $gameOverVisible;
    recompute();
  });

  // URL sync — reflect state, never drive it
  $effect(() => {
    const gs = $gameScreen;
    const tab = $browseTab;
    const path = gs !== 'none' ? `/${gs}` : `/${tab}`;
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      history.replaceState({}, '', path);
    }
  });

  // When token+user are set (fresh login), connect socket
  $effect(() => {
    if ($token && $user && !socketInitialized) {
      socketInitialized = true;
      doInitSocket();
    }
  });

  async function doInitSocket() {
    loading = true;
    await initSocket();
    const sock = getSocket();
    if (sock) sock.on('session:kicked', () => { kicked = true; });
    loading = false;
  }

  // Apply saved theme on load (before anything renders)
  function restoreTheme() {
    const defaults = {
      '--bg':'#1c1917','--bg-subtle':'#231f1b','--surface':'#292524','--surface2':'#3d3530',
      '--accent':'#ef4444','--accent2':'#a855f7','--text':'#fafaf9','--text-dim':'#a8a29e',
      '--board-light':'#d4a76a','--board-dark':'#7c5e3c','--gold':'#fbbf24','--success':'#22c55e','--warning':'#f59e0b'
    };
    const themeName = typeof localStorage !== 'undefined' && localStorage.getItem('checkers_theme');
    if (!themeName || themeName === 'Default') {
      Object.entries(defaults).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
      return;
    }
    // Theme data is stored in Lobby — we just need to apply the CSS vars
    // Import the theme list from a shared location would be better, but for now
    // we read the saved vars directly from localStorage
    const savedVars = typeof localStorage !== 'undefined' && localStorage.getItem('checkers_theme_vars');
    if (savedVars) {
      try {
        const vars = JSON.parse(savedVars);
        Object.entries(defaults).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
        Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
      } catch {}
    }
  }
  restoreTheme();

  // Global UI click sound — plays for any button/link tap
  function onGlobalClick(e) {
    preloadAll();
    const el = e.target.closest('button, .btn, a');
    if (el) play('click');
  }

  onMount(async () => {
    document.addEventListener('pointerdown', onGlobalClick);
    if (!$token) {
      loading = false;
      return;
    }

    try {
      const data = await api.get('/auth/me');
      $user = data.user;
      socketInitialized = true;
      await doInitSocket();
    } catch {
      $token = null;
      $user = null;
      loading = false;
    }
  });

  const showGameLayer = $derived($gameScreen !== 'none');
  const showTabs = $derived(!showGameLayer && !!$user);
  const showPanelToggles = $derived(!showGameLayer && !!$user && !loading);
</script>

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

<DevPanel />

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

{#if loading}
  <div class="splash">
    <h1 class="splash-title">Checkers</h1>
    <div class="splash-spinner"></div>
  </div>
{/if}

{#if !loading && !$user}
  <AuthScreen />
{:else if !loading}
  <!-- Game layer: full-screen overlay when active -->
  {#if $gameScreen === 'wheel'}
    <WheelScreen />
  {:else if $gameScreen === 'game'}
    {#if $gameState?.mode === 'spectator'}
      <SpectateScreen />
    {:else}
      <GameScreen />
    {/if}
  {:else if $gameScreen === 'room-waiting'}
    <RoomWaiting />
  {:else if $gameScreen === 'search'}
    <SearchScreen />
  {:else if $gameScreen === 'replay'}
    <div class="replay-overlay">
      <div class="replay-overlay-inner">
        <button class="replay-close" title="Close replay" onclick={() => { $replayData = null; clearScreenOverride(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        {#if $replayData}
          <ReplayBoard gameData={$replayData} />
        {/if}
      </div>
    </div>
  {/if}

  <!-- Banners (visible on browse layer only) -->
  {#if !showGameLayer}
    <RoomBanner />
    <SearchBanner />
  {/if}

  <!-- Browse layer: always rendered, hidden when game layer active -->
  <div class="browse-layer" class:behind={showGameLayer}>
    {#if $browseTab === 'lobby'}
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

  {#if showPanelToggles}
    <button class="edge-toggle left" onclick={() => chatOpen = !chatOpen} title="Global Chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    </button>
    <button class="edge-toggle right" onclick={() => lbOpen = !lbOpen} title="Leaderboard">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
    </button>
    <button class="sound-toggle" class:muted={$muted} onclick={() => { preloadAll(); toggleMute(); }} title="{$muted ? 'Unmute' : 'Mute'}">
      {#if $muted}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
      {/if}
    </button>
  {/if}

  <SlidePanel bind:open={chatOpen} side="left" title="Global Chat">
    <GlobalChat visible={chatOpen} />
  </SlidePanel>

  <SlidePanel bind:open={lbOpen} side="right" title="Leaderboard">
    <LeaderboardPanel />
  </SlidePanel>
{/if}

<style>
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
  .splash-spinner {
    width: 32px; height: 32px; border: 3px solid var(--surface2);
    border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes splash-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .browse-layer { transition: opacity 0.2s ease; }
  .browse-layer.behind { visibility: hidden; pointer-events: none; position: absolute; }

  .edge-toggle {
    position: fixed; top: 50%; transform: translateY(-50%); z-index: 55;
    background: var(--surface); border: 1px solid var(--surface2);
    color: var(--text-dim); cursor: pointer; padding: var(--sp-sm) var(--sp-xs);
    transition: color 0.15s, background 0.15s;
  }
  .edge-toggle:hover { color: var(--text); background: var(--surface2); }
  .edge-toggle.left { left: 0; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; border-left: none; }
  .edge-toggle.right { right: 0; border-radius: var(--radius-sm) 0 0 var(--radius-sm); border-right: none; }

  @media (max-width: 600px) {
    .edge-toggle { padding: var(--sp-xs) 3px; }
    .edge-toggle :global(svg) { width: 14px; height: 14px; }
  }

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
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: color 0.15s;
  }
  .replay-close:hover { color: var(--text); }

  .sound-toggle {
    position: fixed; bottom: calc(var(--tab-height) + var(--sp-sm) + env(safe-area-inset-bottom, 0px));
    right: var(--sp-sm); z-index: 55;
    background: var(--surface); border: 1px solid var(--surface2);
    color: var(--text-dim); cursor: pointer;
    padding: var(--sp-xs); border-radius: 50%;
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    transition: color 0.15s, background 0.15s;
  }
  .sound-toggle:hover { color: var(--text); background: var(--surface2); }
  .sound-toggle.muted { opacity: 0.5; }
</style>
