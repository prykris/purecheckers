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

  function isOwned(id) { return inventory.some(i => i.itemId === id); }
  function isEquipped(id) { return inventory.some(i => i.itemId === id && i.equipped); }

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
  $: emotes = items.filter(i => i.type === 'EMOTE');
</script>

<div class="page-scroll">
  <div class="page-content shop">
    <h2>Shop</h2>
    <p class="coins">Your coins: <strong>{$user?.coins || 0}</strong></p>
    {#if error}<p class="error">{error}</p>{/if}

    {#if skins.length > 0}
      <h3 class="section-title">Piece Skins</h3>
      <div class="items-grid">
        {#each skins as item}
          <div class="card item-card" class:equipped={isEquipped(item.id)}>
            <div class="preview" style="background:linear-gradient(135deg,{item.data?.red?.base||'#e94560'},{item.data?.black?.base||'#2d2d2d'})"></div>
            <div class="info">
              <span class="name">{item.name}</span>
              <span class="price">{item.price} coins</span>
            </div>
            {#if isEquipped(item.id)}
              <span class="badge equipped">Equipped</span>
            {:else if isOwned(item.id)}
              <button class="btn btn-secondary btn-small" on:click={() => equip(item)}>Equip</button>
            {:else}
              <button class="btn btn-primary btn-small" on:click={() => buy(item)}
                disabled={buying === item.id || ($user?.coins || 0) < item.price}>
                {buying === item.id ? '...' : 'Buy'}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if emotes.length > 0}
      <h3 class="section-title">Emotes</h3>
      <div class="items-grid">
        {#each emotes as item}
          <div class="card item-card">
            <div class="emote-icon">{item.data?.emoji || '?'}</div>
            <div class="info">
              <span class="name">{item.name}</span>
              <span class="price">{item.price} coins</span>
            </div>
            {#if isOwned(item.id)}
              <span class="badge owned">Owned</span>
            {:else}
              <button class="btn btn-primary btn-small" on:click={() => buy(item)}
                disabled={buying === item.id || ($user?.coins || 0) < item.price}>
                {buying === item.id ? '...' : 'Buy'}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .shop { align-items: center; }
  h2 { font-size: var(--fs-heading); text-align: center; }
  .coins { text-align: center; color: var(--text-dim); }
  .coins strong { color: var(--gold); }
  .error { color: var(--accent); font-size: var(--fs-caption); text-align: center; }

  .items-grid { display: flex; flex-direction: column; gap: var(--sp-sm); width: 100%; }
  .item-card {
    display: flex; align-items: center; gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md);
  }
  .item-card.equipped { outline: 2px solid var(--accent); outline-offset: 2px; }
  .preview { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; }
  .emote-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; flex-shrink: 0; }
  .info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { font-weight: 600; font-size: var(--fs-body); }
  .price { font-size: var(--fs-caption); color: var(--text-dim); }
  .badge { font-size: var(--fs-caption); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .equipped { color: var(--accent); }
  .owned { color: var(--success); }

  @media (min-width: 600px) {
    .items-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-md); }
  }
  @media (min-width: 900px) {
    .items-grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
