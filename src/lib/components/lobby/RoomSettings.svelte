<script>
  import { untrack } from 'svelte';
  import Modal from '../Modal.svelte';
  import { sendCommand, session } from '$lib/stores/session.js';

  // One form for room creation and host edits. Draft values never replace snapshots.
  let { defaultPrivate = false, room = null, focusField = 'buyIn', onclose = null } = $props();
  const initial = untrack(() => room);
  const editing = !!initial;

  let buyIn = $state(initial?.settings.buyIn ?? 0);
  let turnTimer = $state(initial?.settings.turnTimer ?? 60);
  let isPrivate = $state(initial?.settings.isPrivate ?? untrack(() => defaultPrivate));
  let allowSpectators = $state(initial?.settings.allowSpectators ?? true);
  let error = $state('');
  const creating = $derived(['room:create', 'room:settings'].includes($session.pending));
  const unavailable = $derived($session.status !== 'ready' || !!$session.pending || (editing && (!room?.canEditSettings || room.revision !== initial.revision)));

  async function create() {
    if (unavailable) return;
    const settings = { buyIn: Number(buyIn), turnTimer, isPrivate, allowSpectators, autoReady: false };
    const result = await sendCommand(editing ? 'room:settings' : 'room:create', editing ? { roomId: initial.id, expectedRevision: initial.revision, settings } : settings);
    error = result.error || '';
    if (result.ok) onclose?.();
  }
</script>

<Modal label={editing ? 'Room settings' : 'Create room'} busy={creating} on:close={() => onclose?.()}>
  <div class="card modal">
    <h3>{editing ? 'Room settings' : 'Create Room'}</h3>
    {#if editing && room?.revision !== initial.revision && !creating}<p class="error" role="status">The room changed. Close and reopen settings to review the latest state.</p>{/if}

    <label class="field">
      <span>Buy-in (coins)</span>
      <input class="input" type="number" min="0" bind:value={buyIn} data-initial-focus={focusField === 'buyIn' ? '' : undefined} />
    </label>

    <div class="field">
      <span>Turn timer</span>
      <div class="radio-row">
        {#each [30, 60, 90, 0] as t}
          <button type="button" class="chip" class:active={turnTimer === t} onclick={() => turnTimer = t} aria-pressed={turnTimer === t}
            data-initial-focus={focusField === 'turnTimer' && initial?.settings.turnTimer === t ? '' : undefined}>
            {t === 0 ? 'None' : `${t}s`}
          </button>
        {/each}
      </div>
    </div>

    <label class="field toggle-field">
      <span>Private room</span>
      <input type="checkbox" bind:checked={isPrivate} data-initial-focus={focusField === 'isPrivate' ? '' : undefined} />
    </label>

    <label class="field toggle-field">
      <span>Allow spectators</span>
      <input type="checkbox" bind:checked={allowSpectators} data-initial-focus={focusField === 'allowSpectators' ? '' : undefined} />
    </label>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <div class="modal-actions">
      <button type="button" class="btn btn-dark" onclick={() => onclose?.()}>Cancel</button>
      <button type="button" class="btn btn-primary" onclick={create} disabled={unavailable}>{creating ? 'Saving…' : editing ? 'Save settings' : 'Create Room'}</button>
    </div>
  </div>
</Modal>

<style>
  .modal {
    width: 100%; max-width: 360px;
    display: flex; flex-direction: column; gap: var(--sp-md);
    padding: var(--sp-lg);
  }
  h3 { font-size: var(--fs-heading); text-align: center; }
  .field { display: flex; flex-direction: column; gap: var(--sp-xs); }
  .field span { font-size: var(--fs-caption); color: var(--text-dim); font-weight: 500; }
  .toggle-field { flex-direction: row; align-items: center; justify-content: space-between; }
  .toggle-field input { width: 20px; height: 20px; accent-color: var(--accent); }
  .radio-row { display: flex; gap: var(--sp-xs); }
  .chip {
    min-height: 36px; padding: var(--sp-xs) var(--sp-md); border-radius: var(--radius-pill);
    background: var(--surface2); border: none; color: var(--text-dim);
    font-size: var(--fs-caption); font-family: var(--font); cursor: pointer;
  }
  .chip.active { background: var(--accent); color: #fff; }
  .error { color: var(--accent); font-size: var(--fs-caption); text-align: center; }
  .modal-actions { display: flex; gap: var(--sp-sm); }
  .modal-actions .btn { flex: 1; min-height: 44px; }
</style>
