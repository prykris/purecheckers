<script>
  import { onMount } from 'svelte';
  import { screen } from './stores/app.js';
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
  import FriendGameScreen from './components/FriendGameScreen.svelte';
  import RoomWaiting from './components/lobby/RoomWaiting.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import SlidePanel from './components/panels/SlidePanel.svelte';
  import GlobalChat from './components/panels/GlobalChat.svelte';
  import LeaderboardPanel from './components/panels/LeaderboardPanel.svelte';

  const tabScreens = ['lobby', 'shop', 'friends', 'profile'];
  $: showTabs = tabScreens.includes($screen);
  $: showPanelToggles = $screen !== 'auth' && $screen !== 'game';

  let chatOpen = false;
  let lbOpen = false;

  onMount(async () => {
    if ($token) {
      try {
        const data = await api.get('/auth/me');
        $user = data.user;
        const sock = connectSocket();
        $screen = 'lobby';

        // Listen for active game reconnect
        if (sock) {
          sock.on('game:reconnect', (data) => {
            gameState.set({
              gameId: data.gameId,
              myColor: data.yourColor,
              opponentName: data.opponentName,
              opponentId: data.opponentId,
              mode: 'online',
              reconnectState: data.state
            });
            screen.set('game');
          });
        }
      } catch {
        $token = null;
        $user = null;
        $screen = 'auth';
      }
    }
  });
</script>

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
{:else if $screen === 'friend-game'}
  <FriendGameScreen />
{:else if $screen === 'room-waiting'}
  <RoomWaiting />
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

<style>
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
