<script>
  import { screen, gameState } from '../../stores/app.js';
  import { user } from '../../stores/user.js';
  import { getSocket } from '../../lib/socket.js';

  function findOpponent() {
    getSocket()?.emit('matchmaking:join', { elo: $user?.elo || 1000 });
    $screen = 'search';
  }

  function playFriend() {
    $screen = 'friend-game';
  }
</script>

<div class="quick">
  <div class="elo-display">
    <span class="elo-label">Your Rating</span>
    <span class="elo-value">{$user?.elo || 1000}</span>
  </div>

  <button class="btn btn-primary play-btn" on:click={findOpponent}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    Find Opponent
  </button>

  <button class="btn btn-dark play-btn" on:click={playFriend}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    Play vs Friend
  </button>
</div>

<style>
  .quick { display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg); padding: var(--sp-lg) 0; }

  .elo-display { display: flex; flex-direction: column; align-items: center; gap: var(--sp-xs); }
  .elo-label { font-size: var(--fs-caption); color: var(--text-dim); text-transform: uppercase; letter-spacing: 2px; }
  .elo-value { font-size: 2.5rem; font-weight: 700; color: var(--text); }

  .play-btn {
    width: 100%; max-width: 280px;
    padding: var(--sp-md) var(--sp-lg);
    font-size: 1rem;
  }
</style>
