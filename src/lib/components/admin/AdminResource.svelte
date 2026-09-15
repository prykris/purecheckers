<script>
  import { onDestroy } from 'svelte';
  import { ReadResource } from '$lib/readResource.js';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';
  let { path, children } = $props();
  let view = $state.raw({ status: 'idle', data: null, error: null });
  const identity = $derived($user?.id), allowed = $derived(!!$user?.isAdmin);
  const resource = new ReadResource({ readScope: () => ({ ...captureSession(), path }),
    isCurrent: scope => isCurrentSession(scope) && scope.path === path && allowed,
    load: ({ scope, signal }) => api.get('/admin/' + scope.path, { authToken: scope.token, signal }), publish: value => view = value });
  $effect(() => { path; identity; allowed; resource.reset(); if (allowed) void resource.refresh(); });
  onDestroy(() => resource.dispose());
</script>
{#if !$user?.isAdmin}<p role="status">Administrator access required.</p>
{:else if view.status === 'loading' || view.status === 'idle'}<p role="status">Loading…</p>
{:else if view.status === 'error'}<div role="alert"><p>{view.error}</p><button class="btn btn-dark" onclick={() => resource.refresh()}>Retry</button></div>
{:else if view.data}{@render children(view.data, () => resource.refresh())}{/if}
