<script>
  import { onMount } from 'svelte';
  import { screen } from '../stores/app.js';
  import { user } from '../stores/user.js';
  import { api } from '../lib/api.js';

  let items = [];
  let inventory = [];
  let error = '';
  let buying = null;

  onMount(async () => {
    try {
      const [shopData, invData] = await Promise.all([
        api.get('/shop/items'),
        api.get('/shop/inventory')
      ]);
      items = shopData.items;
      inventory = invData.inventory;
    } catch (e) { error = e.message; }
  });

  function isOwned(itemId) {
    return inventory.some(i => i.itemId === itemId);
  }

  function isEquipped(itemId) {
    return inventory.some(i => i.itemId === itemId && i.equipped);
  }

  async function buy(item) {
    buying = item.id;
    error = '';
    try {
      const data = await api.post('/shop/purchase', { itemId: item.id });
      $user = { ...$user, coins: data.coins };
      const invData = await api.get('/shop/inventory');
      inventory = invData.inventory;
    } catch (e) { error = e.message; }
    buying = null;
  }

  async function equip(item) {
    try {
      await api.patch('/shop/equip', { itemId: item.id });
      const invData = await api.get('/shop/inventory');
      inventory = invData.inventory;
    } catch (e) { error = e.message; }
  }

  $: skins = items.filter(i => i.type === 'SKIN');
</script>

<div class="shop">
  <button class="btn btn-dark btn-small btn-back" on:click={() => $screen = 'lobby'}>Back</button>

  <h2>Shop</h2>
  <p class="coins">Your coins: <strong>{$user?.coins || 0}</strong></p>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <h3>Piece Skins</h3>
  <div class="items-grid">
    {#each skins as item}
      <div class="item-card" class:owned={isOwned(item.id)} class:equipped={isEquipped(item.id)}>
        <div class="item-preview" style="background: linear-gradient(135deg, {item.data?.red?.base || '#e94560'}, {item.data?.black?.base || '#2d2d2d'})"></div>
        <div class="item-info">
          <span class="item-name">{item.name}</span>
          <span class="item-price">{item.price} coins</span>
        </div>
        {#if isEquipped(item.id)}
          <span class="badge">Equipped</span>
        {:else if isOwned(item.id)}
          <button class="btn btn-secondary btn-small" on:click={() => equip(item)}>Equip</button>
        {:else}
          <button class="btn btn-primary btn-small" on:click={() => buy(item)} disabled={buying === item.id || ($user?.coins || 0) < item.price}>
            {buying === item.id ? '...' : 'Buy'}
          </button>
        {/if}
      </div>
    {/each}
  </div>

  {#if skins.length === 0}
    <p class="empty">No items available yet. Check back later!</p>
  {/if}
</div>

<style>
  .shop {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 16px;
    width: 100%;
    max-width: 480px;
    position: relative;
  }
  .btn-back { position: absolute; top: 16px; left: 16px; }
  h2 { font-size: 1.5rem; color: var(--text); }
  h3 { font-size: 1rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 2px; }
  .coins { color: var(--text-dim); font-size: 0.9rem; }
  .coins strong { color: #ffd700; }
  .error { color: var(--accent); font-size: 0.85rem; }
  .empty { color: var(--text-dim); font-size: 0.85rem; }

  .items-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }
  .item-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--surface);
    border-radius: 10px;
    padding: 12px;
  }
  .item-card.equipped { outline: 2px solid var(--accent); outline-offset: 2px; }
  .item-preview {
    width: 44px; height: 44px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .item-name { font-weight: 600; font-size: 0.9rem; }
  .item-price { font-size: 0.75rem; color: var(--text-dim); }
  .badge {
    font-size: 0.7rem;
    color: var(--accent);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
</style>
