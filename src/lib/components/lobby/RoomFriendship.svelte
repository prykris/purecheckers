<script>
  import PlayerLink from '../PlayerLink.svelte';
  import { onMount } from 'svelte';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';
  import { getSocket } from '$lib/socket.js';
  import { FriendsClient, bindFriendsClient } from '$lib/friendsClient.js';
  import { friendshipWith } from '../../../../shared/roomFriendship.js';
  import { initializeFriendshipActions, performFriendshipAction, retryFriendshipAction, friendshipState } from '$lib/friends/actions.js';

  let { opponent, suggested = false, expanded = false, onclose } = $props();
  let view = $state({ data: null, status: 'idle' });
  let dismissed = $state(false);
  const client = new FriendsClient({ readScope: captureSession, isCurrent: isCurrentSession,
    load: ({ scope, signal }) => api.get('/friends', { authToken: scope.token, signal }),
    perform: performFriendshipAction, publish: value => { view = value; } });
  const relationship = $derived(friendshipWith(view.data, opponent.userId));
  const visible = $derived(expanded || (suggested && !dismissed && relationship.kind !== 'friends'));
  const unavailable = $derived(view.status !== 'ready' || !!view.action || !!$friendshipState.pending || $friendshipState.blocked || $friendshipState.busy);

  onMount(() => {
    initializeFriendshipActions();
    return bindFriendsClient({ client, user, capture: captureSession, socket: getSocket(),
      isVisible: () => !document.hidden, isBusy: () => $friendshipState.busy,
      onIdentityChange: () => { dismissed = false; },
      onFocus: refresh => { window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); } });
  });
  function dismiss() { dismissed = true; onclose?.(); }
  function add() {
    if (unavailable) return;
    void client.act(relationship.kind === 'incoming' ? 'accept' : 'request', relationship.kind === 'incoming'
      ? { friendshipId: relationship.id, displayName: opponent.username }
      : { userId: opponent.userId, displayName: opponent.username });
  }
  async function confirm() {
    const scope = captureSession(), kind = $friendshipState.pending?.kind;
    try {
      const receipt = await retryFriendshipAction();
      if (receipt && isCurrentSession(scope)) await client.confirmed(kind);
    } catch { /* The shared journal retains uncertainty for retry. */ }
  }
</script>

{#if visible}
  <section class="friend-card card" aria-label={`Friendship with ${opponent.username}`}>
    <div class="friend-heading">
      <h3>{#if relationship.kind === 'incoming'}<PlayerLink username={opponent.username} /> wants to add you
        {:else if relationship.kind === 'friends'}You and <PlayerLink username={opponent.username} /> are friends
        {:else if relationship.kind === 'outgoing'}Friend request sent
        {:else}Add <PlayerLink username={opponent.username} /> as a friend?{/if}</h3>
      <button type="button" class="dismiss" onclick={dismiss} aria-label="Dismiss friendship prompt">×</button>
    </div>
    <p>{relationship.kind === 'friends' ? 'Find each other again from Friends.' : relationship.kind === 'outgoing' ? 'They can accept from their room or Friends.' : 'Find each other easily for your next game.'}</p>
    {#if view.status === 'loading' && !view.data}<p role="status">Checking friendship…</p>{/if}
    {#if view.error || view.readError}<p class="error" role="status">{view.error || view.readError}</p>{/if}
    {#if $friendshipState.pending}
      <p role="status">A friendship action still needs confirmation.</p>
      <button type="button" class="btn btn-dark btn-small" disabled={$friendshipState.busy || $friendshipState.blocked || !!view.action} onclick={confirm}>Confirm friendship action</button>
    {:else if relationship.kind === 'none' || relationship.kind === 'incoming'}
      <div class="friend-actions">
        <button type="button" class="btn btn-primary btn-small" disabled={unavailable} onclick={add}>{view.action ? 'Confirming…' : relationship.kind === 'incoming' ? 'Accept friend request' : 'Add friend'}</button>
        <button type="button" class="btn btn-dark btn-small" onclick={dismiss}>Not now</button>
      </div>
    {/if}
    {#if view.status === 'error'}<button type="button" class="btn btn-dark btn-small" onclick={() => client.refresh()}>Retry</button>{/if}
    {#if $friendshipState.error}<p class="error" role="status">{$friendshipState.error}</p>{/if}
  </section>
{/if}

<style>
  .friend-card { width: 100%; padding: var(--sp-md); display: flex; flex-direction: column; gap: var(--sp-sm); border-color: var(--surface2); }
  .friend-heading { display: flex; align-items: center; gap: var(--sp-sm); }
  h3 { flex: 1; font-size: var(--fs-body); line-height: 1.5; }
  p { color: var(--text-dim); font-size: var(--fs-caption); line-height: 1.5; }
  .dismiss { width: 44px; height: 44px; flex-shrink: 0; border: none; background: none; color: var(--text-dim); font-size: 1.4rem; cursor: pointer; }
  .friend-actions { display: flex; flex-wrap: wrap; gap: var(--sp-sm); }
  .friend-actions button { min-height: 44px; }
  .error { color: var(--accent); }
</style>
