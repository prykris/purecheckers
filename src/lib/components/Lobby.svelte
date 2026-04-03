<script>
  import { onMount } from 'svelte';
  import { presenceStats } from '$lib/stores/app.js';
  import { user, token } from '$lib/stores/user.js';
  import { disconnectSocket } from '$lib/socket.js';
  import { api } from '$lib/api.js';

  import PlayTabs from './lobby/PlayTabs.svelte';

  let showThemes = false;

  const themes = [
    // Dark themes
    { name: 'Default', vars: {} },
    { name: 'Ocean', vars: { '--bg':'#0a1628','--bg-subtle':'#0d1e30','--surface':'#0d2137','--surface2':'#0a3d62','--accent':'#00b4d8','--accent2':'#0077b6','--board-light':'#a8c4d4','--board-dark':'#2a6f97' } },
    { name: 'Forest', vars: { '--bg':'#1a2e1a','--bg-subtle':'#1e351e','--surface':'#1e3a1e','--surface2':'#2d5a27','--accent':'#7bc950','--accent2':'#3a7d2c','--board-light':'#c5d5a3','--board-dark':'#4a7c3f' } },
    { name: 'Sunset', vars: { '--bg':'#2d1b2e','--bg-subtle':'#35212e','--surface':'#3d2040','--surface2':'#5c2d5e','--accent':'#ff6b6b','--accent2':'#c44569','--board-light':'#e8c49a','--board-dark':'#b5564a' } },
    { name: 'Midnight', vars: { '--bg':'#0d0d1a','--bg-subtle':'#111122','--surface':'#12122a','--surface2':'#1a1a3e','--accent':'#7c5cbf','--accent2':'#4a3580','--board-light':'#9a96a8','--board-dark':'#3d3a54' } },
    // Light themes
    { name: 'Latte', vars: { '--bg':'#f5f0eb','--bg-subtle':'#ebe4dc','--surface':'#fff8f0','--surface2':'#e0d5c8','--accent':'#c0392b','--accent2':'#8e44ad','--text':'#2c2017','--text-dim':'#7a6e60','--board-light':'#f0d9b5','--board-dark':'#b58863','--gold':'#d4920a','--success':'#1e8449','--warning':'#d68910' } },
    { name: 'Paper', vars: { '--bg':'#f0f0f0','--bg-subtle':'#e8e8e8','--surface':'#ffffff','--surface2':'#d4d4d4','--accent':'#2563eb','--accent2':'#7c3aed','--text':'#1a1a1a','--text-dim':'#6b7280','--board-light':'#e8d5b0','--board-dark':'#a07850','--gold':'#b8860b','--success':'#16a34a','--warning':'#d97706' } },
    { name: 'Sand', vars: { '--bg':'#f5f1e8','--bg-subtle':'#ede7d9','--surface':'#faf7f0','--surface2':'#ddd6c6','--accent':'#d97706','--accent2':'#9333ea','--text':'#292017','--text-dim':'#8a7e6e','--board-light':'#e8d4a8','--board-dark':'#9e7e50','--gold':'#c08000','--success':'#15803d','--warning':'#c2410c' } },
    { name: 'Cloud', vars: { '--bg':'#eef2f7','--bg-subtle':'#e3e9f0','--surface':'#f8fafc','--surface2':'#cbd5e1','--accent':'#0ea5e9','--accent2':'#6366f1','--text':'#0f172a','--text-dim':'#64748b','--board-light':'#c8dae8','--board-dark':'#5b7fa0','--gold':'#a87d00','--success':'#059669','--warning':'#ea580c' } },
  ];

  let activeTheme = localStorage.getItem('checkers_theme') || 'Default';

  function applyTheme(theme) {
    activeTheme = theme.name;
    localStorage.setItem('checkers_theme', theme.name);
    localStorage.setItem('checkers_theme_vars', JSON.stringify(theme.vars));
    const defaults = {
      '--bg':'#1c1917','--bg-subtle':'#231f1b','--surface':'#292524','--surface2':'#3d3530',
      '--accent':'#ef4444','--accent2':'#a855f7','--text':'#fafaf9','--text-dim':'#a8a29e',
      '--board-light':'#d4a76a','--board-dark':'#7c5e3c','--gold':'#fbbf24','--success':'#22c55e','--warning':'#f59e0b'
    };
    const vars = Object.keys(theme.vars).length > 0 ? theme.vars : defaults;
    Object.entries(defaults).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }

  onMount(async () => {
    const saved = themes.find(t => t.name === activeTheme);
    if (saved) applyTheme(saved);

    try {
      const data = await api.get('/auth/me');
      $user = data.user;
    } catch {}

  });

  function logout() {
    disconnectSocket();
    disconnectSocket(); $token = null; $user = null;
  }
