<script>
  import { screen, gameState } from '../../stores/app.js';

  function playBot() {
    $gameState = { gameId: null, myColor: null, opponentName: 'The Colonel', mode: 'bot' };
    $screen = 'wheel';
  }
</script>

<div class="bot">
  <div class="bot-avatar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="8.5" cy="16" r="1.5"/><circle cx="15.5" cy="16" r="1.5"/><path d="M12 3v4"/><circle cx="12" cy="3" r="1"/><path d="M7 11V9a5 5 0 0110 0v2"/>
    </svg>
  </div>
  <h3>The Colonel</h3>
  <p class="desc">Minimax AI with alpha-beta pruning. Depth 6.</p>
  <button class="btn btn-secondary play-btn" on:click={playBot}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    Challenge
  </button>
</div>

<style>
  .bot { display: flex; flex-direction: column; align-items: center; gap: var(--sp-md); padding: var(--sp-lg) 0; }
  .bot-avatar { color: var(--accent2); }
  h3 { font-size: var(--fs-heading); font-weight: 600; }
  .desc { color: var(--text-dim); font-size: var(--fs-caption); text-align: center; max-width: 260px; }
  .play-btn { width: 100%; max-width: 220px; padding: var(--sp-md) var(--sp-lg); font-size: 1rem; }
</style>
