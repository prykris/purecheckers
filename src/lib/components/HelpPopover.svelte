<script>
  let { label, children } = $props();
  const id = $props.id();
</script>
<button type="button" class="help-trigger" popovertarget={id} aria-label={label}><span>?</span></button>
<div {id} popover class="help-content">
  <header><strong>{label}</strong><button type="button" popovertarget={id} popovertargetaction="hide" aria-label="Close help">×</button></header>
  <div class="help-body">{@render children()}</div>
</div>
<style>
  .help-trigger { display:inline-grid; place-items:center; width:44px; height:44px; flex:none; padding:0; border:0; background:none; color:var(--text-dim); font:inherit; cursor:pointer; }
  .help-trigger span { display:grid; place-items:center; width:16px; height:16px; border:1px solid var(--text-dim); border-radius:50%; font-size:10px; line-height:1; }
  .help-content { position:fixed; inset:0; margin:auto; width:min(320px, calc(100vw - 32px)); max-height:calc(100dvh - 32px); padding:var(--sp-md); border:1px solid var(--surface2); border-radius:var(--radius-md); background:var(--surface); color:var(--text); box-shadow:0 12px 48px #0008; }
  .help-content::backdrop { background:#0005; }
  header { display:flex; align-items:center; justify-content:space-between; gap:var(--sp-sm); }
  header button { width:44px; height:44px; border:0; background:none; color:var(--text-dim); font-size:24px; cursor:pointer; }
  .help-body { font-size:var(--fs-caption); line-height:1.6; color:var(--text-dim); }
</style>
