<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  import { onMount } from 'svelte';
  import { nextBoardSquare } from '$lib/boardKeyboard.js';
  import { get } from 'svelte/store';
  import { PuzzleController } from '$lib/puzzle/controller.js';
  import { puzzleHistory, recordPuzzleProgress, retryPuzzleProgress } from '$lib/puzzle/history.js';
  import { user, token } from '$lib/stores/user.js';
  import { refreshSession } from '$lib/api.js';
  import { squareNumber, colorName } from '../../../shared/notation.js';
  import ShareActions from './ShareActions.svelte';
  import { track } from '$lib/analytics.js';
  import { puzzleTheme } from '$lib/puzzle/presentation.js';
  let { puzzle, archived = false } = $props();
  // The parent keys this component by date; each instance owns one puzzle.
  // svelte-ignore state_referenced_locally
  const controller = new PuzzleController(puzzle);
  let view = $state(controller.snapshot());
  let board; let focusSquare = $state(1); let down = null; let suppressClick = false;
  let observedSolve = false, observedReveal = false;
  const complete = $derived(view.solved || view.revealed || archived);
  const canPlay = $derived(view.status === 'player');
  const targets = $derived(new Set(view.targets.map(m => `${m.toRow},${m.toCol}`)));
  onMount(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    controller.reducedMotion = () => media.matches;
    controller.publish = state => { view = state; };
    controller.progress = progress => {
      recordPuzzleProgress(puzzle.date, progress);
      if (progress.solved && !observedSolve) { observedSolve = true; track('puzzle_solve', { date: puzzle.date, attempts: progress.attempts }); }
      if (progress.revealed && !observedReveal) { observedReveal = true; track('puzzle_reveal', { date: puzzle.date }); }
    };
    const unsubscribe = puzzleHistory.subscribe(value => controller.restore(value.history[puzzle.date], value.scope));
    if (get(token) && !get(user)) void refreshSession().catch(() => {});
    return () => { unsubscribe(); controller.dispose(); };
  });
  function click(row, col, event) {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    suppressClick = false; focusSquare = squareNumber(row, col); void controller.select(row, col);
  }
  function pointerDown(event) {
    const cell = event.target.closest('[data-row]');
    if (!cell || !canPlay || event.button !== 0) return;
    down = { row: Number(cell.dataset.row), col: Number(cell.dataset.col), x: event.clientX, y: event.clientY };
  }
  function pointerUp(event) {
    if (!down) return;
    const start = down; down = null;
    if (Math.hypot(start.x - event.clientX, start.y - event.clientY) < 8) return;
    const rect = board.getBoundingClientRect();
    const row = Math.floor((event.clientY - rect.top) / rect.height * 8), col = Math.floor((event.clientX - rect.left) / rect.width * 8);
    suppressClick = true;
    if (row < 0 || row > 7 || col < 0 || col > 7 || controller.game.board[start.row][start.col]?.color !== puzzle.sideToMove) return;
    void controller.select(start.row, start.col).then(() => controller.select(row, col));
  }
  function keydown(event, row, col) {
    const square = nextBoardSquare(row, col, event.key);
    if (!square) return;
    event.preventDefault();
    const next = board.querySelector(`[data-row="${square.row}"][data-col="${square.col}"]`);
    if (next) { focusSquare = Number(next.dataset.square); next.focus(); }
  }
</script>

