<script>
  import { onMount } from 'svelte';
  import { user } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';

  let players = [];

  onMount(async () => {
    try {
      const data = await api.get('/leaderboard');
      players = data.players;
    } catch {}
  });
</script>

<div class="lb-content">
  {#if players.length === 0}
    <p class="empty">No ranked games yet</p>
  {:else}
    <table>
      <thead>
        <tr><th class="rank">#</th><th>Player</th><th>ELO</th><th class="w">W</th><th class="l">L</th></tr>
      </thead>
      <tbody>
        {#each players.slice(0, 20) as p, i}
          <tr class:me={p.id === $user?.id}>
            <td class="rank">{i + 1}</td>
            <td class="name">{p.username}</td>
            <td>{p.elo}</td>
            <td class="w">{p.wins}</td>
            <td class="l">{p.losses}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .lb-content { padding: var(--sp-md); }
  .empty { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; padding: var(--sp-lg); }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: var(--fs-caption); color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; padding: var(--sp-xs) var(--sp-sm); text-align: left; border-bottom: 1px solid var(--surface2); }
  td { padding: var(--sp-xs) var(--sp-sm); font-size: var(--fs-caption); }
  .rank { color: var(--text-dim); width: 28px; }
  .name { font-weight: 500; }
  .w { color: var(--success); }
  .l { color: var(--accent); }
  .me { background: var(--accent-glow); }
</style>
