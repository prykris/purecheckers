<script>
  import { onDestroy, tick } from 'svelte';
  import { api } from '$lib/api.js';
  import { ReadResource } from '$lib/readResource.js';
  import Modal from './Modal.svelte';
  import PlayerFriendship from './PlayerFriendship.svelte';
  import RoomInviteButton from './RoomInviteButton.svelte';
  import PlayerPage from './PlayerPage.svelte';

  let { username, allowChallenge = false, viewerId = null, onclose } = $props();
  let view = $state({ data: null, status: 'idle', error: null });
  let surface;
  const resource = new ReadResource({
    readScope: () => username,
    isCurrent: name => name === username,
    load: async ({ scope, signal }) => {
      try { return await api.get('/leaderboard/player/' + encodeURIComponent(scope), { signal, authToken: null }); }
      catch (error) { if (error.status === 404) throw new Error('This profile is private or no longer available.'); throw error; }
    },
    publish: value => view = value,
  });
  $effect(() => {
    const name = username;
    resource.reset(); void resource.refresh();
    tick().then(() => {
      if (name !== username || !surface?.isConnected) return;
      surface.closest('dialog').scrollTop = 0;
      surface.querySelector('[data-initial-focus]')?.focus({ preventScroll: true });
    });
  });
  onDestroy(() => resource.dispose());
</script>

<Modal label={`${username}'s profile`} maxWidth="640px" on:close={onclose}>
  <div class="profile-dialog" bind:this={surface}>
    <header>
      <span>Player profile</span>
      <button class="btn btn-dark" type="button" data-initial-focus onclick={onclose} aria-label="Close player profile">Close</button>
    </header>
    {#if view.status === 'loading' || view.status === 'idle'}
      <p class="feedback" role="status">Loading {username}'s profile…</p>
    {:else if view.status === 'error'}
      <div class="feedback" role="status"><p>{view.error}</p><button class="btn btn-dark" onclick={() => resource.refresh()}>Retry</button></div>
    {:else if view.data}
      {#key view.data}
        <PlayerPage data={view.data} embedded allowChallenge={allowChallenge && view.data.player.id !== viewerId}>
          {#snippet playerActions(player)}
            {#if viewerId && player.id !== viewerId && !player.isBot}<PlayerFriendship {player}/>{/if}
            <RoomInviteButton {player}/>
          {/snippet}
        </PlayerPage>
      {/key}
    {/if}
  </div>
</Modal>

<style>
  .profile-dialog { background: var(--bg); }
  header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-md); padding: var(--sp-sm) var(--sp-md); background: var(--surface); border-bottom: 1px solid var(--surface2); color: var(--text-dim); font-size: var(--fs-caption); }
  button { min-height: 44px; }
  .feedback { padding: var(--sp-lg); display: grid; gap: var(--sp-md); }
</style>
