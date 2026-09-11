<script>
  import PlayerLink from './PlayerLink.svelte';
  import { CheckersGame } from '$lib/game.js';
  import { onDestroy } from 'svelte';
  import { describeHistory } from '../../../shared/gameHistory.js';
  import { DEFAULT_PIECE_SKIN, pieceSkinCss } from '../../../shared/pieceSkins.js';
  import { gameEndReason, gameResultLabel, winningColor } from '../../../shared/gameResult.js';
  let animationTimer, animationId = 0;

  const props = $props();

  // Static data — doesn't change after mount
  // svelte-ignore state_referenced_locally
  const g = props.gameData;
  const { moves, invalidMoveIndex } = describeHistory(g.moveHistory);
  let moveIndex = $state(0);
  let checkers = $state(new CheckersGame());
  let lastMove = $state(null); // { fromRow, fromCol, toRow, toCol }
  let animating = $state(null); // { fromRow, fromCol, toRow, toCol, color, queen } during slide
  let playing = $state(false);
  const flipped = $derived(props.perspective === 'black');
  const view = coordinate => flipped ? 7 - coordinate : coordinate;

  function replayTo(index, animate = true) {
    clearTimeout(animationTimer);
    const forward = index > moveIndex;
    const stepping = animate && Math.abs(index - moveIndex) === 1;

    // The move being animated
    const stepMove = stepping ? (forward ? moves[index - 1] : moves[moveIndex - 1]) : null;

    // Build pre-move state to get the piece info
    let movingPiece = null;
    if (stepMove && stepping) {
      const pre = new CheckersGame();
      const preIndex = forward ? index - 1 : moveIndex;
      for (let i = 0; i < preIndex && i < moves.length; i++) {
        pre.makeMove(moves[i].fromRow, moves[i].fromCol, moves[i].toRow, moves[i].toCol);
      }
      movingPiece = forward
        ? pre.at(stepMove.fromRow, stepMove.fromCol)
        : pre.at(stepMove.toRow, stepMove.toCol); // piece is at destination before undo
      // For undo, the piece might have been captured/promoted — use the piece at the 'to' position
      if (!movingPiece && !forward) {
        // After the move, piece is at toRow/toCol in the current state
        movingPiece = checkers.at(stepMove.toRow, stepMove.toCol);
      }
    }

    // Always rebuild full board state
    checkers = new CheckersGame();
    for (let i = 0; i < index && i < moves.length; i++) {
      checkers.makeMove(moves[i].fromRow, moves[i].fromCol, moves[i].toRow, moves[i].toCol);
    }

    if (stepMove && movingPiece) {
      if (forward) {
        // Animate from → to
        animating = { fromRow: stepMove.fromRow, fromCol: stepMove.fromCol, toRow: stepMove.toRow, toCol: stepMove.toCol, color: movingPiece.color, queen: movingPiece.queen };
      } else {
        // Animate to → from (reverse)
        animating = { fromRow: stepMove.toRow, fromCol: stepMove.toCol, toRow: stepMove.fromRow, toCol: stepMove.fromCol, color: movingPiece.color, queen: movingPiece.queen };
      }
      animating.id = ++animationId;
      lastMove = forward ? stepMove : { fromRow: stepMove.toRow, fromCol: stepMove.toCol, toRow: stepMove.fromRow, toCol: stepMove.fromCol };
      animationTimer = setTimeout(() => { animating = null; }, 220);
    } else {
      lastMove = null;
      animating = null;
    }

    moveIndex = index;
  }

  function prev() { playing = false; if (moveIndex > 0) replayTo(moveIndex - 1); }
  function next() { playing = false; if (moveIndex < moves.length) replayTo(moveIndex + 1); }
  function toStart() { playing = false; replayTo(0); }
  function toEnd() { playing = false; replayTo(moves.length, false); }
  function togglePlayback() {
    if (playing) { playing = false; return; }
    if (moveIndex >= moves.length) replayTo(0, false);
    playing = true;
  }
  $effect(() => {
    if (!playing) return;
    if (moveIndex >= moves.length) { playing = false; return; }
    const index = moveIndex;
    const timer = setTimeout(() => replayTo(index + 1), 650);
    return () => clearTimeout(timer);
  });
  // A finished game opens on the final position; ordinary archive replays start at zero.
  // svelte-ignore state_referenced_locally
  if (props.initialPosition === 'end') replayTo(moves.length, false);

  function onKeyDown(e) {
    if (e.target?.closest('input, textarea, select, [contenteditable=true]') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'Home') { e.preventDefault(); toStart(); }
    else if (e.key === 'End') { e.preventDefault(); toEnd(); }
  }

  const resultText = gameResultLabel(g.result, { red: g.redPlayer, black: g.blackPlayer });

  const endReason = gameEndReason(g.endReason, g.result);
  onDestroy(() => clearTimeout(animationTimer));

</script>

