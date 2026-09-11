<script>
  import PlayerLink from './PlayerLink.svelte';
  import { onMount } from 'svelte';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';
  import { getSocket } from '$lib/socket.js';
  import { FriendsClient, bindFriendsClient } from '$lib/friendsClient.js';
  import WalletRecovery from './WalletRecovery.svelte';
  import { performWalletAction, walletState } from '$lib/wallet/actions.js';
  import { initializeFriendshipActions, performFriendshipAction, retryFriendshipAction, friendshipState } from '$lib/friends/actions.js';

  let view, friendCode = '', tipAmounts = {}, mounted = false;
  const client = new FriendsClient({ readScope: captureSession, isCurrent: isCurrentSession,
    load: ({ scope, signal }) => api.get('/friends', { authToken: scope.token, signal }),
    perform: performFriendshipAction, tip: payload => performWalletAction('tip', payload), publish: value => { view = value; }
  });
  $: friends = view.data?.friends ?? [];
  $: pending = view.data?.requests ?? [];
  $: outgoing = view.data?.outgoing ?? [];
  $: unavailable = view.status !== 'ready' || !!view.action || !!$friendshipState.pending || $friendshipState.blocked || !!$walletState.pending || $walletState.blocked;
  onMount(() => {
    mounted = true; initializeFriendshipActions();
    const stop = bindFriendsClient({ client, user, capture: captureSession, socket: getSocket(),
      isVisible: () => !document.hidden, isBusy: () => $friendshipState.busy,
      onIdentityChange: () => { friendCode = ''; tipAmounts = {}; },
      onFocus: refresh => { window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); } });
    return () => { mounted = false; stop(); };
  });
  async function sendRequest() {
    if (unavailable || !friendCode.trim()) return;
    const scope = captureSession();
    if (await client.act('request', { friendCode: friendCode.trim().toUpperCase() }) && mounted && isCurrentSession(scope)) friendCode = '';
  }
  async function tip(friendId) {
    if (unavailable) return;
    const amount = Number(tipAmounts[friendId]), scope = captureSession();
    if (!Number.isSafeInteger(amount) || amount < 1) return;
    if (await client.act('tip', { receiverId: friendId, amount }) && mounted && isCurrentSession(scope)) tipAmounts[friendId] = '';
  }
  async function confirmFriendship() {
    const scope = captureSession(), kind = $friendshipState.pending?.kind;
    try {
      const receipt = await retryFriendshipAction();
      if (receipt && mounted && isCurrentSession(scope)) await client.confirmed(kind);
    } catch { /* The shared journal owns uncertain/rejected feedback. */ }
  }
</script>

