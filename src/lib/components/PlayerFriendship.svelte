<script>
  import { onMount } from 'svelte';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';
  import { getSocket } from '$lib/socket.js';
  import { FriendsClient, bindFriendsClient } from '$lib/friendsClient.js';
  import { friendshipWith } from '../../../shared/roomFriendship.js';
  import { initializeFriendshipActions, performFriendshipAction, retryFriendshipAction, friendshipState } from '$lib/friends/actions.js';

  let { player } = $props();
  let view = $state({ data: null, status: 'idle' });
  const client = new FriendsClient({ readScope: captureSession, isCurrent: isCurrentSession,
    load: ({ scope, signal }) => api.get('/friends', { authToken: scope.token, signal }),
    perform: performFriendshipAction, publish: value => { view = value; } });
  const relationship = $derived(friendshipWith(view.data, player.id));
  const unavailable = $derived(view.status !== 'ready' || !!view.action || !!$friendshipState.pending || $friendshipState.blocked || $friendshipState.busy);

  onMount(() => {
    initializeFriendshipActions();
    return bindFriendsClient({ client, user, capture: captureSession, socket: getSocket(),
      isVisible: () => !document.hidden, isBusy: () => $friendshipState.busy,
      onFocus: refresh => { window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); } });
  });
  function add() {
    if (unavailable) return;
    void client.act(relationship.kind === 'incoming' ? 'accept' : 'request', relationship.kind === 'incoming'
      ? { friendshipId: relationship.id, displayName: player.username }
      : { userId: player.id, displayName: player.username });
  }
  async function confirm() {
    const scope = captureSession(), kind = $friendshipState.pending?.kind;
    try {
      const receipt = await retryFriendshipAction();
      if (receipt && isCurrentSession(scope)) await client.confirmed(kind);
    } catch { /* The shared journal retains uncertainty for retry. */ }
  }
</script>

<div class="friendship-actions" role="group" aria-label={`Friendship with ${player.username}`}>
  {#if view.status === 'loading' && !view.data}<span role="status">Checking friendship…</span>{/if}
  {#if view.error || view.readError}<p class="error" role="status">{view.error || view.readError}</p>{/if}
  {#if $friendshipState.pending}
    <button type="button" class="btn btn-dark btn-small" disabled={$friendshipState.busy || $friendshipState.blocked || !!view.action} onclick={confirm}>Confirm friendship action</button>
  {:else if relationship.kind === 'none' || relationship.kind === 'incoming'}
    <button type="button" class="btn btn-dark btn-small" disabled={unavailable} onclick={add}>{view.action ? 'Confirming…' : relationship.kind === 'incoming' ? 'Accept friend request' : 'Add friend'}</button>
  {:else if relationship.kind === 'friends'}
    <span class="confirmed" role="status">Friends</span>
  {:else if relationship.kind === 'outgoing'}
    <span role="status">Friend request sent</span>
  {/if}
  {#if view.status === 'error'}<button type="button" class="btn btn-dark btn-small" onclick={() => client.refresh()}>Retry</button>{/if}
  {#if $friendshipState.error}<p class="error" role="status">{$friendshipState.error}</p>{/if}
</div>

<style>
  .friendship-actions { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:var(--sp-sm); font-size:var(--fs-caption); color:var(--text-dim); }
  button { min-height:44px; font-family:var(--font); }
  .confirmed { color:var(--success); }
  .error { color:var(--accent); flex-basis:100%; }
</style>
