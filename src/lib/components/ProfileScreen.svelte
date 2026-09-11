<script>
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { safeReturnTo } from '$lib/siteNavigation.js';
  import PlayerLink from './PlayerLink.svelte';
  import { onMount } from 'svelte';
  import { browseTo } from '$lib/stores/navigation.js';
  import { user, captureSession, isCurrentSession, clearSession } from '$lib/stores/user.js';
  import { openUpgradeSheet } from '$lib/stores/ui.js';
  import ShopScreen from './ShopScreen.svelte';
  import GameLog from './GameLog.svelte';
  import ShareActions from './ShareActions.svelte';
  import { api, refreshSession } from '$lib/api.js';
  import { ProfileSettingsClient } from '$lib/profileSettingsClient.js';
  import { withDeadline } from '$lib/actions/deadline.js';
  import { FEEDBACK_URL } from '../../../shared/feedback.js';
  let privacy;
  const settings = new ProfileSettingsClient({ readProfile: () => $user, capture: captureSession, isCurrent: isCurrentSession,
    write: (body, scope) => withDeadline(signal => api.patch('/auth/profile', body, { signal, authToken: scope.token }), 'Privacy confirmation timed out. Refresh to check the current setting.'),
    refresh: refreshSession, publish: value => { privacy = value; } });
  onMount(() => {
    let generation;
    const unsubscribe = user.subscribe(() => {
      const next = captureSession().generation;
      if (next !== generation) { generation = next; settings.reset(); }
    });
    return () => { unsubscribe(); settings.dispose(); };
  });
  function changePrivacy(event) {
    const profilePublic = event.currentTarget.checked;
    // Display the confirmed setting while the request is pending.
    event.currentTarget.checked = $user?.profilePublic !== false;
    void settings.change(profilePublic);
  }

  $: winRate = $user?.gamesPlayed > 0 ? Math.round(($user.wins / $user.gamesPlayed) * 100) : 0;
  $: initials = ($user?.username || '?').slice(0, 2).toUpperCase();
  $: avatarHue = ($user?.username || '').split('').reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  $: memberSince = $user?.createdAt ? new Date($user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

  function logout() {
    clearSession();
  }
</script>

<div class="profile-layout">
  <div class="profile-content">
    <button class="back-btn" on:click={() => goto(safeReturnTo(page.state.returnTo))}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
      Back
    </button>

    <!-- Avatar + name -->
    <div class="avatar-section">
      <div class="avatar" style="background: hsl({avatarHue}, 45%, 35%)">
        <span>{initials}</span>
      </div>
      <h2 class="username"><PlayerLink username={$user?.username} profilePublic={$user?.profilePublic} /></h2>
      {#if $user?.isGuest}
        <span class="guest-tag">Guest</span>
      {:else if memberSince}
        <span class="member-since">Since {memberSince}</span>
      {/if}
    </div>

    {#if $user?.isGuest}
      <div class="card upgrade-card">
        <h3>Keep <PlayerLink username={$user.username} profilePublic={$user.profilePublic} /></h3>
        <p class="upgrade-hint">Save an account to keep your name, your game history and your rating. Guest names expire.</p>
        <button class="btn btn-primary full-w" on:click={openUpgradeSheet}>Save account</button>
      </div>
    {/if}

    <!-- Stats grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-value">{$user?.elo || 1000}</span>
        <span class="stat-label">ELO</span>
        {#if $user?.peakElo && $user.peakElo > ($user?.elo || 1000)}
          <span class="stat-sub">Peak: {$user.peakElo}</span>
        {/if}
      </div>
      <div class="stat-card">
        <span class="stat-value">{$user?.gamesPlayed || 0}</span>
        <span class="stat-label">Games</span>
      </div>
      <div class="stat-card">
        <span class="stat-value win">{$user?.wins || 0}</span>
        <span class="stat-label">Wins</span>
      </div>
      <div class="stat-card">
        <span class="stat-value loss">{$user?.losses || 0}</span>
        <span class="stat-label">Losses</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{winRate}%</span>
        <span class="stat-label">Win Rate</span>
      </div>
      <div class="stat-card">
        <span class="stat-value gold">{$user?.coins || 0}</span>
        <span class="stat-label">Coins</span>
      </div>
    </div>

    {#if $user?.friendCode}
      <div class="friend-code">
        <span class="fc-label">Friend Code</span>
        <span class="fc-value">{$user.friendCode}</span>
      </div>
    {/if}

    <GameLog mode="personal" />

    <section class="card privacy" aria-labelledby="profile-privacy-title" aria-busy={privacy.busy}>
      <h3 id="profile-privacy-title">Public profile</h3>
      <label><input type="checkbox" checked={$user?.profilePublic !== false} disabled={privacy.busy || privacy.needsRefresh || !$user} on:change={changePrivacy} /> Allow people to view my profile</label>
      <p>Turning this off hides your profile and its preview image. Your name and ranking remain on the leaderboard, and your name remains in shared games.</p>
      {#if privacy.busy}<p role="status">Checking your privacy setting…</p>{/if}
      {#if privacy.error}<p role="alert">{privacy.error}</p>{/if}
      {#if privacy.success}<p role="status">{privacy.success}</p>{/if}
      {#if privacy.needsRefresh}<button class="btn btn-dark btn-small" disabled={privacy.busy} on:click={() => settings.refresh()}>Refresh account</button>{/if}
      {#if $user?.profilePublic !== false}<ShareActions surface="profile" url={'/player/' + encodeURIComponent($user?.username ?? '')} data={{ ...$user, ownProfile: true }} label="Share my profile" />{/if}
    </section>

    <section class="card appearance" aria-labelledby="appearance-title">
      <h3 id="appearance-title">Appearance</h3>
      <ShopScreen appearanceOnly />
    </section>
    <a href={FEEDBACK_URL}>Report a problem on GitHub</a>

    <button class="btn btn-dark treasury-btn" on:click={() => browseTo('treasury')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      Community Treasury
    </button>
    <button class="btn btn-dark logout-btn" on:click={logout}>Logout</button>
  </div>
</div>

<style>
  .privacy { width: 100%; display: grid; gap: var(--sp-sm); }
  .privacy label { min-height: 44px; display: flex; align-items: center; gap: var(--sp-sm); }
  .privacy p { font-size: var(--fs-caption); color: var(--text-dim); line-height: 1.7; }
  .profile-layout {
    position: absolute; inset: 0;
    display: flex; align-items: flex-start; justify-content: center;
    background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg) 30%);
    padding: var(--sp-md);
    padding-top: max(var(--sp-md), env(safe-area-inset-top));
    padding-bottom: var(--sp-md);
    overflow-y: auto; overflow-x: hidden;
  }
  .back-btn {
    align-self: flex-start;
    display: flex; align-items: center; gap: var(--sp-xs);
    background: none; border: none; color: var(--text-dim);
    font-family: var(--font); font-size: var(--fs-caption); font-weight: 600;
    cursor: pointer; padding: var(--sp-xs) 0;
  }
  .back-btn:hover { color: var(--text); }

  .profile-content {
    width: 100%; max-width: 480px;
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg);
  }

  .avatar-section { display: flex; flex-direction: column; align-items: center; gap: var(--sp-xs); }
  .avatar {
    width: 72px; height: 72px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.5rem; font-weight: 700; color: rgba(255,255,255,0.9);
    border: 3px solid var(--surface2);
  }
  .username { font-size: var(--fs-heading); font-weight: 700; }
  .guest-tag {
    font-size: 0.6rem; color: var(--warning); font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px;
    background: rgba(245,158,11,0.1); padding: 2px 8px; border-radius: var(--radius-pill);
  }
  .member-since { font-size: var(--fs-caption); color: var(--text-dim); }

  .upgrade-card {
    width: 100%; display: flex; flex-direction: column; gap: var(--sp-sm);
    padding: var(--sp-lg); border-color: var(--accent2);
  }
  .upgrade-card h3 { font-size: var(--fs-body); text-align: center; }
  .upgrade-hint { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; line-height: 1.45; }
  .full-w { width: 100%; min-height: 44px; }

  .appearance { width: 100%; display: flex; flex-direction: column; gap: var(--sp-sm); }
  .appearance h3 { font-size: var(--fs-caption); color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }

  .stats-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-sm);
    width: 100%;
  }
  .stat-card {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: var(--sp-sm); background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md);
  }
  .stat-value { font-size: 1.2rem; font-weight: 700; }
  .stat-value.win { color: var(--success); }
  .stat-value.loss { color: var(--accent); }
  .stat-value.gold { color: var(--gold); }
  .stat-label { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; }
  .stat-sub { font-size: 0.55rem; color: var(--text-dim); }

  .friend-code {
    display: flex; align-items: center; gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md); width: 100%;
    justify-content: center;
  }
  .fc-label { font-size: var(--fs-caption); color: var(--text-dim); }
  .fc-value { font-family: var(--font-mono); font-weight: 700; letter-spacing: 2px; color: var(--accent); }


  .logout-btn { width: 100%; max-width: 200px; }
</style>
