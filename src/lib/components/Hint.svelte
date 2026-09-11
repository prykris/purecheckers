<script>
  import { hints } from '$lib/hints.js';

  // One in-flow card per hint id: no pointer, no overlay, no animation. Rendered only
  // while the id is unseen; the one control inside it dismisses and optionally acts.
  let { id, text, dismissLabel = 'Got it', ondismiss = null } = $props();
  const visible = $derived(!$hints.has(id));

  function dismiss() {
    hints.dismiss(id);
    ondismiss?.();
  }
</script>

{#if visible}
  <div class="hint" role="note">
    <p class="hint-text">{text}</p>
    <div class="hint-actions">
      <button type="button" class="hint-dismiss" onclick={dismiss}>{dismissLabel}</button>
    </div>
  </div>
{/if}

<style>
  .hint {
    width: 100%;
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md);
    padding: var(--sp-md) var(--sp-md) var(--sp-xs);
    display: flex; flex-direction: column; gap: var(--sp-xs);
  }
  .hint-text { font-size: var(--fs-body); line-height: 1.45; color: var(--text); }
  .hint-actions { display: flex; justify-content: flex-end; }
  .hint-dismiss {
    min-height: 44px; padding: 0 var(--sp-sm);
    background: none; border: none; color: var(--accent);
    font-family: var(--font); font-size: var(--fs-caption); font-weight: 600;
    cursor: pointer; border-radius: var(--radius-sm);
  }
  .hint-dismiss:hover { text-decoration: underline; }
</style>
