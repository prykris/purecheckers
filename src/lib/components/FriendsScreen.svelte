<script>
  import { onMount } from 'svelte';
  import { user } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';

  let friends = [];
  let pending = [];
  let friendCode = '';
  let tipAmounts = {};
  let error = '';
  let success = '';

  onMount(() => refresh());

  async function refresh() {
    try {
      const [fData, pData, meData] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/pending'),
        api.get('/auth/me')
      ]);
      friends = fData.friends;
      pending = pData.requests;
      $user = meData.user;
    } catch {}
  }

  async function sendRequest() {
    error = ''; success = '';
    if (!friendCode.trim()) return;
    try {
      await api.post('/friends/request', { friendCode: friendCode.trim().toUpperCase() });
      success = 'Friend request sent!';
      friendCode = '';
    } catch (e) { error = e.message; }
  }

  async function accept(id) { try { await api.post('/friends/accept', { friendshipId: id }); await refresh(); } catch (e) { error = e.message; } }
  async function remove(id) { try { await api.del(`/friends/${id}`); await refresh(); } catch (e) { error = e.message; } }

  async function tip(friendId) {
    const amount = parseInt(tipAmounts[friendId]);
    if (!amount || amount < 1) return;
    error = ''; success = '';
    try {
      const data = await api.post('/coins/tip', { receiverId: friendId, amount });
      $user = { ...$user, coins: data.coins };
      tipAmounts[friendId] = '';
      success = `Tipped ${amount} coins!`;
    } catch (e) { error = e.message; }
  }
</script>

<div class="page-scroll">
  <div class="page-content friends">
    <h2>Friends</h2>

    <div class="card add-row">
      <input class="input code-input" type="text" bind:value={friendCode}
        placeholder="Enter friend code" maxlength="8"
        on:keydown={(e) => e.key === 'Enter' && sendRequest()} />
      <button class="btn btn-primary btn-small" on:click={sendRequest}>Add</button>
    </div>

    {#if error}<p class="msg error">{error}</p>{/if}
    {#if success}<p class="msg success">{success}</p>{/if}

    <div class="lists">
      {#if pending.length > 0}
        <section class="pending">
          <h3 class="section-title">Pending Requests</h3>
          {#each pending as req}
            <div class="card friend-row">
              <span class="fname">{req.requester.username}</span>
              <span class="felo">ELO {req.requester.elo}</span>
              <button class="btn btn-primary btn-small" on:click={() => accept(req.id)}>Accept</button>
            </div>
          {/each}
        </section>
      {/if}

      <section class="friend-list">
        <h3 class="section-title">Friends ({friends.length})</h3>
        {#if friends.length === 0}
          <p class="empty">No friends yet. Share your code: <strong>{$user?.friendCode}</strong></p>
        {:else}
          {#each friends as f}
            <div class="card friend-row">
              <span class="status-dot" class:online={f.status === 'online'} class:in-game={f.status === 'in-game'}></span>
              <span class="fname">{f.username}</span>
              <span class="felo">ELO {f.elo}</span>
              <span class="fstatus">{f.status}</span>
              <div class="tip-row">
                <input class="input tip-input" type="number" min="1" placeholder="Tip" bind:value={tipAmounts[f.id]} />
                <button class="btn btn-dark btn-small" on:click={() => tip(f.id)}>Tip</button>
              </div>
              <button class="remove-btn" on:click={() => remove(f.friendshipId)}>x</button>
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
