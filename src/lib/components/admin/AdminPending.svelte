<script>
  import { onMount } from 'svelte';
  import { adminState, initializeAdminActions, retryAdminAction } from '$lib/admin/actions.js';
  onMount(() => { initializeAdminActions(); });
  async function retry() { try { await retryAdminAction(); } catch {} }
</script>
{#if $adminState.pending || $adminState.blocked}
  <aside class="pending" role="status">
    <strong>Action awaiting confirmation</strong>
    {#if $adminState.pending}<p>{$adminState.pending.kind} · account #{$adminState.pending.payload.userId}. Confirm the original request before making another change.</p><button class="btn btn-dark" disabled={$adminState.busy || $adminState.blocked} onclick={retry}>{$adminState.busy ? 'Confirming…' : 'Confirm pending action'}</button>{/if}
    {#if $adminState.error}<p>{$adminState.error}</p>{/if}
  </aside>
{/if}
<style>.pending{padding:16px;border:1px solid var(--accent);border-radius:var(--radius-md);background:var(--surface);display:grid;gap:10px}p{font-size:13px;color:var(--text-dim)}</style>
