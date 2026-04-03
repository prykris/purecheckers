<script>
  import { onMount } from 'svelte';
  import { user, token } from '$lib/stores/user.js';
  import { browseTab } from '$lib/stores/app.js';
  import { api } from '$lib/api.js';
  import { reconnectSocket } from '$lib/socketService.js';
  import { disconnectSocket } from '$lib/socket.js';

  let games = [];
  let loading = true;

  // Guest upgrade form
  let upgradeEmail = '';
  let upgradePassword = '';
  let upgradeName = '';
  let upgradeError = '';
  let upgrading = false;

  async function upgrade() {
    upgradeError = '';
    if (!upgradeEmail || !upgradePassword) { upgradeError = 'Email and password required'; return; }
    if (upgradePassword.length < 6) { upgradeError = 'Password must be at least 6 characters'; return; }
    upgrading = true;
    try {
      const data = await api.post('/auth/upgrade', {
        email: upgradeEmail,
        password: upgradePassword,
        username: upgradeName || undefined
      });
      $token = data.token;
      $user = data.user;
      upgradeError = '';
      // Reconnect socket with new identity — sync:state resets all stores
      await reconnectSocket();
    } catch (err) {
      upgradeError = err?.message || 'Something went wrong';
    }
    upgrading = false;
  }

  $: winRate = $user?.gamesPlayed > 0 ? Math.round(($user.wins / $user.gamesPlayed) * 100) : 0;
  $: initials = ($user?.username || '?').slice(0, 2).toUpperCase();
  $: avatarHue = ($user?.username || '').split('').reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  $: memberSince = $user?.createdAt ? new Date($user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

  onMount(async () => {
    try {
      const data = await api.get('/auth/history');
      games = data.games || [];
    } catch {}
    loading = false;
  });

  function logout() {
    disconnectSocket();
    disconnectSocket(); $token = null; $user = null;
  }

  function fmtDate(d) {
    const dt = new Date(d);
    const now = new Date();
    const diff = now - dt;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

<div class="profile-layout">
  <div class="profile-content">
    <button class="back-btn" on:click={() => $browseTab = 'lobby'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
      Back
    </button>

    <!-- Avatar + name -->
    <div class="avatar-section">
      <div class="avatar" style="background: hsl({avatarHue}, 45%, 35%)">
        <span>{initials}</span>
      </div>
      <h2 class="username">{$user?.username || 'Player'}</h2>
      {#if $user?.isGuest}
        <span class="guest-tag">Guest</span>
      {:else if memberSince}
        <span class="member-since">Since {memberSince}</span>
      {/if}
    </div>

    {#if $user?.isGuest}
      <div class="card upgrade-card">
        <h3>Create an Account</h3>
        <p class="upgrade-hint">Keep your progress, earn ELO, and unlock rewards.</p>
        {#if upgradeError}<p class="upgrade-error">{upgradeError}</p>{/if}
        <input class="input" type="text" placeholder="Username (keep current if empty)" bind:value={upgradeName} />
        <input class="input" type="email" placeholder="Email" bind:value={upgradeEmail} />
        <input class="input" type="password" placeholder="Password (6+ chars)" bind:value={upgradePassword}
          on:keydown={(e) => e.key === 'Enter' && upgrade()} />
        <button class="btn btn-primary full-w" on:click={upgrade} disabled={upgrading}>
          {upgrading ? 'Creating...' : 'Create Account'}
        </button>
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

    <!-- Match history -->
    <div class="history-section">
      <h3>Recent Games</h3>
      {#if loading}
        <p class="empty">Loading...</p>
      {:else if games.length === 0}
        <p class="empty">No games played yet</p>
      {:else}
        <div class="history-list">
          {#each games as g}
            <div class="history-row" class:win={g.result === 'win'} class:loss={g.result === 'loss'} class:draw={g.result === 'draw'}>
              <div class="h-result">
                {#if g.result === 'win'}W{:else if g.result === 'loss'}L{:else}D{/if}
              </div>
              <div class="h-info">
                <span class="h-opponent">vs {g.opponent}</span>
                <span class="h-meta">
                  <span class="h-color {g.myColor}"></span>
                  {g.mode === 'RANKED' ? 'Ranked' : g.mode === 'BOT' ? 'Bot' : 'Friendly'}
                </span>
              </div>
              <div class="h-stats">
                {#if g.eloChange !== 0}
                  <span class="h-elo" class:positive={g.eloChange > 0}>{g.eloChange > 0 ? '+' : ''}{g.eloChange}</span>
                {/if}
                {#if g.coinsEarned > 0}
                  <span class="h-coins">+{g.coinsEarned}c</span>
                {/if}
              </div>
              <span class="h-date">{fmtDate(g.date)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <button class="btn btn-dark logout-btn" on:click={logout}>Logout</button>
  </div>
</div>

<style>
  .profile-layout {
    position: fixed; inset: 0;
    display: flex; align-items: flex-start; justify-content: center;
    background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg) 30%);
    padding: var(--sp-md);
    padding-top: max(var(--sp-md), env(safe-area-inset-top));
    padding-bottom: calc(var(--tab-height) + var(--sp-md) + env(safe-area-inset-bottom, 0px));
    overflow-y: auto;
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
  .upgrade-hint { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; }
  .upgrade-error { font-size: var(--fs-caption); color: var(--accent); text-align: center; }
  .full-w { width: 100%; }

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

  .history-section { width: 100%; }
  .history-section h3 { font-size: var(--fs-body); margin-bottom: var(--sp-sm); }
  .empty { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; padding: var(--sp-lg) 0; }

  .history-list { display: flex; flex-direction: column; gap: var(--sp-xs); }
  .history-row {
    display: flex; align-items: center; gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md);
  }
  .h-result {
    width: 24px; height: 24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.65rem; font-weight: 700; flex-shrink: 0;
  }
  .history-row.win .h-result { background: rgba(34,197,94,0.15); color: var(--success); }
  .history-row.loss .h-result { background: rgba(239,68,68,0.15); color: var(--accent); }
  .history-row.draw .h-result { background: rgba(168,162,158,0.15); color: var(--text-dim); }

  .h-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
  .h-opponent { font-size: var(--fs-caption); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .h-meta { display: flex; align-items: center; gap: 4px; font-size: 0.6rem; color: var(--text-dim); }
  .h-color { width: 6px; height: 6px; border-radius: 50%; }
  .h-color.red { background: var(--red-piece); }
  .h-color.black { background: var(--black-piece); border: 1px solid #555; }

  .h-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex-shrink: 0; }
  .h-elo { font-size: 0.65rem; font-weight: 600; color: var(--accent); }
  .h-elo.positive { color: var(--success); }
  .h-coins { font-size: 0.6rem; color: var(--gold); }
  .h-date { font-size: 0.55rem; color: var(--text-dim); flex-shrink: 0; }

  .logout-btn { width: 100%; max-width: 200px; }
</style>
