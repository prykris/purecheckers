<script>
  import { onMount } from 'svelte';
  import { screen, gameState } from './stores/app.js';
  import { user, token } from './stores/user.js';
  import { api } from './lib/api.js';
  import { connectSocket, getSocket } from './lib/socket.js';

  import AuthScreen from './components/AuthScreen.svelte';
  import Lobby from './components/Lobby.svelte';
  import SearchScreen from './components/SearchScreen.svelte';
  import WheelScreen from './components/WheelScreen.svelte';
  import GameScreen from './components/GameScreen.svelte';
  import ShopScreen from './components/ShopScreen.svelte';
  import FriendsScreen from './components/FriendsScreen.svelte';
  import RoomWaiting from './components/lobby/RoomWaiting.svelte';
  import TreasuryScreen from './components/TreasuryScreen.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import SlidePanel from './components/panels/SlidePanel.svelte';
  import GlobalChat from './components/panels/GlobalChat.svelte';
  import LeaderboardPanel from './components/panels/LeaderboardPanel.svelte';

  const tabScreens = ['lobby', 'shop', 'friends', 'profile'];
  $: showTabs = tabScreens.includes($screen);
  $: showPanelToggles = $screen !== 'auth' && $screen !== 'game' && !loading;

  // When screen becomes lobby and there's a pending join code, auto-join
  $: if ($screen === 'lobby' && pendingJoinCode) {
    const sock = getSocket();
    if (sock) tryJoinFromUrl(sock);
  }

  let chatOpen = false;
  let lbOpen = false;
  let loading = true;

  function tryJoinFromUrl(sock) {
    if (!pendingJoinCode) return;
    const code = pendingJoinCode;
    pendingJoinCode = null;
    // Try to join the room by code
    sock.emit('room:join', { roomId: null, code });
    sock.once('room:joined', ({ room }) => {
      gameState.set({ roomId: room.id, mode: 'room', roomData: room });
      screen.set('room-waiting');
    });
    sock.once('room:error', () => {
      // Room not found or full — just stay on lobby
    });
  }

  // Check for /join/:code in URL and save it for after auth
  let pendingJoinCode = null;
  const joinMatch = window.location.pathname.match(/^\/join\/([A-Z0-9]+)$/i);
  if (joinMatch) {
    pendingJoinCode = joinMatch[1].toUpperCase();
    window.history.replaceState(null, '', '/');
  }

  onMount(async () => {
    if (!$token) {
      $screen = 'auth';
      loading = false;
      return;
    }

    try {
      const data = await api.get('/auth/me');
      $user = data.user;
      const sock = connectSocket();

      if (sock) {
        // Wait for either game:reconnect or a timeout (means no active game)
        const resolved = await Promise.race([
          new Promise(resolve => {
            sock.on('game:reconnect', (data) => {
              gameState.set({
                gameId: data.gameId,
                myColor: data.yourColor,
                opponentName: data.opponentName,
                opponentId: data.opponentId,
                mode: 'online',
                reconnectState: data.state
              });
              resolve('game');
            });
          }),
          new Promise(resolve => setTimeout(() => resolve('lobby'), 1500))
        ]);

        if (resolved === 'game') {
          screen.set('game');
        } else {
          screen.set('lobby');
          // Check for /join/:code in URL
          tryJoinFromUrl(sock);
        }
      } else {
        $screen = 'lobby';
      }
    } catch {
      $token = null;
      $user = null;
      $screen = 'auth';
    }

    // Fade out splash
    loading = false;
  });
</script>

{#if loading}
  <div class="splash">
    <h1 class="splash-title">Checkers</h1>
    <div class="splash-spinner"></div>
  </div>
{/if}

<div class="app" class:hidden={loading}>
  {#if $screen === 'auth'}
    <AuthScreen />
  {:else if $screen === 'lobby'}
    <Lobby />
  {:else if $screen === 'search'}
    <SearchScreen />
  {:else if $screen === 'wheel'}
    <WheelScreen />
  {:else if $screen === 'game'}
    <GameScreen />
  {:else if $screen === 'shop'}
    <ShopScreen />
  {:else if $screen === 'friends'}
    <FriendsScreen />
  {:else if $screen === 'room-waiting'}
    <RoomWaiting />
  {:else if $screen === 'treasury'}
    <TreasuryScreen />
  {/if}

  {#if showTabs}
    <BottomNav />
  {/if}

  {#if showPanelToggles}
    <button class="edge-toggle left" on:click={() => chatOpen = !chatOpen} title="Global Chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    </button>
    <button class="edge-toggle right" on:click={() => lbOpen = !lbOpen} title="Leaderboard">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
    </button>
  {/if}

  <SlidePanel bind:open={chatOpen} side="left" title="Global Chat">
    <GlobalChat visible={chatOpen} />
  </SlidePanel>

  <SlidePanel bind:open={lbOpen} side="right" title="Leaderboard">
    <LeaderboardPanel />
  </SlidePanel>
</div>

<style>
  .splash {
    position: fixed; inset: 0; z-index: 200;
    background: var(--bg);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: var(--sp-lg);
    animation: splash-fade-in 0.3s ease-out;
  }
  .splash-title {
    font-size: 2.5rem; font-weight: 700;
    color: var(--accent); letter-spacing: 3px;
  }
  .splash-spinner {
    width: 32px; height: 32px;
    border: 3px solid var(--surface2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes splash-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .app { transition: opacity 0.3s ease; }
  .app.hidden { opacity: 0; pointer-events: none; }

  .edge-toggle {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    z-index: 55;
    background: var(--surface);
    border: 1px solid var(--surface2);
    color: var(--text-dim);
    cursor: pointer;
    padding: var(--sp-sm) var(--sp-xs);
    transition: color 0.15s, background 0.15s;
  }
  .edge-toggle:hover { color: var(--text); background: var(--surface2); }
  .edge-toggle.left {
    left: 0;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    border-left: none;
  }
  .edge-toggle.right {
    right: 0;
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    border-right: none;
  }

  @media (max-width: 600px) {
    .edge-toggle { padding: var(--sp-xs) 3px; }
    .edge-toggle svg { width: 14px; height: 14px; }
  }
</style>
