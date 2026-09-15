<script>
  import { user } from '$lib/stores/user.js';
  import Modal from '../Modal.svelte';
  import AdminInspector from './AdminInspector.svelte';
  let { section, id, label = 'Admin tools' } = $props();
  let open = $state(false);
  const identity = $derived($user?.id), allowed = $derived(!!$user?.isAdmin);
  $effect(() => { section; id; identity; allowed; open = false; });
</script>
{#if $user?.isAdmin && id}
<button class="context-admin" type="button" aria-label={label} title={label} aria-haspopup="dialog" onclick={() => open = true}><svg aria-hidden="true" width="16" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="M12 8v8m-4-4h8"/></svg><span>{label}</span></button>
{#if open}<Modal label={label} maxWidth="760px" on:close={() => open = false}><div class="context-body"><header><h2>{label}</h2><button class="btn btn-dark" onclick={() => open = false}>Close</button></header><AdminInspector {section} {id}/></div></Modal>{/if}
{/if}
<style>.context-admin{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:8px;border:0;border-radius:8px;color:var(--text-dim);background:transparent;font:inherit;font-size:12px;cursor:pointer}.context-admin:hover{color:var(--text);background:var(--surface2)}.context-body{padding:16px;background:var(--bg)}header{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}h2{font-size:18px}@media(max-width:500px){.context-admin span{display:none}.context-admin{min-width:44px}}</style>
