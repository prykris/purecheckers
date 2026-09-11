<script>
  import { onMount } from 'svelte';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';
  import { ShopClient } from '$lib/shopClient.js';
  import WalletRecovery from './WalletRecovery.svelte';
  import BoardAppearance from './BoardAppearance.svelte';
  import { performWalletAction, walletState } from '$lib/wallet/actions.js';
  export let appearanceOnly = false;

  let view;
  const shop = new ShopClient({ readScope: captureSession, isCurrent: isCurrentSession,
    load: ({ scope, signal }) => api.get('/shop', { authToken: scope.token, signal }),
    perform: performWalletAction, publish: value => { view = value; }
  });
  onMount(() => {
    let generation;
    const unsubscribe = user.subscribe(value => {
      const next = captureSession().generation;
      if (next === generation) return;
      generation = next; shop.reset();
      if (value) void shop.refresh();
    });
    const focus = () => { if (view.status !== 'loading') void shop.refresh(); };
    window.addEventListener('focus', focus);
    return () => { unsubscribe(); window.removeEventListener('focus', focus); shop.dispose(); };
  });

  function isOwned(id) { return view.data?.inventory.some(i => i.itemId === id); }
  function isEquipped(id) { return view.data?.inventory.some(i => i.itemId === id && i.equipped); }
  $: items = view.data?.items ?? [];
  $: themes = items.filter(i => i.type === 'THEME' && (!appearanceOnly || view.data?.inventory.some(row => row.itemId === i.id)));
  $: skins = items.filter(i => i.type === 'SKIN');
  $: emotes = items.filter(i => i.type === 'EMOTE');
  $: unavailable = view.status !== 'ready' || !!view.action || !!$walletState.pending || $walletState.blocked;
</script>

<div class:page-scroll={!appearanceOnly}>
  <div class:page-content={!appearanceOnly} class="shop" aria-busy={view.status === 'loading' || !!view.action}>
    {#if !appearanceOnly}<h2>Shop</h2>
    <p class="coins">Your coins: <strong>{$user?.coins || 0}</strong></p>{/if}
    <BoardAppearance />
    {#if view.error || view.readError}<p class="error" role="alert">{view.error || view.readError}</p>{/if}
    <button class="btn btn-dark btn-small" disabled={view.status === 'loading' || !!view.action} on:click={() => shop.refresh()}>
      {view.status === 'loading' ? 'Refreshing…' : 'Refresh'}
    </button>
    {#if !view.data && view.status === 'loading'}<p role="status">Loading shop…</p>{/if}
    {#if view.data && items.length === 0}<p>No items are available yet.</p>{/if}
    <WalletRecovery on:confirmed={() => shop.refresh()} />

      <h3 class="section-title">Themes</h3>
      <button class="btn btn-dark btn-small" disabled={unavailable} on:click={() => shop.act('equip', null, 'THEME')}>Use basic theme</button>
    {#if themes.length > 0}
      <div class="items-grid">
        {#each themes as item}
          <div class="card item-card" class:equipped={isEquipped(item.id)}>
            <div class="theme-preview">
              <span class="tp-swatch" style="background:{item.data?.['--accent']||'#ef4444'}"></span>
              <span class="tp-swatch" style="background:{item.data?.['--bg']||'#1c1917'}"></span>
              <span class="tp-swatch" style="background:{item.data?.['--board-dark']||'#7c5e3c'}"></span>
            </div>
            <div class="info">
              <span class="name">{item.name}</span>
              <span class="price">{item.price} coins</span>
            </div>
            {#if isEquipped(item.id)}
              <span class="badge equipped">Equipped</span>
            {:else if isOwned(item.id)}
              <button class="btn btn-secondary btn-small" disabled={unavailable} on:click={() => shop.act('equip', item.id)}>{view.action?.kind === 'equip' && view.action.itemId === item.id ? 'Confirming…' : 'Equip'}</button>
            {:else}
              <button class="btn btn-primary btn-small" on:click={() => shop.act('purchase', item.id)}
                disabled={unavailable || ($user?.coins || 0) < item.price}>
                {view.action?.kind === 'purchase' && view.action.itemId === item.id ? 'Confirming…' : 'Buy'}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if !appearanceOnly}
      <h3 class="section-title">Piece Skins</h3>
      <button class="btn btn-dark btn-small" disabled={unavailable} on:click={() => shop.act('equip', null)}>{view.action?.kind === 'equip' && view.action.itemId === null ? 'Confirming…' : 'Use standard pieces'}</button>
    {#if skins.length > 0}
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
              <button class="btn btn-secondary btn-small" disabled={unavailable} on:click={() => shop.act('equip', item.id)}>{view.action?.kind === 'equip' && view.action.itemId === item.id ? 'Confirming…' : 'Equip'}</button>
            {:else}
              <button class="btn btn-primary btn-small" on:click={() => shop.act('purchase', item.id)}
                disabled={unavailable || ($user?.coins || 0) < item.price}>
                {view.action?.kind === 'purchase' && view.action.itemId === item.id ? 'Confirming…' : 'Buy'}
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
              <span class="price">{item.price === 0 ? 'Free' : `${item.price} coins`}</span>
            </div>
            {#if item.price === 0}
              <span class="badge free">Free</span>
            {:else if isOwned(item.id)}
              <span class="badge owned">Owned</span>
            {:else}
              <button class="btn btn-primary btn-small" on:click={() => shop.act('purchase', item.id)}
                disabled={unavailable || ($user?.coins || 0) < item.price}>
                {view.action?.kind === 'purchase' && view.action.itemId === item.id ? 'Confirming…' : 'Buy'}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
    {:else}
      <p>Your owned themes are listed here. Find more in <a href="/shop">Shop</a>.</p>
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
  .theme-preview { display: flex; gap: 3px; flex-shrink: 0; }
  .tp-swatch { width: 14px; height: 14px; border-radius: 50%; border: 1px solid var(--surface2); }
  .preview { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; }
  .emote-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; flex-shrink: 0; }
  .info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { font-weight: 600; font-size: var(--fs-body); }
  .price { font-size: var(--fs-caption); color: var(--text-dim); }
  .badge { font-size: var(--fs-caption); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .equipped { color: var(--accent); }
  .owned { color: var(--success); }
  .free { color: var(--text-dim); }

  @media (min-width: 600px) {
    .items-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-md); }
  }
  @media (min-width: 900px) {
    .items-grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
