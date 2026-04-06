<script>
  import { CheckersGame } from '$lib/game.js';
  import { onMount, onDestroy } from 'svelte';

  export let gameData; // { id, redPlayer, blackPlayer, result, mode, moveHistory, date }

  const moves = gameData.moveHistory || [];
  let moveIndex = $state(0);
  let checkers = $state(new CheckersGame());

  function replayTo(index) {
    checkers = new CheckersGame();
    for (let i = 0; i < index && i < moves.length; i++) {
      const m = moves[i];
      checkers.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
    }
    moveIndex = index;
  }

  function prev() { if (moveIndex > 0) replayTo(moveIndex - 1); }
  function next() { if (moveIndex < moves.length) replayTo(moveIndex + 1); }
  function toStart() { replayTo(0); }
  function toEnd() { replayTo(moves.length); }

  function onKeyDown(e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'Home') { e.preventDefault(); toStart(); }
    else if (e.key === 'End') { e.preventDefault(); toEnd(); }
  }

  const winner = gameData.result === 'RED_WIN' ? gameData.redPlayer : gameData.result === 'BLACK_WIN' ? gameData.blackPlayer : null;
  const loser = gameData.result === 'RED_WIN' ? gameData.blackPlayer : gameData.result === 'BLACK_WIN' ? gameData.redPlayer : null;
  const resultText = winner ? `${winner} wins` : 'Draw';

  function getEndReason() {
    const final = new CheckersGame();
    for (const m of moves) final.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
    const loserColor = gameData.result === 'RED_WIN' ? 'black' : 'red';
    let loserPieces = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = final.at(r, c);
      if (p?.color === loserColor) loserPieces++;
    }
    if (loserPieces === 0) return 'All pieces captured';
    const loserMoves = final.getAllValidMoves();
    if (loserMoves.length === 0) return `${loser} has no valid moves`;
    return `${loser} forfeited`;
  }
  const endReason = gameData.result === 'DRAW' ? 'Game drawn' : getEndReason();

  onMount(() => window.addEventListener('keydown', onKeyDown));
  onDestroy(() => window.removeEventListener('keydown', onKeyDown));
</script>

<div class="replay-board">
  <div class="replay-header">
    <span class="rp-name red">{gameData.redPlayer}</span>
    <span class="rp-vs">vs</span>
    <span class="rp-name black">{gameData.blackPlayer}</span>
  </div>

  <div class="board">
    {#each { length: 8 } as _, r}
      {#each { length: 8 } as _, c}
        {@const isDark = (r + c) % 2 === 1}
        {@const piece = checkers.at(r, c)}
        <div class="cell" class:dark={isDark} class:light={!isDark}>
          {#if piece}
            <div class="piece" class:red={piece.color === 'red'} class:black={piece.color === 'black'}>
              {#if piece.queen}<span class="crown">♛</span>{/if}
            </div>
          {/if}
        </div>
      {/each}
    {/each}
  </div>

  <div class="controls">
    <button class="ctrl-btn" onclick={toStart} disabled={moveIndex === 0} title="Start">⏮</button>
    <button class="ctrl-btn" onclick={prev} disabled={moveIndex === 0} title="Previous">◀</button>
    <span class="move-counter">{moveIndex} / {moves.length}</span>
    <button class="ctrl-btn" onclick={next} disabled={moveIndex >= moves.length} title="Next">▶</button>
    <button class="ctrl-btn" onclick={toEnd} disabled={moveIndex >= moves.length} title="End">⏭</button>
  </div>

  {#if moveIndex >= moves.length}
    <div class="outcome" class:win={gameData.result !== 'DRAW'}>
      <span class="outcome-result">{resultText}</span>
      <span class="outcome-reason">{endReason}</span>
    </div>
  {:else}
    <p class="hint">Arrow keys to navigate</p>
  {/if}
</div>

<style>
  .replay-board {
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-md);
    width: 100%;
  }

  .replay-header { display: flex; align-items: center; gap: var(--sp-sm); font-size: var(--fs-body); }
  .rp-name { font-weight: 700; }
  .rp-name.red { color: var(--accent); }
  .rp-name.black { color: var(--text); }
  .rp-vs { color: var(--text-dim); font-weight: 400; font-size: var(--fs-caption); }

  .board {
    display: grid; grid-template-columns: repeat(8, 1fr);
    width: 100%; max-width: 400px; aspect-ratio: 1;
    border-radius: var(--radius-md); overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }
  .cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
  .cell.light { background: var(--board-light); }
  .cell.dark { background: var(--board-dark); }

  .piece {
    width: 70%; height: 70%; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .piece.red { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .piece.black { background: radial-gradient(circle at 35% 35%, #44403c, #1c1917); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .crown { font-size: 0.7em; color: var(--gold); }

  .controls { display: flex; align-items: center; gap: var(--sp-sm); }
  .ctrl-btn {
    background: var(--surface); border: 1px solid var(--surface2); color: var(--text);
    font-size: 1rem; width: 40px; height: 40px; border-radius: var(--radius-md);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .ctrl-btn:hover:not(:disabled) { background: var(--surface2); }
  .ctrl-btn:disabled { opacity: 0.3; cursor: default; }
  .move-counter { font-size: var(--fs-caption); color: var(--text-dim); min-width: 60px; text-align: center; font-family: var(--font-mono); }

  .hint { font-size: 0.6rem; color: var(--text-dim); }
  .outcome {
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-xs);
    padding: var(--sp-md) var(--sp-lg);
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md); text-align: center;
  }
  .outcome-result { font-size: var(--fs-heading); font-weight: 700; }
  .outcome.win .outcome-result { color: var(--success); }
  .outcome-reason { font-size: var(--fs-caption); color: var(--text-dim); }
</style>
