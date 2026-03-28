<script>
  import { onMount } from 'svelte';
  import { screen } from './stores/app.js';
  import { user, token } from './stores/user.js';
  import { api } from './lib/api.js';
  import { connectSocket } from './lib/socket.js';

  import AuthScreen from './components/AuthScreen.svelte';
  import Lobby from './components/Lobby.svelte';
  import SearchScreen from './components/SearchScreen.svelte';
  import WheelScreen from './components/WheelScreen.svelte';
  import GameScreen from './components/GameScreen.svelte';
  import ShopScreen from './components/ShopScreen.svelte';
  import FriendsScreen from './components/FriendsScreen.svelte';
  import BottomNav from './components/BottomNav.svelte';

  const tabScreens = ['lobby', 'shop', 'friends', 'profile'];
  $: showTabs = tabScreens.includes($screen);

  onMount(async () => {
    if ($token) {
      try {
        const data = await api.get('/auth/me');
        $user = data.user;
        connectSocket();
        $screen = 'lobby';
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
{/if}

{#if showTabs}
  <BottomNav />
{/if}
