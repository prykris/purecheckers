<script>
  import { onMount, onDestroy } from 'svelte';
  import { screen, gameState } from '../stores/app.js';
  import { getSocket } from '../lib/socket.js';

  let socket = null;
  let mode = 'choose'; // 'choose' | 'host' | 'join'
  let myCode = '';
  let joinCode = '';
  let error = '';

  onMount(() => {
    socket = getSocket();
    if (socket) {
      socket.on('friend-game:created', onCreated);
      socket.on('friend-game:error', onError);
      socket.on('matchmaking:found', onMatchFound);
    }
  });

  onDestroy(() => {
    if (socket) {
      socket.off('friend-game:created', onCreated);
      socket.off('friend-game:error', onError);
      socket.off('matchmaking:found', onMatchFound);
    }
    if (myCode) socket?.emit('friend-game:cancel', { code: myCode });
  });

  function onCreated(data) { myCode = data.code; }
  function onError(data) { error = data.error; }
  function onMatchFound(data) {
    $gameState = {
      gameId: data.gameId,
      myColor: data.yourColor,
      opponentName: data.opponent.username,
      opponentId: data.opponent.id,
      mode: 'online'
    };
    $screen = 'wheel';
  }

  function hostGame() {
    mode = 'host';
    socket?.emit('friend-game:create');
  }

  function joinGame() {
    error = '';
    if (!joinCode.trim()) return;
    socket?.emit('friend-game:join', { code: joinCode.trim().toUpperCase() });
  }

  function back() {
    if (myCode) socket?.emit('friend-game:cancel', { code: myCode });
    $screen = 'lobby';
  }
</script>

<div class="page-center">
  <div class="friend-game">
    {#if mode === 'choose'}
      <h2>Play with a Friend</h2>
      <p class="desc">Create a game or join one with a code</p>
      <div class="buttons">
        <button class="btn btn-primary" on:click={hostGame}>Create Game</button>
        <button class="btn btn-secondary" on:click={() => mode = 'join'}>Join Game</button>
      </div>
      <button class="btn btn-dark btn-small" on:click={back}>Back</button>

    {:else if mode === 'host'}
      <h2>Waiting for friend...</h2>
      <p class="desc">Share this code with your friend</p>
      <div class="code-box">
        <span class="code">{myCode || '...'}</span>
      </div>
      <div class="spinner"></div>
      <button class="btn btn-dark btn-small" on:click={back}>Cancel</button>

    {:else if mode === 'join'}
      <h2>Join a Game</h2>
      <p class="desc">Enter your friend's game code</p>
      <input class="input code-input" type="text" bind:value={joinCode}
        placeholder="CODE" maxlength="6"
        on:keydown={(e) => e.key === 'Enter' && joinGame()} />
      {#if error}<p class="error">{error}</p>{/if}
      <button class="btn btn-primary" on:click={joinGame}>Join</button>
      <button class="btn btn-dark btn-small" on:click={() => { mode = 'choose'; error = ''; }}>Back</button>
    {/if}
  </div>
</div>

<style>
  .friend-game {
    display: flex; flex-direction: column; align-items: center;
    gap: var(--sp-md); max-width: 340px; width: 100%; text-align: center;
  }
  h2 { font-size: var(--fs-heading); }
  .desc { color: var(--text-dim); font-size: var(--fs-body); }
  .buttons { display: flex; gap: var(--sp-md); flex-wrap: wrap; justify-content: center; }
  .code-box {
    background: var(--surface); border: 2px solid var(--surface2);
    border-radius: var(--radius-lg); padding: var(--sp-md) var(--sp-xl);
  }
  .code {
    font-size: 2rem; font-weight: 700; letter-spacing: 6px;
    color: var(--accent); font-family: var(--font-mono);
  }
  .code-input {
    text-align: center; text-transform: uppercase;
    letter-spacing: 6px; font-size: 1.2rem;
    max-width: 200px;
  }
  .error { color: var(--accent); font-size: var(--fs-caption); }
</style>
