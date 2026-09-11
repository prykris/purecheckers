<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  import GameHistory from '$lib/components/GameHistory.svelte';
  import PublicIndex from '$lib/components/PublicIndex.svelte';
  let { data } = $props();
</script>

<PublicIndex title="Recent Checkers Games" path="/games" description="Watch completed games between people, move by move. Explore their choices and visit player profiles to see more games.">
  {#if data.games.length}
    <p>Recent human games with at least ten moves and one registered player.</p>
    <GameHistory games={data.games} />
  {:else}
    <p class="empty">No games to show yet. <GameEntryLink  label="Play someone" /> to add a game to the list, or <a href="/strategy">explore the strategy guides</a>.</p>
  {/if}
</PublicIndex>
