<script>
  import { onMount } from 'svelte';
  import { screen, gameState } from '../stores/app.js';
  import { user, token } from '../stores/user.js';
  import { api } from '../lib/api.js';
  import { getSocket, connectSocket, disconnectSocket } from '../lib/socket.js';

  let leaderboard = [];
  let socket = null;
  let showThemes = false;

  const themes = [
    { name: 'Default', vars: {} },
    { name: 'Ocean', vars: { '--bg':'#0a1628','--surface':'#0d2137','--surface2':'#0a3d62','--accent':'#00b4d8','--accent2':'#0077b6','--board-light':'#a8c4d4','--board-dark':'#2a6f97' } },
    { name: 'Forest', vars: { '--bg':'#1a2e1a','--surface':'#1e3a1e','--surface2':'#2d5a27','--accent':'#7bc950','--accent2':'#3a7d2c','--board-light':'#c5d5a3','--board-dark':'#4a7c3f' } },
    { name: 'Sunset', vars: { '--bg':'#2d1b2e','--surface':'#3d2040','--surface2':'#5c2d5e','--accent':'#ff6b6b','--accent2':'#c44569','--board-light':'#e8c49a','--board-dark':'#b5564a' } },
    { name: 'Midnight', vars: { '--bg':'#0d0d1a','--surface':'#12122a','--surface2':'#1a1a3e','--accent':'#7c5cbf','--accent2':'#4a3580','--board-light':'#9a96a8','--board-dark':'#3d3a54' } }
  ];

  let activeTheme = localStorage.getItem('checkers_theme') || 'Default';

  function applyTheme(theme) {
    activeTheme = theme.name;
    localStorage.setItem('checkers_theme', theme.name);
    const defaults = { '--bg':'#1a1a2e','--surface':'#16213e','--surface2':'#0f3460','--accent':'#e94560','--accent2':'#533483','--board-light':'#c8b078','--board-dark':'#6b8e4e' };
    const vars = Object.keys(theme.vars).length > 0 ? theme.vars : defaults;
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }

  onMount(async () => {
    const saved = themes.find(t => t.name === activeTheme);
    if (saved) applyTheme(saved);

    try {
      const data = await api.get('/leaderboard');
      leaderboard = data.players;
    } catch {}

    // Refresh user data
    try {
      const data = await api.get('/auth/me');
      $user = data.user;
    } catch {}

    socket = getSocket() || connectSocket();
    if (socket) socket.on('matchmaking:found', onMatchFound);
    return () => { if (socket) socket.off('matchmaking:found', onMatchFound); };
  });

  function onMatchFound(data) {
    $gameState = { gameId: data.gameId, myColor: data.yourColor, opponentName: data.opponent.username, opponentId: data.opponent.id };
    $screen = 'wheel';
  }

  function findOpponent() {
    socket?.emit('matchmaking:join', { elo: $user?.elo || 1000 });
    $screen = 'search';
  }

  function playBot() {
    $gameState = { gameId: null, myColor: null, opponentName: 'The Colonel', mode: 'bot' };
    $screen = 'wheel';
  }

  function logout() {
    disconnectSocket();
    $token = null;
    $user = null;
    $screen = 'auth';
  }
</script>