<div class="replay-board" class:review={props.review} role="region" aria-label="Game replay" style={pieceSkinCss(props.skin ?? DEFAULT_PIECE_SKIN)}>
  <div class="replay-header">
    <span class="rp-name red"><PlayerLink username={g.redPlayer} profileUrl={g.redProfileUrl} /></span>
    <span class="rp-vs">vs</span>
    <span class="rp-name black"><PlayerLink username={g.blackPlayer} profileUrl={g.blackProfileUrl} /></span>
  </div>

  <div class="board">
    {#each { length: 8 } as _, vr}
      {#each { length: 8 } as _, vc}
        {@const r = view(vr)}
        {@const c = view(vc)}
        {@const isDark = (r + c) % 2 === 1}
        {@const piece = checkers.at(r, c)}
        {@const isFrom = lastMove && lastMove.fromRow === r && lastMove.fromCol === c}
        {@const isTo = lastMove && lastMove.toRow === r && lastMove.toCol === c}
        {@const isAnimatingTo = animating && animating.toRow === r && animating.toCol === c}
        <div class="cell" data-row={r} data-col={c} class:dark={isDark} class:light={!isDark} class:highlight-from={isFrom} class:highlight-to={isTo}>
          {#if piece && !isAnimatingTo}
            <div class="piece" class:red={piece.color === 'red'} class:black={piece.color === 'black'}>
              {#if piece.queen}<span class="crown">♛</span>{/if}
            </div>
          {/if}
        </div>
      {/each}
    {/each}
    {#if animating}
      {#key animating.id}
      <div class="sliding-piece"
        class:red={animating.color === 'red'} class:black={animating.color === 'black'}
        style="--from-col:{view(animating.fromCol)};--from-row:{view(animating.fromRow)};--to-col:{view(animating.toCol)};--to-row:{view(animating.toRow)}">
        {#if animating.queen}<span class="crown">♛</span>{/if}
      </div>
      {/key}
    {/if}
  </div>

  <div class="controls">
    <button class="ctrl-btn" onkeydown={onKeyDown} onclick={toStart} disabled={moveIndex === 0} aria-label="First position" title="Start">⏮</button>
    <button class="ctrl-btn" onkeydown={onKeyDown} onclick={prev} disabled={moveIndex === 0} aria-label="Previous move" title="Previous">◀</button>
    <button class="ctrl-btn playback" onkeydown={onKeyDown} onclick={togglePlayback} disabled={!moves.length} aria-pressed={playing}>{playing ? 'Pause' : 'Replay game'}</button>
    <button class="ctrl-btn" onkeydown={onKeyDown} onclick={next} disabled={moveIndex >= moves.length} aria-label="Next move" title="Next">▶</button>
    <button class="ctrl-btn" onkeydown={onKeyDown} onclick={toEnd} disabled={moveIndex >= moves.length} aria-label="Final position" title="End">⏭</button>
  </div>
  <span class="move-counter" aria-live="polite">{moveIndex} / {moves.length}</span>

  {#if invalidMoveIndex !== null}
    <p class="hint">Replay unavailable from recorded step {invalidMoveIndex + 1}. Only the verified moves are shown.</p>
  {:else if moveIndex >= moves.length && !props.review}
    <div class="outcome" class:win={!!winningColor(g.result)}>
      <span class="outcome-result">{#if winningColor(g.result)}<PlayerLink username={g.result === 'RED_WIN' ? g.redPlayer : g.blackPlayer} profileUrl={g.result === 'RED_WIN' ? g.redProfileUrl : g.blackProfileUrl} /> wins{:else}{resultText}{/if}</span>
      <span class="outcome-reason">{endReason}</span>
    </div>
  {:else}
    <p class="hint">{moves.length ? 'Review each move, or play the whole game.' : 'No moves were played.'}</p>
  {/if}
</div>

<style>
  .replay-board {
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-md);
    width: 100%;
  }

  .replay-header { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: var(--sp-sm); font-size: var(--fs-body); overflow-wrap: anywhere; }
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
    display: flex; align-items: center; justify-content: center;
    z-index: 2;
    animation: slide-move 0.2s ease-out forwards;
    left: calc(var(--to-col) * 12.5%);
    top: calc(var(--to-row) * 12.5%);
  }
  .sliding-piece::before {
    content: ''; display: block;
    width: 70%; height: 70%;
    border-radius: 50%;
  }
  .sliding-piece.red::before { background: var(--red-piece); box-shadow: var(--red-shadow); border: 1px solid var(--red-stroke); }
  .sliding-piece.black::before { background: var(--black-piece); box-shadow: var(--black-shadow); border: 1px solid var(--black-stroke); }
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
  .piece.red { background: var(--red-piece); box-shadow: var(--red-shadow); border: 1px solid var(--red-stroke); }
  .piece.black { background: var(--black-piece); box-shadow: var(--black-shadow); border: 1px solid var(--black-stroke); }
  .crown { font-size: 0.7em; color: var(--gold); }

  .controls { display: grid; grid-template-columns: 44px 44px minmax(0, 1fr) 44px 44px; width: 100%; max-width: 400px; align-items: center; gap: 4px; }
  .review { gap: var(--sp-sm); }
  .review .board { max-width: min(400px, 48dvh); }
  .ctrl-btn.playback { padding: 0 4px; font-family: var(--font); font-size: var(--fs-caption); white-space: nowrap; }
  @media (prefers-reduced-motion: reduce) { .sliding-piece { animation-duration: 0ms; } }
  .ctrl-btn {
    background: var(--surface); border: 1px solid var(--surface2); color: var(--text);
    font-size: 1rem; min-width: 44px; height: 44px; border-radius: var(--radius-md);
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
