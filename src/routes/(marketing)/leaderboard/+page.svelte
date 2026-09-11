<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  import PlayerLink from '$lib/components/PlayerLink.svelte';
  import PublicIndex from '$lib/components/PublicIndex.svelte';
  let { data } = $props();
</script>

<PublicIndex title="Checkers Leaderboard — Top Players by ELO" path="/leaderboard" description="Top checkers players by ELO. Compare ratings, wins and losses, and explore the games behind each player's record.">
  {#if data.players.length}
    <!-- Horizontal overflow must be keyboard-scrollable on narrow screens. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="table-scroll" tabindex="0" role="region" aria-label="Player rankings">
      <table>
        <caption>Top 50 registered players with at least one completed game</caption>
        <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">ELO</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Games</th></tr></thead>
        <tbody>{#each data.players as player, i (player.id)}
          <tr><td>{i + 1}</td><th scope="row"><PlayerLink username={player.username} profileUrl={player.profileUrl} /></th><td>{player.elo}</td><td>{player.wins}</td><td>{player.losses}</td><td>{player.gamesPlayed}</td></tr>
        {/each}</tbody>
      </table>
    </div>
  {:else}
    <p class="empty">The leaderboard restarted with our September 2026 relaunch. <GameEntryLink  label="Play a game" /> and save your account to start building your record.</p>
  {/if}
</PublicIndex>