<div class="lobby-layout">
  <div class="top-header">
    <h1 class="title">Checkers <span>Online</span></h1>
    <div class="card user-bar">
      <div class="user-info">
        <strong>{$user?.username}</strong>
        <span class="stat">ELO {$user?.elo || 1000}</span>
        <span class="stat gold">{$user?.coins || 0} coins</span>
      </div>
      <button class="btn btn-dark btn-small" on:click={logout}>Logout</button>
    </div>
  </div>

  <div class="lobby-center">
    <div class="play-section">
      <div class="play-buttons">
        <button class="btn btn-primary" on:click={findOpponent}>Find Opponent</button>
        <button class="btn btn-secondary" on:click={playBot}>Play vs The Colonel</button>
        <button class="btn btn-dark" on:click={() => $screen = 'friend-game'}>Play vs Friend</button>
      </div>

      <button class="btn btn-dark btn-small" on:click={() => showThemes = !showThemes}>
        {showThemes ? 'Hide themes' : 'Change theme'}
      </button>

      {#if showThemes}
        <div class="theme-picker">
          {#each themes as theme}
            <button class="theme-chip" class:active={activeTheme === theme.name}
              on:click={() => applyTheme(theme)}
              style="background:{theme.vars['--bg']||'#1a1a2e'};border-color:{theme.vars['--accent']||'#e94560'}">
              <span class="theme-dot" style="background:{theme.vars['--accent']||'#e94560'}"></span>
              {theme.name}
            </button>
          {/each}
        </div>
      {/if}

      {#if $user?.friendCode}
        <p class="friend-code">Friend code: <strong>{$user.friendCode}</strong></p>
      {/if}
    </div>

    <div class="card leaderboard">
      <h3 class="section-title">Leaderboard</h3>
      <table>
        <thead>
          <tr><th class="rank">#</th><th>Player</th><th>ELO</th><th class="w">W</th><th class="l">L</th></tr>
        </thead>
        <tbody>
          {#if leaderboard.length === 0}
            <tr><td colspan="5" class="empty">No games yet</td></tr>
          {:else}
            {#each leaderboard.slice(0, 10) as p, i}
              <tr class:me={p.id === $user?.id}>
                <td class="rank">{i + 1}</td>
                <td>{p.username}</td>
                <td>{p.elo}</td>
                <td class="w">{p.wins}</td>
                <td class="l">{p.losses}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
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
    flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center;
    gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md);
    padding-top: max(var(--sp-sm), env(safe-area-inset-top));
  }
  .user-bar {
    display: flex; align-items: center; justify-content: space-between;
    gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md);
    border-radius: var(--radius-lg); width: 100%; max-width: 520px;
  }
  .lobby-center {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: var(--sp-md); padding: var(--sp-md);
    overflow-y: auto;
    max-width: 520px; width: 100%; margin: 0 auto;
  }
  .title { font-size: var(--fs-title); letter-spacing: 2px; color: var(--accent); text-align: center; }
  .title span { color: var(--text); font-weight: 300; }

  .user-info { display: flex; flex-wrap: wrap; gap: var(--sp-sm); align-items: center; }
  .user-info strong { font-size: var(--fs-body); }
  .stat { font-size: var(--fs-caption); color: var(--text-dim); background: var(--surface2); padding: 2px var(--sp-sm); border-radius: var(--radius-sm); }
  .gold { color: var(--gold); }

  .play-section {
    display: flex; flex-direction: column; align-items: center;
    gap: var(--sp-md); width: 100%;
    padding: var(--sp-lg) 0;
  }
  .play-buttons {
    display: flex; gap: var(--sp-md); flex-wrap: wrap; justify-content: center;
  }
  .play-buttons .btn {
    padding: var(--sp-md) var(--sp-xl);
    font-size: 1.05rem;
  }

  .theme-picker { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; }
  .theme-chip {
    display: flex; align-items: center; gap: var(--sp-xs);
    padding: var(--sp-xs) var(--sp-md); border-radius: var(--radius-pill);
    border: 2px solid; cursor: pointer; color: #eee; font-size: var(--fs-caption); font-weight: 600;
    transition: transform 0.1s;
  }
  .theme-chip:hover { transform: scale(1.05); }
  .theme-chip.active { outline: 2px solid #fff; outline-offset: 2px; }
  .theme-dot { width: 10px; height: 10px; border-radius: 50%; }

  .friend-code { font-size: var(--fs-caption); color: var(--text-dim); }
  .friend-code strong { color: var(--accent); letter-spacing: 2px; font-family: var(--font-mono); }

  .leaderboard { width: 100%; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: var(--fs-caption); color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; padding: 3px var(--sp-sm); text-align: left; border-bottom: 1px solid var(--surface2); }
  td { padding: 5px var(--sp-sm); font-size: var(--fs-body); }
  .rank { color: var(--text-dim); width: 28px; }
  .w { color: var(--success); }
  .l { color: var(--accent); }
  .empty { text-align: center; color: var(--text-dim); padding: var(--sp-md); }
  .me { background: rgba(233, 69, 96, 0.1); }

  @media (min-width: 900px) {
    .lobby-center { max-width: 580px; }
    .play-buttons .btn {
      padding: var(--sp-md) 48px;
      font-size: 1.1rem;
    }
  }
</style>
