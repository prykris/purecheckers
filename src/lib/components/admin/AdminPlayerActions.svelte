<script>
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { adminState, performAdminAction } from '$lib/admin/actions.js';
  import AdminPending from './AdminPending.svelte';
  let { player, onchanged = () => {} } = $props();
  let kind = $state('give-coins'), amount = $state(0), elo = $state(1000), reason = $state(''), preview = $state.raw(null), message = $state('');
  const identity = $derived($user?.id);
  const labels = { 'give-coins': 'Adjust coins', 'set-elo': 'Set rating', 'reset-stats': 'Reset statistics', 'set-admin': 'Change administrator role' };
  const disabled = $derived(!$user?.isAdmin || player.guestRetiredAt || $adminState.busy || $adminState.pending || $adminState.blocked);
  $effect(() => { player.id; identity; preview = null; message = ''; });
  function review(event) {
    event.preventDefault(); message = '';
    if (!reason.trim()) { message = 'Enter a reason for the audit history.'; return; }
    if (kind === 'give-coins' && (!Number.isInteger(amount) || !amount)) { message = 'Enter a nonzero whole coin amount.'; return; }
    if (kind === 'set-elo' && (!Number.isInteger(elo) || elo < 0 || elo > 100000)) { message = 'Enter a whole rating from 0 to 100000.'; return; }
    const payload = { userId: player.id, reason: reason.trim(), ...(kind === 'give-coins' ? { amount } : kind === 'set-elo' ? { elo } : kind === 'set-admin' ? { isAdmin: !player.isAdmin } : {}) };
    const effect = kind === 'give-coins' ? `${player.coins} → ${player.coins + amount} coins` : kind === 'set-elo' ? `${player.elo} → ${elo} ELO` : kind === 'set-admin' ? `${player.isAdmin ? 'Remove' : 'Grant'} administrator access` : 'Set wins, losses and games played to 0; rating to 1000. Preserve game history, peak rating and earned rewards.';
    preview = { kind, payload, effect, actor: captureSession() };
  }
  async function apply() {
    const action = preview; if (!action || disabled || !isCurrentSession(action.actor)) return;
    preview = null;
    try { const receipt = await performAdminAction(action.kind, action.payload); if (receipt && isCurrentSession(action.actor)) { message = `Confirmed ${labels[action.kind].toLowerCase()} for ${receipt.user.username}.`; reason = ''; onchanged(receipt); } }
    catch (error) { if (isCurrentSession(action.actor)) message = error.message; }
  }
</script>
<AdminPending/>
{#if $user?.isAdmin}
<section class="actions" aria-label="Administrative player actions">
  <h3>Admin actions</h3>
  {#if preview}
    <div class="review"><strong>{player.username} · #{player.id}</strong><p>{preview.effect}</p><p>Reason: {preview.payload.reason}</p><div class="buttons"><button class="btn btn-primary" onclick={apply} disabled={disabled}>Confirm change</button><button class="btn btn-dark" onclick={() => preview = null}>Cancel</button></div></div>
  {:else}
    <form onsubmit={review}>
      <label>Action<select bind:value={kind} disabled={disabled}>{#each Object.entries(labels) as [value, label]}<option {value}>{label}</option>{/each}</select></label>
      {#if kind === 'give-coins'}<label>Coin change (use a minus to deduct)<input type="number" step="1" bind:value={amount} disabled={disabled}/></label>{:else if kind === 'set-elo'}<label>New rating<input type="number" min="0" max="100000" step="1" bind:value={elo} disabled={disabled}/></label>{/if}
      <label>Reason<textarea bind:value={reason} maxlength="300" required rows="2" disabled={disabled}></textarea></label>
      {#if kind === 'set-elo' || kind === 'reset-stats'}<p>Available after the player leaves rooms and results and their game has settled.</p>{/if}
      <button class="btn btn-dark" disabled={disabled}>Review change</button>
    </form>
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
</section>
{/if}
<style>.actions{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;gap:14px;padding:16px;background:var(--surface);border-radius:var(--radius-md)}h3{font-size:16px}form,.review{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;gap:12px}label{display:grid;gap:6px;font-size:13px}input,select,textarea{width:100%;min-height:44px;padding:10px;border:1px solid var(--surface2);background:var(--bg);color:var(--text);border-radius:8px;font:inherit}.buttons{display:flex;flex-wrap:wrap;gap:8px}p{font-size:13px;color:var(--text-dim)}</style>
