<script>
  import { onMount } from 'svelte';
  import { user } from '$lib/stores/user.js';
  import { browseTab } from '$lib/stores/app.js';
  import { api } from '$lib/api.js';
  import { RANKED_TAX_RATE, SHOP_BURN_RATE, SHOP_VAULT_RATE, DAILY_BOUNTY_AMOUNT, MAX_DAILY_WINS_VS_SAME, MIN_WAGER_MOVES, MIN_WAGER_DURATION_MS } from '../../../shared/constants.js';

  let data = null;
  let pending = [];
  let error = '';
  let claiming = null;
  let showHowItWorks = false;

  onMount(async () => {
    try {
      const [treasury, myPending] = await Promise.all([
        api.get('/treasury'),
        api.get('/treasury/my-pending').catch(() => ({ pending: [] }))
      ]);
      data = treasury;
      pending = myPending.pending || [];
    } catch (e) { error = e.message; }
  });

  async function claim(id) {
    claiming = id;
    try {
      const result = await api.post('/treasury/claim', { payoutId: id });
      pending = pending.filter(p => p.id !== id);
      $user = { ...$user, coins: ($user?.coins || 0) + result.claimed };
      // Refresh treasury
      data = await api.get('/treasury');
    } catch (e) { error = e.message; }
    claiming = null;
  }

  function fmtDate(d) {
    return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="page-scroll">
  <div class="page-content treasury">
    <button class="btn btn-dark btn-small back" on:click={() => $browseTab = 'lobby'}>Back</button>

    <h2>Community Treasury</h2>
    <p class="subtitle">Every coin has a history. This economy belongs to the players.</p>

    {#if error}<p class="error">{error}</p>{/if}

    {#if !data}
      <div class="spinner"></div>
    {:else}
      <!-- Pending payouts for this user -->
      {#if pending.length > 0}
        <div class="card pending-section">
          <h3 class="section-title">Your Pending Payouts</h3>
          <p class="pending-note">These rewards are waiting for vault funds. Claim when available.</p>
          {#each pending as p}
            <div class="pending-row">
              <div class="pending-info">
                <span class="pending-label">{p.label || p.reason}</span>
                <span class="pending-amount">+{p.amount} coins</span>
              </div>
              <button class="btn btn-primary btn-small"
                on:click={() => claim(p.id)}
                disabled={claiming === p.id || data.vault.available < p.amount}>
                {#if claiming === p.id}
                  ...
                {:else if data.vault.available < p.amount}
                  Vault empty
                {:else}
                  Claim
                {/if}
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Main stats -->
      <div class="stat-grid">
        <div class="card stat-card vault-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <span class="stat-value">{data.vault.balance}</span>
          <span class="stat-label">Vault Balance</span>
          {#if data.vault.pendingOwed > 0}
            <span class="stat-owed">({data.vault.pendingOwed} owed to {data.vault.pendingCount} players)</span>
          {/if}
          <span class="stat-pct">{data.vault.percentOfTotal}% of all coins</span>
        </div>

        <div class="card stat-card circ-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8"/><path d="M12 18V6"/></svg>
          </div>
          <span class="stat-value">{data.circulation.total}</span>
          <span class="stat-label">In Circulation</span>
          <span class="stat-pct">{data.circulation.percentOfTotal}% held by players</span>
        </div>

        <div class="card stat-card burn-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M12 12c2-2.96 0-7-1-8 0 3.04-4 6.5-4 8 0 2.21 2.24 4 5 4s5-1.79 5-4c0-1.5-4-5-4-8-1 1-1 5.04-1 8z"/></svg>
          </div>
          <span class="stat-value">{data.burned.total}</span>
          <span class="stat-label">Burned Forever</span>
          <span class="stat-pct">{data.burned.percentOfTotal}% destroyed</span>
        </div>
      </div>

      <!-- Flow bar -->
      <div class="flow-bar">
        {#if data.economy.grandTotal > 0}
          <div class="flow-segment circ" style="width:{data.circulation.percentOfTotal}%"></div>
          <div class="flow-segment vault" style="width:{data.vault.percentOfTotal}%"></div>
          <div class="flow-segment burn" style="width:{data.burned.percentOfTotal}%"></div>
        {/if}
      </div>
      <div class="flow-legend">
        <span class="legend-item"><span class="ldot circ"></span> Players</span>
        <span class="legend-item"><span class="ldot vault"></span> Vault</span>
        <span class="legend-item"><span class="ldot burn"></span> Burned</span>
      </div>

      <!-- Vault activity log (main content) -->
      <div class="card logs-section">
        <h3 class="section-title">Vault Activity Stream</h3>
        {#if !data.logs || data.logs.length === 0}
          <p class="log-empty">No vault activity yet. Play some ranked games!</p>
        {:else}
          <div class="log-list">
            {#each data.logs as log}
              <div class="log-row">
                <span class="log-dir" class:log-in={log.direction === 'in'} class:log-out={log.direction === 'out'}>
                  {log.direction === 'in' ? '+' : '-'}{log.amount}
                </span>
                <div class="log-info">
                  <span class="log-reason">{log.reason}</span>
                  {#if log.detail}<span class="log-detail">{log.detail}</span>{/if}
                </div>
                <span class="log-time">{fmtDate(log.createdAt)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Economy details -->
      <div class="card details">
        <h3 class="section-title">Economy Stats</h3>
        <div class="detail-row"><span>Total coins ever created</span><strong>{data.economy.grandTotal}</strong></div>
        <div class="detail-row"><span>Active players</span><strong>{data.economy.totalPlayers}</strong></div>
        <div class="detail-row"><span>Games played</span><strong>{data.economy.gamesPlayed}</strong></div>
        <div class="detail-row"><span>Tax collected</span><strong>{data.economy.totalTaxCollected}</strong></div>
        <div class="detail-row"><span>Bounties paid</span><strong>{data.economy.totalBountiesPaid}</strong></div>
        <div class="detail-row"><span>Achievements paid</span><strong>{data.economy.totalAchievementsPaid}</strong></div>
      </div>

      <!-- How it works (collapsible) -->
      <div class="card how-it-works">
        <button class="hiw-toggle" on:click={() => showHowItWorks = !showHowItWorks}>
          <h3 class="section-title">How It Works</h3>
          <svg class="chevron" class:open={showHowItWorks} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {#if showHowItWorks}
          <div class="hiw-content">
            <div class="rule"><strong>{RANKED_TAX_RATE * 100}% Ranked Tax</strong><span>Every wager pot, {RANKED_TAX_RATE * 100}% goes to the Vault.</span></div>
            <div class="rule"><strong>Shop Burns</strong><span>{SHOP_BURN_RATE * 100}% of purchases destroyed. {SHOP_VAULT_RATE * 100}% to Vault.</span></div>
            <div class="rule"><strong>Daily Bounty</strong><span>First win of day earns {DAILY_BOUNTY_AMOUNT} coins from Vault.</span></div>
            <div class="rule"><strong>Milestones</strong><span>Bronze/Silver/Gold/Platinum/Diamond — one-time bonuses from Vault.</span></div>
            {#if MAX_DAILY_WINS_VS_SAME > 0}
              <div class="rule"><strong>Anti-Farming</strong><span>{MAX_DAILY_WINS_VS_SAME} wins/day vs same opponent max. After that, 100% tax.</span></div>
            {/if}
            <div class="rule"><strong>Wager Minimum</strong><span>{MIN_WAGER_MOVES}+ moves and {Math.round(MIN_WAGER_DURATION_MS / 60000)}+ minutes for wagers to count.</span></div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .treasury { align-items: center; position: relative; max-width: 560px; }
  .back { position: absolute; top: var(--sp-md); left: var(--sp-md); }
  h2 { font-size: var(--fs-heading); text-align: center; margin-top: var(--sp-lg); }
  .subtitle { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; max-width: 360px; }
  .error { color: var(--accent); font-size: var(--fs-caption); }

  /* Pending payouts */
  .pending-section { width: 100%; border-color: var(--warning); }
  .pending-note { font-size: var(--fs-caption); color: var(--text-dim); margin-bottom: var(--sp-sm); }
  .pending-row { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-xs) 0; border-bottom: 1px solid var(--surface2); }
  .pending-info { display: flex; flex-direction: column; }
  .pending-label { font-size: var(--fs-caption); color: var(--text); font-weight: 500; }
  .pending-amount { font-size: var(--fs-caption); color: var(--success); font-weight: 600; }

  /* Stats */
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-sm); width: 100%; }
  .stat-card { display: flex; flex-direction: column; align-items: center; gap: var(--sp-xs); padding: var(--sp-md) var(--sp-sm); text-align: center; }
  .stat-icon { color: var(--text-dim); }
  .stat-value { font-size: 1.5rem; font-weight: 700; }
  .stat-label { font-size: var(--fs-caption); color: var(--text-dim); font-weight: 600; }
  .stat-pct { font-size: 0.6rem; color: var(--text-dim); }
  .stat-owed { font-size: 0.6rem; color: var(--warning); }
  .vault-card .stat-value { color: var(--accent2); }
  .circ-card .stat-value { color: var(--success); }
  .burn-card .stat-value { color: var(--warning); }

  /* Flow bar */
  .flow-bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; width: 100%; background: var(--surface2); }
  .flow-segment { height: 100%; min-width: 2px; }
  .flow-segment.circ { background: var(--success); }
  .flow-segment.vault { background: var(--accent2); }
  .flow-segment.burn { background: var(--warning); }
  .flow-legend { display: flex; gap: var(--sp-md); justify-content: center; }
  .legend-item { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-caption); color: var(--text-dim); }
  .ldot { width: 8px; height: 8px; border-radius: 50%; }
  .ldot.circ { background: var(--success); }
  .ldot.vault { background: var(--accent2); }
  .ldot.burn { background: var(--warning); }

  /* Logs */
  .logs-section { width: 100%; }
  .log-empty { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; padding: var(--sp-lg); }
  .log-list { display: flex; flex-direction: column; max-height: 350px; overflow-y: auto; }
  .log-row { display: flex; align-items: flex-start; gap: var(--sp-sm); padding: var(--sp-sm) 0; border-bottom: 1px solid var(--surface2); font-size: var(--fs-caption); }
  .log-dir { font-weight: 700; min-width: 50px; font-family: var(--font-mono); flex-shrink: 0; }
  .log-in { color: var(--success); }
  .log-out { color: var(--accent); }
  .log-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
  .log-reason { color: var(--text); font-weight: 500; }
  .log-detail { color: var(--text-dim); font-size: 0.6rem; word-break: break-word; }
  .log-time { color: var(--text-dim); font-size: 0.6rem; flex-shrink: 0; }

  /* Details */
  .details { width: 100%; }
  .detail-row { display: flex; justify-content: space-between; padding: var(--sp-xs) 0; border-bottom: 1px solid var(--surface2); font-size: var(--fs-caption); }
  .detail-row span { color: var(--text-dim); }
  .detail-row strong { color: var(--text); }

  .how-it-works { width: 100%; }
  .hiw-toggle {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; background: none; border: none; cursor: pointer;
    padding: 0; color: var(--text);
  }
  .chevron { color: var(--text-dim); transition: transform 0.2s; }
  .chevron.open { transform: rotate(180deg); }
  .hiw-content { display: flex; flex-direction: column; gap: var(--sp-sm); padding-top: var(--sp-sm); }
  .rule { display: flex; flex-direction: column; gap: 2px; }
  .rule strong { font-size: var(--fs-caption); color: var(--text); }
  .rule span { font-size: var(--fs-caption); color: var(--text-dim); }

  @media (max-width: 480px) {
    .stat-grid { grid-template-columns: 1fr; }
    .stat-card { flex-direction: row; gap: var(--sp-sm); text-align: left; }
    .stat-icon { flex-shrink: 0; }
  }
</style>