<div class="page-scroll">
  <div class="page-content friends" aria-busy={view.status === 'loading' || !!view.action || $friendshipState.busy}>
    <h2>Friends</h2>

    <div class="card add-row">
      <input aria-label="Friend code" disabled={unavailable} class="input code-input" type="text" bind:value={friendCode}
        placeholder="Enter friend code" maxlength="8"
        on:keydown={(e) => e.key === 'Enter' && sendRequest()} />
      <button class="btn btn-primary btn-small" disabled={unavailable || !friendCode.trim()} on:click={sendRequest}>{view.action === 'request' ? 'Confirming…' : 'Add'}</button>
    </div>

    {#if view.error || view.readError}<p class="msg error" role="alert">{view.error || view.readError}</p>{/if}
    <button class="btn btn-dark btn-small" disabled={view.status === 'loading' || !!view.action} on:click={() => client.refresh()}>{view.status === 'loading' ? 'Refreshing…' : 'Refresh'}</button>
    {#if !view.data && view.status === 'loading'}<p role="status">Loading friends…</p>{/if}
    {#if $friendshipState.pending || $friendshipState.error}
      <div class="card" role="status">
        {#if $friendshipState.pending}
          <p>{$friendshipState.pending.kind === 'request' ? `Request to ${$friendshipState.pending.payload.displayName || $friendshipState.pending.payload.friendCode || `player ${$friendshipState.pending.payload.userId}`}` : `${$friendshipState.pending.kind === 'accept' ? 'Acceptance of' : 'Removal of'} ${$friendshipState.pending.payload.displayName || 'this friendship'}`} needs confirmation.</p>
          <button class="btn btn-secondary btn-small" disabled={$friendshipState.busy || $friendshipState.blocked || !!view.action} on:click={confirmFriendship}>{$friendshipState.busy ? 'Confirming…' : 'Confirm friendship action'}</button>
        {/if}
        {#if $friendshipState.error}<p>{$friendshipState.error}</p>{/if}
      </div>
    {/if}
    {#if view.success}<p class="msg success" role="status">{view.success}</p>{/if}

    <WalletRecovery on:confirmed={event => { tipAmounts = {}; void client.confirmed(event.detail.kind); }} />

    <div class="lists">
      {#if pending.length > 0}
        <section class="pending">
          <h3 class="section-title">Pending Requests</h3>
          {#each pending as req (req.id)}
            <div class="card friend-row">
              <span class="fname"><PlayerLink username={req.requester.username} profilePublic={req.requester.profilePublic} /></span>
              <span class="felo">ELO {req.requester.elo}</span>
              <button class="btn btn-primary btn-small" disabled={unavailable} on:click={() => client.act('accept', { friendshipId: req.id, displayName: req.requester.username })}>Accept</button>
              <button class="btn btn-dark btn-small" disabled={unavailable} on:click={() => client.act('remove', { friendshipId: req.id, displayName: req.requester.username })}>Decline</button>
            </div>
          {/each}
        </section>
      {/if}

      {#if outgoing.length > 0}
        <section class="pending">
          <h3 class="section-title">Sent Requests</h3>
          {#each outgoing as req (req.id)}
            <div class="card friend-row"><span class="fname"><PlayerLink username={req.receiver.username} profilePublic={req.receiver.profilePublic} /></span><span class="fstatus">Awaiting acceptance</span>
              <button class="btn btn-dark btn-small" disabled={unavailable} on:click={() => client.act('remove', { friendshipId: req.id, displayName: req.receiver.username })}>Cancel request</button>
            </div>
          {/each}
        </section>
      {/if}
      <section class="friend-list">
        <h3 class="section-title">Friends ({friends.length})</h3>
        {#if view.data && friends.length === 0}
          <p class="empty">No friends yet. Share your code: <strong>{$user?.friendCode}</strong></p>
        {:else}
          {#each friends as f (f.friendshipId)}
            <div class="card friend-row">
              <span class="status-dot" class:online={f.status === 'online'} class:in-game={f.status === 'in-game'}></span>
              <span class="fname"><PlayerLink username={f.username} profilePublic={f.profilePublic} /></span>
              <span class="felo">ELO {f.elo}</span>
              <span class="fstatus">{f.status}</span>
              <div class="tip-row">
                <input aria-label={`Coins to tip ${f.username}`} class="input tip-input" type="number" min="1" step="1" disabled={unavailable} placeholder="Tip" bind:value={tipAmounts[f.id]} />
                <button class="btn btn-dark btn-small" disabled={unavailable} on:click={() => tip(f.id)}>Tip</button>
              </div>
              <button class="remove-btn" aria-label={`Remove ${f.username} from friends`} disabled={unavailable} on:click={() => client.act('remove', { friendshipId: f.friendshipId, displayName: f.username })}>Remove</button>
            </div>
          {/each}
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .friends { align-items: center; }
  h2 { font-size: var(--fs-heading); text-align: center; }
  .add-row { display: flex; gap: var(--sp-sm); align-items: center; width: 100%; }
  .code-input { text-transform: uppercase; letter-spacing: 2px; }
  .msg { font-size: var(--fs-caption); text-align: center; }
  .error { color: var(--accent); }
  .success { color: var(--success); }
  .empty { color: var(--text-dim); font-size: var(--fs-body); text-align: center; }
  .empty strong { color: var(--accent); letter-spacing: 2px; font-family: var(--font-mono); }

  .lists { display: flex; flex-direction: column; gap: var(--sp-md); width: 100%; }
  .pending, .friend-list { display: flex; flex-direction: column; gap: var(--sp-sm); }

  .friend-row { display: flex; align-items: center; gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md); flex-wrap: wrap; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #555; flex-shrink: 0; }
  .status-dot.online { background: var(--success); }
  .status-dot.in-game { background: var(--warning); }
  .fname { font-weight: 600; font-size: var(--fs-body); }
  .felo { font-size: var(--fs-caption); color: var(--text-dim); }
  .fstatus { font-size: var(--fs-caption); color: var(--text-dim); margin-left: auto; }
  .tip-row { display: flex; gap: var(--sp-xs); align-items: center; }
  .tip-input { width: 50px; padding: var(--sp-xs) var(--sp-sm); text-align: center; font-size: var(--fs-caption); }
  .remove-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1rem; padding: 0 var(--sp-xs); }
  .remove-btn:hover { color: var(--accent); }

  @media (min-width: 900px) {
    .lists { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-lg); align-items: start; }
  }
</style>
