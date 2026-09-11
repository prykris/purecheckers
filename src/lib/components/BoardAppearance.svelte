<script>
  import { appearance, refreshAppearance } from '$lib/stores/appearance.js';
</script>

<div class="appearance" aria-busy={$appearance.status === 'loading'}>
  {#if $appearance.data?.theme}<span>{$appearance.data.theme.name}</span>{/if}
  {#if $appearance.data?.skin}
    <span>{$appearance.data.skin.name}</span>
    <span><i style:background={$appearance.data.skin.palette.red.gradStops[1]}></i>Red</span>
    <span><i style:background={$appearance.data.skin.palette.black.gradStops[1]}></i>Black</span>
  {/if}
  {#if $appearance.status === 'error'}
    <span role="status">{$appearance.error} {$appearance.data ? 'Showing the last loaded appearance.' : 'Using basic appearance.'}</span>
    <button class="btn btn-dark btn-small" on:click={refreshAppearance}>Retry appearance</button>
  {/if}
</div>

<style>
  .appearance { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--sp-sm); font-size: var(--fs-caption); color: var(--text-dim); }
  .appearance:empty { display: none; }
  span { display: inline-flex; align-items: center; gap: var(--sp-xs); }
  i { display: inline-block; height: 0.85rem; width: 0.85rem; border: 1px solid currentColor; border-radius: 50%; }
</style>