<section class="puzzle-play" aria-label="Solve the puzzle">
  <div class="puzzle-summary"><strong>{colorName(puzzle.sideToMove)} to move</strong><span>{puzzle.difficulty.toLowerCase()} · <a href={puzzleTheme(puzzle.theme).url}>{puzzleTheme(puzzle.theme).label}</a></span></div>
  <!-- Buttons provide the equivalent tap and keyboard interaction for dragging. -->
  <div class="puzzle-board" bind:this={board} role="group" aria-label="Puzzle board. Use arrow keys to move focus, Enter to select a piece or destination." onpointerdown={pointerDown} onpointerup={pointerUp} onpointercancel={() => { down = null; }} onpointerleave={() => { down = null; }}>
    {#each { length: 8 } as _, row}
      {#each { length: 8 } as _, col}
        {@const n = squareNumber(row, col)}
        {@const piece = view.board[row][col]}
        {@const selected = view.selected?.row === row && view.selected?.col === col}
        {@const hidden = view.animation?.toRow === row && view.animation?.toCol === col}
        {#if n}
          <button class="square dark" class:selected class:target={targets.has(`${row},${col}`)} type="button" data-row={row} data-col={col} data-square={n} tabindex={focusSquare === n ? 0 : -1}
            aria-pressed={selected} aria-disabled={!canPlay} aria-label={`Square ${n}: ${piece ? `${piece.color} ${piece.queen ? 'king' : 'man'}` : 'empty'}${targets.has(`${row},${col}`) ? ', legal destination' : ''}`}
            onclick={event => click(row, col, event)} onkeydown={event => keydown(event, row, col)}>
            <span class="number" aria-hidden="true">{n}</span>
            {#if piece && !hidden}<span class="piece" class:red={piece.color === 'red'} class:king={piece.queen} aria-hidden="true">{piece.queen ? '♛' : ''}</span>{/if}
          </button>
        {:else}<div class="square light" aria-hidden="true"></div>{/if}
      {/each}
    {/each}
    {#if view.animation}
      {@const a = view.animation}
      {#key a.id}
      <div class="moving" style={`left:${a.fromCol * 12.5}%;top:${a.fromRow * 12.5}%;--dx:${(a.toCol - a.fromCol) * 100}%;--dy:${(a.toRow - a.fromRow) * 100}%`} aria-hidden="true">
        <span class="piece" class:red={a.piece.color === 'red'} class:king={a.piece.queen}>{a.piece.queen ? '♛' : ''}</span>
      </div>
      {/key}
    {/if}
  </div>
  <p class="feedback" role="status">{view.notice || 'Select a piece, then its destination. You can also drag or use the keyboard.'}</p>
  <div class="puzzle-actions">
    <button class="btn btn-dark" onclick={() => controller.hint()} disabled={!canPlay}>Hint</button>
    <button class="btn btn-dark" onclick={() => controller.reveal()} disabled={!canPlay || view.solved}>Show solution</button>
    <button class="btn btn-dark" onclick={() => controller.reset()}>Start again</button>
  </div>
  <p class="progress">Attempt {view.attempts} · {$puzzleHistory.streak} day streak</p>
  {#if $puzzleHistory.history[puzzle.date]?.solved && !view.solved}<p class="progress">You’ve already solved this puzzle. You can play it again for practice.</p>{/if}
  {#if $puzzleHistory.error || $puzzleHistory.pending[puzzle.date]}
    <p class="progress" role="status">{$puzzleHistory.error || 'Progress is waiting for server confirmation.'}</p>
    <button class="btn btn-dark" disabled={$puzzleHistory.syncing} onclick={() => retryPuzzleProgress()}>{$puzzleHistory.syncing ? 'Syncing progress…' : 'Retry progress sync'}</button>
  {/if}
  {#if $puzzleHistory.storageError}<p class="progress" role="status">{$puzzleHistory.storageError}</p>{/if}
  {#if $puzzleHistory.history[puzzle.date]?.rewarded}<p class="progress">Daily reward earned: 1 coin.</p>{/if}
  {#if complete}
    <div class="explanation">
      <h2>The idea</h2>
      {#each ['theme', 'position', 'solution', 'alternatives'] as section}{#if puzzle.commentary?.[section]}<p>{puzzle.commentary[section]}</p>{/if}{/each}
      <ShareActions surface="puzzle" url={'/puzzle/' + puzzle.date} data={{ date: puzzle.date, solved: view.solved && !view.revealed, attempts: view.attempts }} label="Share puzzle" onshared={() => track('puzzle_share', { date: puzzle.date })} />
      <p><GameEntryLink  class="btn btn-primary" label="Play a real game" /></p>
    </div>
  {/if}
</section>

<style>
  .puzzle-play { max-width: 640px; margin: 0 auto; }
  .puzzle-summary { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--sp-sm); margin-bottom: var(--sp-md); }
  .puzzle-summary span, .progress { color: var(--text-dim); }
  .puzzle-board { width: min(100%, 480px); margin: auto; display: grid; grid-template-columns: repeat(8, 1fr); aspect-ratio: 1; position: relative; overflow: hidden; border-radius: var(--radius-md); touch-action: none; }
  .square { aspect-ratio: 1; border: 0; margin: 0; padding: 0; display: grid; place-items: center; position: relative; }
  .light { background: var(--board-light); } .dark { background: var(--board-dark); cursor: pointer; }
  .square.selected { box-shadow: inset 0 0 0 4px var(--accent); }
  .square:focus-visible { outline: 3px solid var(--text); outline-offset: -4px; z-index: 2; }
  .target::after { content: ''; width: 24%; height: 24%; border-radius: 50%; border: 2px solid var(--text); background: var(--accent); position: absolute; }
  .number { position: absolute; top: 1px; left: 3px; font-size: 11px; color: white; text-shadow: 0 1px 2px black; pointer-events: none; }
  .piece { width: 68%; height: 68%; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #57534e, #1c1917); box-shadow: 0 2px 4px #0008; display: grid; place-items: center; color: #facc15; font-size: clamp(16px, 5vw, 28px); pointer-events: none; }
  .piece.red { background: radial-gradient(circle at 35% 30%, #f87171, #dc2626); }
  .moving { position: absolute; width: 12.5%; height: 12.5%; display: grid; place-items: center; pointer-events: none; animation: slide 220ms ease-out forwards; }
  @keyframes slide { to { transform: translate(var(--dx), var(--dy)); } }
  .feedback { min-height: 3.5em; line-height: 1.6; margin: var(--sp-md) 0; }
  .puzzle-actions { display: flex; flex-wrap: wrap; gap: var(--sp-sm); }
  .puzzle-actions :global(.btn) { min-height: 44px; }
  .progress { margin: var(--sp-md) 0; }
  .explanation { border-top: 1px solid var(--surface2); margin-top: var(--sp-xl); padding-top: var(--sp-lg); }
  .explanation p { color: var(--text-dim); line-height: 1.8; margin: var(--sp-md) 0; }
  @media (prefers-reduced-motion: reduce) { .moving { animation-duration: 0ms; } }
</style>
