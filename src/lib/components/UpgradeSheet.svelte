<script>
  import { locale } from '$lib/stores/locale.js';
  import { siteText } from '$lib/siteCopy.js';
  let { inline = false } = $props();
  const text = value => siteText(value, $locale);
  import PlayerLink from './PlayerLink.svelte';
  import { untrack, onDestroy } from 'svelte';
  import { modal } from '$lib/modal.js';
  import { user, captureSession, isCurrentSession, acceptProfile } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';
  import { createAccountUpgrade } from '$lib/accountUpgrade.js';
  import { upgradeSheetOpen, closeUpgradeSheet, showNotice } from '$lib/stores/ui.js';
  import { track } from '$lib/analytics.js';

  // Mounted at the site layout level so it survives the post-game cleanup. On success
  // the token is stored and play continues: the socket identity is the user id, so the
  // board and the connection stay where they are.
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let saving = $state(false);
  let uncertain = $state(false);
  const upgrade = createAccountUpgrade({
    api, readIdentity: () => ({ id: $user?.id, ...captureSession() }),
    accept: (data, identity) => acceptProfile(data, identity)
  });
  onDestroy(() => upgrade.dispose());

  const open = $derived((inline || $upgradeSheetOpen) && !!$user?.isGuest);
  const currentName = $derived($user?.username || '');

  $effect(() => {
    if (!open) return;
    // Reset the form when the sheet opens; a later profile refresh must not wipe typing.
    untrack(() => { name = currentName; email = ''; password = ''; error = ''; uncertain = false; });
  });
  async function save() {
    if (saving || !$user?.isGuest) return;
    error = '';
    if (!email || !password) { error = 'Email and password are required.'; return; }
    if (password.length < 6) { error = 'Password must be at least 6 characters.'; return; }
    await run(() => upgrade.save({ username: name.trim() || undefined, email: email.trim(), password }));
  }
  async function run(action) {
    if (saving) return;
    const scope = captureSession();
    saving = true; error = '';
    try {
      const result = await action();
      if (result.status === 'superseded' || !isCurrentSession(scope)) return;
      uncertain = result.status === 'pending';
      if (result.status !== 'saved') { error = result.message; return; }
      password = '';
      track('guest_upgraded');
      closeUpgradeSheet();
      showNotice(`Account saved. Welcome, ${result.user.username}.`);
    } finally { saving = false; }
  }
</script>

{#snippet accountForm()}
    <form class="sheet" onsubmit={e => { e.preventDefault(); save(); }}>
      <h2 id="upgrade-title">{text('Keep')} <PlayerLink username={currentName} profilePublic={$user?.profilePublic} /></h2>
      <p class="hint">{text('Your name, your games and your rating stay with the account.')}</p>
      <label class="field">
        <span>{text('Name')}</span>
        <input class="input" type="text" bind:value={name} data-initial-focus maxlength="20" autocomplete="username" />
      </label>
      <label class="field">
        <span>{text('Email')}</span>
        <input class="input" type="email" bind:value={email} required autocomplete="email" />
      </label>
      <label class="field">
        <span>{text('Password')}</span>
        <input class="input" type="password" bind:value={password} minlength="6" required autocomplete="new-password" />
      </label>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if uncertain}<button type="button" class="btn btn-dark" disabled={saving} onclick={() => run(() => upgrade.recover())}>Check saved account</button>{/if}
      <div class="actions">
        {#if !inline}<button type="button" class="btn btn-dark" onclick={closeUpgradeSheet} disabled={saving}>{text('Not now')}</button>{/if}
        <button type="submit" class="btn btn-primary" disabled={saving}>{text(saving ? 'Saving…' : 'Save account')}</button>
      </div>
    </form>
{/snippet}
{#if open}
  {#if inline}<div class="inline-upgrade">{@render accountForm()}</div>
  {:else}<dialog class="scrim" aria-labelledby="upgrade-title" use:modal={{ busy: saving, onclose: closeUpgradeSheet }}>{@render accountForm()}</dialog>{/if}
{/if}

<style>
  .inline-upgrade .sheet { border-radius: var(--radius-md); animation: none; }
  .scrim {
    width: min(100%, 420px); max-width: 100%; max-height: calc(100dvh - var(--sp-md));
    margin: auto auto 0; padding: 0; border: none; background: transparent; color: var(--text);
  }
  .scrim::backdrop { background: rgba(0,0,0,0.6); }
  .sheet {
    width: 100%; max-width: 420px;
    display: flex; flex-direction: column; gap: var(--sp-sm);
    padding: var(--sp-lg) var(--sp-md);
    padding-bottom: max(var(--sp-lg), env(safe-area-inset-bottom));
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    animation: sheet-in 0.18s ease-out;
  }
  @keyframes sheet-in { from { transform: translateY(16px); opacity: 0; } to { transform: none; opacity: 1; } }
  h2 { font-size: var(--fs-heading); font-weight: 700; }
  .hint { font-size: var(--fs-caption); color: var(--text-dim); }
  .field { display: flex; flex-direction: column; gap: var(--sp-xs); }
  .field span { font-size: var(--fs-caption); color: var(--text-dim); font-weight: 500; }
  .error { color: var(--accent); font-size: var(--fs-caption); }
  .actions { display: flex; gap: var(--sp-sm); margin-top: var(--sp-xs); }
  .actions .btn { flex: 1; min-height: 48px; }
  @media (min-width: 600px) {
    .scrim { margin: auto; }
    .sheet { border-radius: var(--radius-lg); }
  }
  @media (prefers-reduced-motion: reduce) { .sheet { animation: none; } }
</style>