</script>

<div class="lobby-layout">
  <div class="top-header">
    <h1 class="title"><span>Pure</span> Checkers</h1>
    <div class="presence-stats">
      <span class="stat-pill online"><span class="pulse-dot"></span>{$presenceStats.online} online</span>
      {#if $presenceStats.lookingToPlay > 0}
        <span class="stat-pill looking">{$presenceStats.lookingToPlay} looking to play</span>
      {/if}
    </div>
    <div class="card user-bar">
      <div class="user-info">
        <strong>{$user?.username}</strong>
        <span class="stat">ELO {$user?.elo || 1000}</span>
        <span class="stat gold">{$user?.coins || 0} coins</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" on:click={() => showThemes = !showThemes} title="Theme">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </button>
        <button class="btn btn-dark btn-small" on:click={logout}>Logout</button>
      </div>
    </div>

    {#if showThemes}
      <div class="theme-picker">
        {#each themes as theme}
          <button class="theme-chip" class:active={activeTheme === theme.name}
            on:click={() => applyTheme(theme)}
            style="background:{theme.vars['--bg']||'#1c1917'};border-color:{theme.vars['--accent']||'#ef4444'};color:{theme.vars['--text']||'#fafaf9'}">
            <span class="theme-dot" style="background:{theme.vars['--accent']||'#ef4444'}"></span>
            {theme.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="lobby-center">
    <PlayTabs />

    {#if $user?.friendCode}
      <p class="friend-code">Your code: <strong>{$user.friendCode}</strong></p>
    {/if}

  </div>
</div>

<style>
  .lobby-layout {
    position: fixed; inset: 0;
    display: flex; flex-direction: column;
    background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg) 40%);
    padding-bottom: calc(var(--tab-height) + env(safe-area-inset-bottom, 0px));
  }
  .top-header {
    flex-shrink: 0; display: flex; flex-direction: column; align-items: center;
    gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md);
    padding-top: max(var(--sp-sm), env(safe-area-inset-top));
  }
  .title { font-size: var(--fs-title); letter-spacing: 2px; color: var(--accent); text-align: center; }
  .title span { color: var(--text); font-weight: 300; }

  .presence-stats { display: flex; gap: var(--sp-sm); align-items: center; justify-content: center; }
  .stat-pill {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.65rem; font-weight: 600; color: var(--text-dim);
    padding: 2px 10px; border-radius: var(--radius-pill);
    background: var(--surface); border: 1px solid var(--surface2);
  }
  .stat-pill.looking { color: var(--gold); }
  .pulse-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--success);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  .user-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-sm); width: 100%; max-width: 520px; }
  .user-info { display: flex; flex-wrap: wrap; gap: var(--sp-sm); align-items: center; }
  .user-info strong { font-size: var(--fs-body); }
  .stat { font-size: var(--fs-caption); color: var(--text-dim); background: var(--surface2); padding: 2px var(--sp-sm); border-radius: var(--radius-sm); }
  .gold { color: var(--gold); }
  .header-actions { display: flex; gap: var(--sp-sm); align-items: center; }

  .icon-btn {
    background: none; border: none; color: var(--text-dim); cursor: pointer;
    padding: var(--sp-xs); border-radius: var(--radius-sm);
    transition: color 0.15s;
  }
  .icon-btn:hover { color: var(--text); }

  .theme-picker { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; max-width: 520px; }
  .theme-chip {
    display: flex; align-items: center; gap: var(--sp-xs);
    padding: var(--sp-xs) var(--sp-md); border-radius: var(--radius-pill);
    border: 2px solid; cursor: pointer; font-size: var(--fs-caption); font-weight: 600;
    transition: transform 0.1s;
  }
  .theme-chip:hover { transform: scale(1.05); }
  .theme-chip.active { outline: 2px solid var(--accent); outline-offset: 2px; }
  .theme-dot { width: 10px; height: 10px; border-radius: 50%; }

  .lobby-center {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; gap: var(--sp-md); padding: var(--sp-sm) var(--sp-md);
    overflow-y: auto;
    max-width: 520px; width: 100%; margin: 0 auto;
  }

  .friend-code { font-size: var(--fs-caption); color: var(--text-dim); }
  .friend-code strong { color: var(--accent); letter-spacing: 2px; font-family: var(--font-mono); }

</style>
