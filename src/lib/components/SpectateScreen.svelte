<script>
  import { onMount, onDestroy } from 'svelte';
  import { gameState, roomChatMessages } from '$lib/stores/app.js';
  import { clearScreenOverride } from '$lib/stores/gameScreen.js';
  import { getSocket } from '$lib/socket.js';
  import { setActiveChannel } from '$lib/socketService.js';
  import { CheckersGame } from '../../../shared/game.js';
  import { TURN_TIME } from '../../../shared/constants.js';
  import BoardView from './BoardView.svelte';
  import RoomChat from './chat/RoomChat.svelte';

  let game = new CheckersGame();
  let flip = false;
  let lastMove = null;
  let lastMoveCaptured = [];
  let boardView;
  let socket;
  let gameOver = false;
  let winner = null;

  const redName = $gameState?.spectatorRedName || 'Red';
  const blackName = $gameState?.spectatorBlackName || 'Black';
  const gameId = $gameState?.gameId;

  // Restore state if provided
  if ($gameState?.reconnectState) {
    const rs = $gameState.reconnectState;
    game.board = rs.board;
    game.currentPlayer = rs.currentPlayer;
    game.redTime = rs.redTime;
    game.blackTime = rs.blackTime;
    game.chainPiece = rs.chainPiece;
    game.gameOver = rs.gameOver;
    game.winner = rs.winner;
  }

  onMount(() => {
    socket = getSocket();
    if (!socket) return;
    if (gameId) setActiveChannel(`game:${gameId}`);
    socket.on('game:moved', onMove);
    socket.on('game:tick', onTick);
    socket.on('game:over', onGameOver);
    socket.on('game:sync', onSync);
  });

  onDestroy(() => {
    if (socket) {
      socket.off('game:moved', onMove);
      socket.off('game:tick', onTick);
      socket.off('game:over', onGameOver);
      socket.off('game:sync', onSync);
    }
  });

  function onSync(state) {
    game.board = state.board;
    game.currentPlayer = state.currentPlayer;
    game.redTime = state.redTime;
    game.blackTime = state.blackTime;
    game.chainPiece = state.chainPiece;
    game.gameOver = state.gameOver;
    game.winner = state.winner;
    game = game;
    boardView?.redraw();
  }

  async function onMove(data) {
    if (data.fromRow === undefined) return;
    // Gather capture info before making the move
    const piece = game.at(data.fromRow, data.fromCol);
    const moves = game.getValidMovesFor(data.fromRow, data.fromCol);
    const move = moves.find(m => m.toRow === data.toRow && m.toCol === data.toCol);
    const captured = move?.captured?.map(cap => {
      const cp = game.at(cap.row, cap.col);
      return { row: cap.row, col: cap.col, color: cp?.color, queen: cp?.queen };
    }) || [];

    const result = game.makeMove(data.fromRow, data.fromCol, data.toRow, data.toCol);
    if (!result) return;

    lastMove = { fromRow: data.fromRow, fromCol: data.fromCol, toRow: data.toRow, toCol: data.toCol };
    lastMoveCaptured = captured.map(c => ({ row: c.row, col: c.col }));
    game.redTime = data.redTime;
    game.blackTime = data.blackTime;
    game = game;

    // Animate
    if (boardView && piece) {
      await boardView.animateMove(data.fromRow, data.fromCol, data.toRow, data.toCol, piece.color, piece.queen, captured);
    }
    boardView?.redraw();
  }

  function onTick(data) {
    game.redTime = data.redTime;
    game.blackTime = data.blackTime;
    game = game;
  }

  function onGameOver(data) {
    game.gameOver = true;
    game.winner = data.winner;
    gameOver = true;
    winner = data.winner;
    game = game;
  }

  function toggleFlip() { flip = !flip; boardView?.redraw(); }
  function goToLobby() {
    const roomId = $gameState?.roomId;
    if (roomId) getSocket()?.emit('room:leave', { roomId });
    $gameState = null; clearScreenOverride();
  }

  let showSpectateOverlay = false;
  let overlayTimer = null;
  function onBoardTap() {
    if (gameOver) return;
    showSpectateOverlay = true;
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => { showSpectateOverlay = false; }, 1500);
  }

  function fmtTime(s) { const sec = Math.ceil(s); return `0:${sec.toString().padStart(2, '0')}`; }
</script>

<div class="spectate-layout">
  <!-- Top player (red or black depending on flip) -->
  <div class="player-bar">
    <div class="pinfo" class:active={game.currentPlayer === (flip ? 'red' : 'black')}>
      <div class="dot" class:red={!flip} class:black={flip}></div>
      <span class="pname">{flip ? redName : blackName}</span>
      <span class="timer">{fmtTime(flip ? game.redTime : game.blackTime)}</span>
    </div>
  </div>

  <!-- Board -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="board-tap-zone" on:click={onBoardTap}>
    <BoardView bind:this={boardView} {game} {flip} myColor="red" interactive={false}
      selectedPiece={null} validMoves={[]} {lastMove} {lastMoveCaptured}>
      {#if gameOver}
        <div class="game-over-overlay">
          <h2>{winner === 'red' ? redName : blackName} wins!</h2>
          <button class="btn btn-primary btn-small" on:click={goToLobby}>Back to Lobby</button>
        </div>
      {/if}
    </BoardView>
    {#if showSpectateOverlay}
      <div class="spectate-tap-overlay">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        You're spectating
      </div>
    {/if}
  </div>

  <!-- Bottom player -->
  <div class="player-bar">
    <div class="pinfo" class:active={game.currentPlayer === (flip ? 'black' : 'red')}>
      <div class="dot" class:red={flip} class:black={!flip}></div>
      <span class="pname">{flip ? blackName : redName}</span>
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
    <RoomChat channelId={gameId ? `game:${gameId}` : null} readOnly={true} />
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
  .spectate-tap-overlay {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.55);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-xs);
    border-radius: var(--radius-sm);
    color: rgba(255,255,255,0.85);
    font-size: var(--fs-body); font-weight: 600;
    pointer-events: none;
    animation: spectateOverlayFade 1.5s ease-out forwards;
    z-index: 5;
  }
  @keyframes spectateOverlayFade {
    0% { opacity: 0.9; }
    60% { opacity: 0.9; }
    100% { opacity: 0; }
  }

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
