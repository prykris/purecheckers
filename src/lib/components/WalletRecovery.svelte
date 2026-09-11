<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { initializeWalletActions, retryWalletAction, walletState } from '$lib/wallet/actions.js';
  import { captureSession, isCurrentSession } from '$lib/stores/user.js';
  const dispatch = createEventDispatcher();
  let mounted = false;
  onMount(() => { mounted = true; initializeWalletActions(); return () => { mounted = false; }; });
  $: selection = $walletState.pending?.kind === 'equip';

  async function retry() {
    const scope = captureSession(), kind = $walletState.pending?.kind;
    try {
      const result = await retryWalletAction();
      if (result && mounted && isCurrentSession(scope)) dispatch('confirmed', { kind });
    } catch { /* The shared journal publishes the retry outcome. */ }
  }
</script>

{#if $walletState.pending || $walletState.error}
  <div class="card" role="status" aria-live="polite">
    {#if $walletState.pending}
      <p>{$walletState.pending.kind === 'tip' ? `Your ${$walletState.pending.payload.amount}-coin tip` : selection ? 'Your item selection' : 'Your purchase'} {$walletState.busy ? 'is being confirmed.' : 'needs confirmation.'}</p>
      <button class="btn btn-secondary btn-small" disabled={$walletState.busy || $walletState.blocked} on:click={retry}>
        {$walletState.busy ? 'Confirming…' : selection ? 'Confirm selection' : 'Confirm payment'}
      </button>
    {/if}
    {#if $walletState.error}<p>{$walletState.error}</p>{/if}
  </div>
{/if}
