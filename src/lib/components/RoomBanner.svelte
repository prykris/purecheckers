<script>
  import { activeRoom } from '$lib/stores/app.js';
  import { gameScreen } from '$lib/stores/navigation.js';
  import RoomActivity from './RoomActivity.svelte';
</script>
{#if $activeRoom && $gameScreen === 'none'}<RoomActivity floating/>{/if}
