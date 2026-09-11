<script>
  import PlayerLink from '../PlayerLink.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { ReadResource } from '$lib/readResource.js';
  import { browseTo } from '$lib/stores/navigation.js';
  import { user } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';
  export let onnavigate = () => {};
  function continuePlaying() { browseTo($user?.isGuest ? 'profile' : 'lobby'); onnavigate(); }

  let list = { data: null, status: 'idle', error: null };
  const resource = new ReadResource({
    readScope: () => null, isCurrent: () => true,
    load: async ({ signal }) => {
      const data = await api.get('/leaderboard', { signal, authToken: null });
      if (!Array.isArray(data?.players)) throw Error('Could not load the leaderboard. Please retry.');
      return data.players;
    }, publish: value => list = value
  });
  $: players = list.data || [];
  onMount(() => { void resource.refresh(); });
  onDestroy(() => resource.dispose());
</script>

<div class="lb-content">
  {#if list.status === 'idle' || list.status === 'loading'}
    <p class="empty">Loading…</p>
  {:else if list.status === 'error'}
    <div class="empty" role="status"><p>Could not load the leaderboard.</p><button class="btn btn-dark btn-small" on:click={() => resource.refresh()}>Retry</button></div>
  {:else if players.length === 0}
    <div class="empty"><p>Ranked games between registered players appear here.</p><button class="btn btn-dark btn-small" on:click={continuePlaying}>{$user?.isGuest ? 'Save your account' : 'Find an opponent'}</button></div>
  {:else}
    <table>
      <thead>
        <tr><th class="rank">#</th><th>Player</th><th>ELO</th><th class="w">W</th><th class="l">L</th></tr>
      </thead>
      <tbody>
        {#each players.slice(0, 20) as p, i}
          <tr class:me={p.id === $user?.id}>
            <td class="rank">{i + 1}</td>
            <td class="name"><PlayerLink username={p.username} profileUrl={p.profileUrl} /></td>
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
  .empty { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; padding: var(--sp-lg); line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: var(--fs-caption); color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; padding: var(--sp-xs) var(--sp-sm); text-align: left; border-bottom: 1px solid var(--surface2); }
  td { padding: var(--sp-xs) var(--sp-sm); font-size: var(--fs-caption); }
  .rank { color: var(--text-dim); width: 28px; }
  .name { font-weight: 500; }
  .w { color: var(--success); }
  .l { color: var(--accent); }
  .me { background: var(--accent-glow); }
</style>
