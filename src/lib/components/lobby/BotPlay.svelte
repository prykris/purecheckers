<script>
  import { getSocket } from '$lib/socket.js';
  import { phase } from '$lib/stores/app.js';
  import { setScreenOverride } from '$lib/stores/gameScreen.js';

  let botDifficulty = (typeof localStorage !== 'undefined' && localStorage.getItem('checkers_bot_diff')) || 'medium';
  let creating = false;
  let error = '';

  function setDifficulty(d) {
    botDifficulty = d;
    localStorage.setItem('checkers_bot_diff', d);
  }

  function play() {
    const socket = getSocket();
    if (!socket || creating) return;
    creating = true;
    error = '';

    // Create a room, then call the bot into it
    socket.emit('room:create', { buyIn: 0, turnTimer: 60, isPrivate: false, allowSpectators: true });

    socket.once('room:created', ({ room }) => {
      // Room created, now call the bot
      socket.emit('bot:join', { roomId: room.id, difficulty: botDifficulty });
    });

    socket.once('room:error', ({ error: e }) => {
      error = e;
      creating = false;
    });
  }

  // When phase transitions to in-room or in-game, show room waiting overlay
  $: if (creating && ($phase === 'in-room' || $phase === 'in-game')) {
    creating = false;
    setScreenOverride('room-waiting');
  }
</script>

<div class="bot">
  <div class="bot-avatar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="8.5" cy="16" r="1.5"/><circle cx="15.5" cy="16" r="1.5"/><path d="M12 3v4"/><circle cx="12" cy="3" r="1"/><path d="M7 11V9a5 5 0 0110 0v2"/>
    </svg>
  </div>
  <h3>Play vs Bot</h3>

  <div class="diff-row">
    <label class="diff easy" class:selected={botDifficulty === 'easy'}>
      <input type="radio" name="botdiff" value="easy" bind:group={botDifficulty} on:change={() => setDifficulty('easy')} />
      <span class="diff-dot"></span> Easy
    </label>
    <label class="diff medium" class:selected={botDifficulty === 'medium'}>
      <input type="radio" name="botdiff" value="medium" bind:group={botDifficulty} on:change={() => setDifficulty('medium')} />
      <span class="diff-dot"></span> Medium
    </label>
    <label class="diff hard" class:selected={botDifficulty === 'hard'}>
      <input type="radio" name="botdiff" value="hard" bind:group={botDifficulty} on:change={() => setDifficulty('hard')} />
      <span class="diff-dot"></span> Hard
    </label>
  </div>

  {#if error}<p class="error">{error}</p>{/if}

  <button class="btn btn-secondary play-btn" on:click={play} disabled={creating}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    {creating ? 'Creating...' : 'Challenge'}
  </button>
</div>

<style>
  .bot { display: flex; flex-direction: column; align-items: center; gap: var(--sp-md); padding: var(--sp-lg) 0; }
  .bot-avatar { color: var(--accent2); }
  h3 { font-size: var(--fs-heading); font-weight: 600; }

  .diff-row { display: flex; gap: var(--sp-md); }
  .diff {
    display: flex; align-items: center; gap: var(--sp-xs);
    font-size: var(--fs-body); font-weight: 500; cursor: pointer;
    padding: var(--sp-xs) var(--sp-sm); border-radius: var(--radius-pill);
    border: 2px solid transparent; transition: border-color 0.15s, color 0.15s;
  }
  .diff input { display: none; }
  .diff-dot {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid; transition: background 0.15s;
  }
  .diff.easy { color: var(--text-dim); }
  .diff.easy .diff-dot { border-color: var(--success); }
  .diff.easy.selected { color: var(--success); border-color: var(--success); }
  .diff.easy.selected .diff-dot { background: var(--success); }

  .diff.medium { color: var(--text-dim); }
  .diff.medium .diff-dot { border-color: var(--warning); }
  .diff.medium.selected { color: var(--warning); border-color: var(--warning); }
  .diff.medium.selected .diff-dot { background: var(--warning); }

  .diff.hard { color: var(--text-dim); }
  .diff.hard .diff-dot { border-color: var(--accent); }
  .diff.hard.selected { color: var(--accent); border-color: var(--accent); }
  .diff.hard.selected .diff-dot { background: var(--accent); }

  .error { color: var(--accent); font-size: var(--fs-caption); }
  .play-btn { width: 100%; max-width: 220px; padding: var(--sp-md) var(--sp-lg); font-size: 1rem; }
</style>
