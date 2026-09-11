<script>
  import PlayerLink from './PlayerLink.svelte';
  import { gameState } from '$lib/stores/app.js';
  import { fade } from 'svelte/transition';
  import { session, sendCommand } from '$lib/stores/session.js';
  import GameBoard from './GameBoard.svelte';
  import BoardAppearance from './BoardAppearance.svelte';
  import RoomChat from './chat/RoomChat.svelte';
  let flip = false;
  $: game = $gameState.state;
  $: gameId = $gameState.gameId;
  $: redName = $gameState.spectatorRedName;
  $: blackName = $gameState.spectatorBlackName;
  $: gameOver = game.gameOver;
  $: winner = game.winner;
  function toggleFlip() { flip = !flip; }
  function goToLobby() { sendCommand('room:leave', { roomId: $gameState.roomId }); }
  function fmtTime(seconds) { if (!game.turnTime) return '∞'; const n = Math.ceil(seconds); return Math.floor(n/60) + ':' + String(n%60).padStart(2, '0'); }
</script>

<div class="spectate-layout">
  <!-- Top player (red or black depending on flip) -->
  <div class="player-bar">
    <div class="pinfo" class:active={game.currentPlayer === (flip ? 'red' : 'black')}>
      <div class="dot" class:red={!flip} class:black={flip}></div>
      <span class="pname"><PlayerLink username={flip ? redName : blackName} /></span>
      <span class="timer">{fmtTime(flip ? game.redTime : game.blackTime)}</span>
    </div>
  </div>

  <!-- Board -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="board-tap-zone">
    <GameBoard snapshot={game} recovery={$session.recovery} connected={$session.status === 'ready'} {flip} myColor="red" interactive={false} let:resultVisible let:resultDuration>
      {#if gameOver && resultVisible}
        <div class="game-over-overlay" in:fade={{ duration: resultDuration }}>
          {#if winner === null}
            <h2>Draw</h2>
          {:else}
            <h2><PlayerLink username={winner === 'red' ? redName : blackName} /> wins!</h2>
          {/if}
          <button class="btn btn-primary btn-small" on:click={goToLobby}>Back to Lobby</button>
        </div>
      {/if}
    </GameBoard>
    <BoardAppearance />

  </div>

  <!-- Bottom player -->
  <div class="player-bar">
    <div class="pinfo" class:active={game.currentPlayer === (flip ? 'black' : 'red')}>
      <div class="dot" class:red={flip} class:black={!flip}></div>
      <span class="pname"><PlayerLink username={flip ? blackName : redName} /></span>
      <span class="timer">{fmtTime(flip ? game.blackTime : game.redTime)}</span>
    </div>
  </div>

  <div class="spectate-actions">
    <button class="btn btn-dark btn-small" on:click={toggleFlip}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
      Flip Board
    </button>
    <button class="btn btn-dark btn-small" on:click={goToLobby}>Leave</button>
  </div>

  <div class="spectate-label">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    Spectating
  </div>

  <!-- Read-only chat -->
  <div class="spectate-chat card">
    <RoomChat channelId={gameId ? `game:${gameId}` : null} readOnly={false} />
  </div>
</div>

<style>
  .spectate-layout {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: var(--sp-sm); gap: var(--sp-xs);
    background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg) 30%);
  }

  .player-bar { width: 100%; max-width: 640px; }
  .pinfo {
    display: flex; align-items: center; gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md);
    border-radius: var(--radius-md); background: var(--surface);
    border: 1px solid var(--surface2);
  }
  .pinfo.active { border-color: var(--accent); box-shadow: 0 0 12px rgba(239,68,68,0.15); }
  .dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
  .dot.red { background: var(--red-piece); }
  .dot.black { background: var(--black-piece); border: 2px solid #555; }
  .pname { font-weight: 600; font-size: var(--fs-caption); }
  .timer { font-family: var(--font-mono); font-size: var(--fs-caption); color: var(--text-dim); margin-left: auto; }

  .spectate-actions { display: flex; gap: var(--sp-sm); }
  .spectate-label {
    display: flex; align-items: center; gap: var(--sp-xs);
    font-size: var(--fs-caption); color: var(--text-dim); font-weight: 500;
  }

  .board-tap-zone { position: relative; }

  .game-over-overlay {
    position: absolute; inset: 0; background: rgba(0,0,0,0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-sm); border-radius: var(--radius-sm); z-index: 10; backdrop-filter: blur(4px);
  }
  .game-over-overlay h2 { font-size: var(--fs-heading); color: var(--text); }

  .spectate-chat { width: 100%; max-width: 640px; height: 150px; padding: 0; overflow: hidden; }

  @media (min-width: 1100px) {
    .spectate-layout {
      display: grid;
      grid-template-columns: var(--side-panel) auto var(--side-panel);
      grid-template-rows: auto auto auto auto auto;
      align-content: center; justify-content: center;
      gap: var(--sp-xs) var(--sp-xl); padding: var(--sp-lg);
    }
    .player-bar { grid-column: 2; max-width: none; }
    .player-bar:first-child { grid-row: 1; }
    .board-tap-zone { grid-column: 2; grid-row: 2; justify-self: center; }
    .player-bar:nth-child(3) { grid-row: 3; }
    .spectate-actions { grid-column: 2; grid-row: 4; justify-self: center; }
    .spectate-label { grid-column: 2; grid-row: 5; justify-self: center; }
    .spectate-chat { grid-column: 3; grid-row: 1 / 6; align-self: center; max-width: none; height: 360px; }
  }
</style>
