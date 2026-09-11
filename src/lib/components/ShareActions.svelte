<script>
  import { onDestroy } from 'svelte';
  import { shareLink, buildShareText, buildShareUrl } from '$lib/share.js';
  let { surface, url, data, text = null, label = 'Share', primary = false, onshared = () => {} } = $props();
  let notice = $state(''), busy = $state(false), timer, disposed = false;
  let manualTarget = $state(null);
  const manualUrl = $derived(manualTarget && manualTarget === url ? buildShareUrl(url, surface) : null);
  async function share(copyOnly) {
    if (!url || busy) return;
    const target = url; busy = true; manualTarget = null;
    try {
      const result = await shareLink({ surface, url: target, text: text ?? buildShareText(surface, data), copyOnly });
      if (disposed || url !== target) return;
      if (result === 'shared' || result === 'copied') onshared(result);
      manualTarget = result === 'unavailable' ? target : null;
      notice = result === 'copied' ? 'Link copied.' : '';
      clearTimeout(timer); timer = setTimeout(() => { notice = ''; }, 2000);
    } finally { busy = false; }
  }
  onDestroy(() => { disposed = true; clearTimeout(timer); });
</script>
<div class="share-actions">
  <button class="btn" class:btn-primary={primary} class:btn-dark={!primary} disabled={!url || busy} onclick={() => share(false)}>{url ? label : 'Saving replay…'}</button>
  <button class="btn btn-dark" disabled={!url || busy} onclick={() => share(true)}>Copy link</button>
  {#if notice}<p role="status">{notice}</p>{/if}
  {#if manualUrl}
    <div class="manual-copy">
      <p role="status">Sharing is unavailable. Select and copy this link.</p>
      <label>Link to share
        <input class="input" readonly value={manualUrl} onfocus={event => event.currentTarget.select()} />
      </label>
    </div>
  {/if}
</div>
<style>
  .share-actions { display: flex; gap: var(--sp-sm); align-items: center; justify-content: center; flex-wrap: wrap; }
  button { min-height: 44px; }
  p { flex-basis: 100%; color: var(--text-dim); font-size: var(--fs-caption); text-align: center; }
  .manual-copy { flex-basis: 100%; min-width: 0; }
  label { display: flex; flex-direction: column; gap: var(--sp-xs); margin-top: var(--sp-xs); color: var(--text-dim); font-size: var(--fs-caption); }
  input { width: 100%; min-width: 0; }
</style>
