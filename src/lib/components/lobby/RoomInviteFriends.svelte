<script>
  import { onMount } from 'svelte';
  import Modal from '../Modal.svelte';
  import RoomInviteButton from '../RoomInviteButton.svelte';
  import FriendList from '../FriendList.svelte';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';
  import { getSocket } from '$lib/socket.js';
  import { FriendsClient, bindFriendsClient } from '$lib/friendsClient.js';
  let { room, onclose } = $props();
  let view = $state.raw(null);
  const client = new FriendsClient({ readScope: captureSession, isCurrent: isCurrentSession,
    load: ({ scope, signal }) => api.get('/friends', { authToken: scope.token, signal }),
    publish: value => { view = value; }
  });
  onMount(() => bindFriendsClient({ client, user, capture: captureSession, socket: getSocket(),
    isVisible: () => !document.hidden,
    onFocus: refresh => { window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }
  }));
</script>
<Modal label="Invite a friend" maxWidth="480px" on:close={onclose}>
  <div class="picker">
    <header><h2>Invite a friend</h2><button class="btn btn-dark btn-small" onclick={onclose}>Close</button></header>
    {#if view?.readError}<p role="alert">{view.readError}</p><button class="btn btn-dark" onclick={() => client.refresh()}>Retry</button>{/if}
    {#if !view?.data}<p role="status">Loading friends…</p>
    {:else if !view.data.friends.length}<p>No friends yet. Share the room link to play together.</p>
    {:else}
      <FriendList friends={view.data.friends}>
        {#snippet children(friend)}
          <RoomInviteButton player={friend} friends/>
        {/snippet}
      </FriendList>
    {/if}
  </div>
</Modal>
<style>
  .picker { padding:var(--sp-md); display:grid; gap:var(--sp-md); }
  header { display:flex; align-items:center; justify-content:space-between; gap:var(--sp-sm); }
  h2 { font-size:var(--fs-body); }
  p { color:var(--text-dim); font-size:var(--fs-caption); line-height:1.5; }
</style>
