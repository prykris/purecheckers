<script>
  import { onMount } from 'svelte';
  import { screen, gameState } from '../stores/app.js';
  import { user, token } from '../stores/user.js';
  import { api } from '../lib/api.js';
  import { getSocket, connectSocket, disconnectSocket } from '../lib/socket.js';

  let leaderboard = [];
  let socket = null;

  onMount(async () => {
    try {
      const data = await api.get('/leaderboard');
      leaderboard = data.players;
    } catch {}

    socket = getSocket() || connectSocket();
    if (socket) {
      socket.on('matchmaking:found', onMatchFound);
    }

    return () => {
      if (socket) socket.off('matchmaking:found', onMatchFound);
    };
  });

  function onMatchFound(data) {
    $gameState = {
      gameId: data.gameId,
      myColor: data.yourColor,
      opponentName: data.opponent.username,
      opponentId: data.opponent.id
    };
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

<div class="lobby">
  <h1 class="title">Checkers <span>Online</span></h1>

  <div class="user-bar">
    <div class="user-info">
      <strong>{$user?.username}</strong>
      <span class="stat">ELO {$user?.elo || 1000}</span>
      <span class="stat coins">{$user?.coins || 0} coins</span>
    </div>
    <div class="user-actions">
      <button class="btn btn-dark btn-small" on:click={logout}>Logout</button>
    </div>
  </div>

  <div class="play-buttons">
    <button class="btn btn-primary" on:click={findOpponent}>Find Opponent</button>
    <button class="btn btn-secondary" on:click={playBot}>Play vs The Colonel</button>
  </div>

  <div class="nav-buttons">
    <button class="btn btn-dark btn-small" on:click={() => $screen = 'shop'}>Shop</button>
    <button class="btn btn-dark btn-small" on:click={() => $screen = 'friends'}>Friends</button>
  </div>

  {#if $user?.friendCode}
    <p class="friend-code">Your friend code: <strong>{$user.friendCode}</strong></p>
  {/if}

  <div class="leaderboard">
    <h3>Leaderboard</h3>
    <table>
      <thead>
        <tr><th class="rank">#</th><th>Player</th><th>ELO</th><th class="wins">W</th><th class="losses">L</th></tr>
      </thead>
      <tbody>
        {#if leaderboard.length === 0}
          <tr><td colspan="5" class="empty-msg">No games played yet</td></tr>
        {:else}
          {#each leaderboard.slice(0, 10) as p, i}
            <tr class:highlight={p.id === $user?.id}>
              <td class="rank">{i + 1}</td>
              <td>{p.username}</td>
              <td>{p.elo}</td>
              <td class="wins">{p.wins}</td>
              <td class="losses">{p.losses}</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

<style>
  .lobby {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 16px;
    width: 100%;
    max-width: 480px;
  }
  .title { font-size: 2rem; letter-spacing: 2px; color: var(--accent); }
  .title span { color: var(--text); font-weight: 300; }

  .user-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: var(--surface);
    border-radius: 10px;
    padding: 12px 16px;
    gap: 12px;
  }
  .user-info { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .user-info strong { font-size: 1rem; }
  .stat {
    font-size: 0.8rem;
    color: var(--text-dim);
    background: var(--surface2);
    padding: 2px 8px;
    border-radius: 6px;
  }
  .coins { color: #ffd700; }
  .user-actions { flex-shrink: 0; }

  .play-buttons, .nav-buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .friend-code {
    font-size: 0.8rem;
    color: var(--text-dim);
  }
  .friend-code strong {
    color: var(--accent);
    letter-spacing: 2px;
    font-family: 'Courier New', monospace;
  }

  .leaderboard {
    background: var(--surface);
    border-radius: 10px;
    padding: 14px 16px;
    width: 100%;
  }
  .leaderboard h3 {
    font-size: 0.85rem;
    color: var(--text-dim);
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 8px;
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    font-size: 0.7rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 3px 6px;
    text-align: left;
    border-bottom: 1px solid var(--surface2);
  }
  td { padding: 5px 6px; font-size: 0.85rem; }
  .rank { color: var(--text-dim); width: 28px; }
  .wins { color: #4caf50; }
  .losses { color: var(--accent); }
  .empty-msg { text-align: center; color: var(--text-dim); padding: 10px; font-size: 0.85rem; }
  .highlight { background: rgba(233, 69, 96, 0.1); }
</style>
