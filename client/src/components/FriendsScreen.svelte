<script>
  import { onMount } from 'svelte';
  import { screen } from '../stores/app.js';
  import { user } from '../stores/user.js';
  import { api } from '../lib/api.js';

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

  async function accept(id) {
    try {
      await api.post('/friends/accept', { friendshipId: id });
      await refresh();
    } catch (e) { error = e.message; }
  }

  async function remove(id) {
    try {
      await api.del(`/friends/${id}`);
      await refresh();
    } catch (e) { error = e.message; }
  }

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

<div class="friends-screen">
  <button class="btn btn-dark btn-small btn-back" on:click={() => $screen = 'lobby'}>Back</button>

  <h2>Friends</h2>

  <div class="add-friend">
    <input
      type="text"
      bind:value={friendCode}
      placeholder="Enter friend code"
      maxlength="8"
      on:keydown={(e) => e.key === 'Enter' && sendRequest()}
    />
    <button class="btn btn-primary btn-small" on:click={sendRequest}>Add</button>
  </div>

  {#if error}<p class="error">{error}</p>{/if}
  {#if success}<p class="success">{success}</p>{/if}

  {#if pending.length > 0}
    <h3>Pending Requests</h3>
    {#each pending as req}
      <div class="friend-row">
        <span class="fname">{req.requester.username}</span>
        <span class="felo">ELO {req.requester.elo}</span>
        <button class="btn btn-primary btn-small" on:click={() => accept(req.id)}>Accept</button>
      </div>
    {/each}
  {/if}

  <h3>Friends ({friends.length})</h3>
  {#if friends.length === 0}
    <p class="empty">No friends yet. Share your code: <strong>{$user?.friendCode}</strong></p>
  {:else}
    {#each friends as f}
      <div class="friend-row">
        <span class="status-dot" class:online={f.status === 'online'} class:in-game={f.status === 'in-game'}></span>
        <span class="fname">{f.username}</span>
        <span class="felo">ELO {f.elo}</span>
        <span class="fstatus">{f.status}</span>
        <div class="tip-row">
          <input type="number" min="1" placeholder="Tip" bind:value={tipAmounts[f.id]} />
          <button class="btn btn-dark btn-small" on:click={() => tip(f.id)}>Tip</button>
        </div>
        <button class="btn-remove" on:click={() => remove(f.friendshipId)}>x</button>
      </div>
    {/each}
  {/if}
</div>

<style>
  .friends-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    width: 100%;
    max-width: 420px;
    position: relative;
  }
  .btn-back { position: absolute; top: 16px; left: 16px; }
  h2 { font-size: 1.4rem; }
  h3 { font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 2px; width: 100%; }

  .add-friend {
    display: flex; gap: 8px; width: 100%;
  }
  .add-friend input {
    flex: 1; padding: 10px 14px; border-radius: 8px;
    border: 2px solid var(--surface2); background: var(--bg);
    color: var(--text); font-size: 0.9rem; outline: none;
    text-transform: uppercase; letter-spacing: 2px;
  }
  .add-friend input:focus { border-color: var(--accent); }

  .error { color: var(--accent); font-size: 0.8rem; }
  .success { color: #4caf50; font-size: 0.8rem; }
  .empty { color: var(--text-dim); font-size: 0.85rem; text-align: center; }
  .empty strong { color: var(--accent); letter-spacing: 2px; font-family: monospace; }

  .friend-row {
    display: flex; align-items: center; gap: 8px; width: 100%;
    background: var(--surface); border-radius: 8px; padding: 10px 12px;
    flex-wrap: wrap;
  }
  .status-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #555; flex-shrink: 0;
  }
  .status-dot.online { background: #4caf50; }
  .status-dot.in-game { background: #ff9800; }
  .fname { font-weight: 600; font-size: 0.9rem; }
  .felo { font-size: 0.75rem; color: var(--text-dim); }
  .fstatus { font-size: 0.7rem; color: var(--text-dim); margin-left: auto; }

  .tip-row { display: flex; gap: 4px; align-items: center; }
  .tip-row input {
    width: 50px; padding: 4px 6px; border-radius: 6px;
    border: 1px solid var(--surface2); background: var(--bg);
    color: var(--text); font-size: 0.8rem; text-align: center;
  }

  .btn-remove {
    background: none; border: none; color: var(--text-dim);
    cursor: pointer; font-size: 1rem; padding: 0 4px;
  }
  .btn-remove:hover { color: var(--accent); }
</style>
