<script>
  import { administratorRole } from '$lib/admin/roles.js';
  let { username, isAdmin = undefined, label = false } = $props();
  let detected = $state(false);
  $effect(() => {
    const name = username; let alive = true; detected = false;
    if (isAdmin !== undefined) return;
    const refresh = () => { if (isAdmin === undefined) administratorRole(name).then(value => { if (alive) detected = value; }); };
    refresh(); const timer = setInterval(refresh, 65000);
    return () => { alive = false; clearInterval(timer); };
  });
</script>
{#if isAdmin ?? detected}
  <span class="admin-badge" title="Administrator" aria-label="Administrator">
    <svg aria-hidden="true" width="14" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></svg>{#if label}<span>Administrator</span>{/if}
  </span>
{/if}
<style>.admin-badge{display:inline-flex;align-items:center;gap:5px;vertical-align:middle;color:var(--accent);font-size:12px;font-weight:600;flex:none}svg{flex:none}</style>
