<script>
  import Icon from './table/TableIcon.svelte';
  import { onDestroy } from 'svelte';
  import { shareLink, buildShareText, buildShareUrl } from '$lib/share.js';
  let { surface, url, data, text = null, label = 'Share', primary = false, variant = 'buttons', onshared = () => {} } = $props();
  let notice = $state(''), busy = $state(false), timer, disposed = false;
  let manualTarget = $state(null);
  const manualUrl = $derived(manualTarget && manualTarget === url ? buildShareUrl(url, surface) : null);
  async function share(copyOnly) {
    if (!url || busy) return;
    const target = url; busy = true; manualTarget = null;
    try {
      const result = await shareLink({ surface, url: target, attribute: variant !== 'input', text: text ?? buildShareText(surface, data), copyOnly });
      if (disposed || url !== target) return;
      if (result === 'shared' || result === 'copied') onshared(result);
      manualTarget = result === 'unavailable' ? target : null;
      notice = result === 'copied' ? 'Link copied.' : '';
      clearTimeout(timer); timer = setTimeout(() => { notice = ''; }, 2000);
    } finally { busy = false; }
  }
  onDestroy(() => { disposed = true; clearTimeout(timer); });
</script>
<div class="share-actions" class:link-field={variant === 'input'}>
  {#if variant === 'input'}
    <div class="link-controls">
      <input class="input" aria-label="Room invitation link" readonly value={url || ''} onfocus={event => event.currentTarget.select()} />
      <button class="link-button" aria-label="Share link" title="Share link" disabled={!url || busy} onclick={() => share(false)}><Icon name="share" size={18}/></button>
      <button class="link-button" aria-label="Copy link" title="Copy link" disabled={!url || busy} onclick={() => share(true)}><Icon name={notice ? 'check' : 'copy'} size={18}/></button>
    </div>
    <p class="link-notice" role="status">{manualUrl ? 'Select and copy the link above.' : notice}</p>
  {:else}
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
  {/if}
</div>
<style>
  .share-actions.link-field { width:100%; gap:0; position:relative; }
  .link-controls { display:flex; width:100%; border:1px solid var(--surface2); border-radius:var(--radius-sm); overflow:hidden; background:var(--bg); }
  .link-controls input { flex:1; border:0; border-radius:0; background:none; font-family:var(--font); font-size:12px; text-overflow:ellipsis; padding:0 12px; height:44px; }
  .link-button { display:grid; place-items:center; flex:0 0 44px; border:0; border-left:1px solid var(--surface2); color:var(--text); background:var(--surface); cursor:pointer; }
  .link-button:hover { color:var(--accent); }
  .link-notice { position:absolute; top:100%; margin:3px 0 0; font-size:10px; }
  .share-actions { display: flex; gap: var(--sp-sm); align-items: center; justify-content: center; flex-wrap: wrap; }
  button { min-height: 44px; }
  p { flex-basis: 100%; color: var(--text-dim); font-size: var(--fs-caption); text-align: center; }
  .manual-copy { flex-basis: 100%; min-width: 0; }
  label { display: flex; flex-direction: column; gap: var(--sp-xs); margin-top: var(--sp-xs); color: var(--text-dim); font-size: var(--fs-caption); }
  input { width: 100%; min-width: 0; }
</style>
