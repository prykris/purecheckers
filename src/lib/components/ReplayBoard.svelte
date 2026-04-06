<script>
  import { CheckersGame } from '$lib/game.js';
  import { onMount } from 'svelte';

  const props = $props();

  // Static data — doesn't change after mount
  // svelte-ignore state_referenced_locally
  const g = props.gameData;
  const moves = g.moveHistory || [];
  let moveIndex = $state(0);
  let checkers = $state(new CheckersGame());
  let lastMove = $state(null); // { fromRow, fromCol, toRow, toCol }
  let animating = $state(null); // { fromRow, fromCol, toRow, toCol, color, queen } during slide

  function replayTo(index) {
    const stepping = Math.abs(index - moveIndex) === 1;
    const stepMove = stepping && index > 0 ? moves[index - 1] : null;

    checkers = new CheckersGame();
    // Replay to one step before to capture the moving piece
    const target = stepping && stepMove ? index - 1 : index;
    for (let i = 0; i < target && i < moves.length; i++) {
      checkers.makeMove(moves[i].fromRow, moves[i].fromCol, moves[i].toRow, moves[i].toCol);
    }

    if (stepping && stepMove) {
      // Capture piece info before the move
      const piece = checkers.at(stepMove.fromRow, stepMove.fromCol);
      if (piece) {
        animating = { ...stepMove, color: piece.color, queen: piece.queen };
        // Apply the move after a frame so the animation starts from the old position
        requestAnimationFrame(() => {
          checkers.makeMove(stepMove.fromRow, stepMove.fromCol, stepMove.toRow, stepMove.toCol);
          checkers = checkers; // trigger reactivity
          lastMove = stepMove;
          setTimeout(() => { animating = null; }, 250);
        });
      } else {
        checkers.makeMove(stepMove.fromRow, stepMove.fromCol, stepMove.toRow, stepMove.toCol);
        lastMove = stepMove;
      }
    } else {
      lastMove = null;
      animating = null;
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

  const winner = g.result === 'RED_WIN' ? g.redPlayer : g.result === 'BLACK_WIN' ? g.blackPlayer : null;
  const loser = g.result === 'RED_WIN' ? g.blackPlayer : g.result === 'BLACK_WIN' ? g.redPlayer : null;
  const resultText = winner ? `${winner} wins` : 'Draw';

  function getEndReason() {
    const final = new CheckersGame();
    for (const m of moves) final.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
    const loserColor = g.result === 'RED_WIN' ? 'black' : 'red';
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
  const endReason = g.result === 'DRAW' ? 'Game drawn' : getEndReason();

  onMount(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<div class="replay-board">
  <div class="replay-header">
    <span class="rp-name red">{g.redPlayer}</span>
    <span class="rp-vs">vs</span>
    <span class="rp-name black">{g.blackPlayer}</span>
  </div>

  <div class="board">
    {#each { length: 8 } as _, r}
      {#each { length: 8 } as _, c}
        {@const isDark = (r + c) % 2 === 1}
        {@const piece = checkers.at(r, c)}
        {@const isFrom = lastMove && lastMove.fromRow === r && lastMove.fromCol === c}
        {@const isTo = lastMove && lastMove.toRow === r && lastMove.toCol === c}
        {@const isAnimatingFrom = animating && animating.fromRow === r && animating.fromCol === c}
        <div class="cell" class:dark={isDark} class:light={!isDark} class:highlight-from={isFrom} class:highlight-to={isTo}>
          {#if piece && !isAnimatingFrom}
            <div class="piece" class:red={piece.color === 'red'} class:black={piece.color === 'black'}>
              {#if piece.queen}<span class="crown">♛</span>{/if}
            </div>
          {/if}
        </div>
      {/each}
    {/each}
    {#if animating}
      <div class="sliding-piece"
        class:red={animating.color === 'red'} class:black={animating.color === 'black'}
        style="--from-col:{animating.fromCol};--from-row:{animating.fromRow};--to-col:{animating.toCol};--to-row:{animating.toRow}">
        {#if animating.queen}<span class="crown">♛</span>{/if}
      </div>
    {/if}
  </div>

  <div class="controls">
    <button class="ctrl-btn" onclick={toStart} disabled={moveIndex === 0} title="Start">⏮</button>
    <button class="ctrl-btn" onclick={prev} disabled={moveIndex === 0} title="Previous">◀</button>
    <span class="move-counter">{moveIndex} / {moves.length}</span>
    <button class="ctrl-btn" onclick={next} disabled={moveIndex >= moves.length} title="Next">▶</button>
    <button class="ctrl-btn" onclick={toEnd} disabled={moveIndex >= moves.length} title="End">⏭</button>
  </div>

  {#if moveIndex >= moves.length}
    <div class="outcome" class:win={g.result !== 'DRAW'}>
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
    position: relative;
  }
  .cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; position: relative; }
  .cell.highlight-from { box-shadow: inset 0 0 0 2px rgba(100,180,255,0.4); }
  .cell.highlight-to { box-shadow: inset 0 0 0 2px rgba(100,180,255,0.6); }

  .sliding-piece {
    position: absolute;
    width: 12.5%; height: 12.5%;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    z-index: 2;
    animation: slide-move 0.2s ease-out forwards;
    left: calc(var(--to-col) * 12.5%);
    top: calc(var(--to-row) * 12.5%);
    padding: 15%;
  }
  .sliding-piece::before {
    content: ''; position: absolute; inset: 15%;
    border-radius: 50%;
  }
  .sliding-piece.red::before { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .sliding-piece.black::before { background: radial-gradient(circle at 35% 35%, #44403c, #1c1917); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  @keyframes slide-move {
    from { left: calc(var(--from-col) * 12.5%); top: calc(var(--from-row) * 12.5%); }
    to { left: calc(var(--to-col) * 12.5%); top: calc(var(--to-row) * 12.5%); }
  }
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
