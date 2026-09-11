<script>
  // Board diagram for strategy articles. The grid is rendered on the server so
  // the position is visible (and indexable) without JavaScript; stepping and
  // "try" mode hydrate on top of it. No window listeners, no canvas.
  import { onMount, onDestroy } from 'svelte';
  import { chooseDiagramMove } from '$lib/content/search.js';
  import { nextBoardSquare } from '$lib/boardKeyboard.js';
  import {
    gameFromPosition, parseMove, squareNumber, squareCoords, listPieces,
    describePosition, moveNotation, isDark, diagramSteps
  } from '$lib/content/position.js';

  let {
    position,
    toMove = 'red',
    highlight = [],
    arrows = [],
    moves = [],
    caption = '',
    mode = 'static',      // static | step | try
    bot = null,           // easy | medium | hard (try mode only)
    numbered = false,     // print the 1-32 square numbers on the dark squares
    variants = null       // [{ label, highlight, arrows }] toggle for the marked squares
  } = $props();

  const BOT_DEPTH = { easy: 2, medium: 4, hard: 6 };
  const uid = $props.id();

  // svelte-ignore state_referenced_locally
  const startPosition = position;
  // svelte-ignore state_referenced_locally
  const startMover = toMove;
  // svelte-ignore state_referenced_locally
  const steps = diagramSteps(moves);

  // $state.raw: the CheckersGame is not proxied; `rev` is bumped after in-place mutations
  let game = $state.raw(gameFromPosition(startPosition, startMover));
  let rev = $state(0);
  let stepIndex = $state(0);      // step mode: how many of `steps` are applied
  let selected = $state(null);    // try mode: { row, col }
  let lastMove = $state(null);    // { fromRow, fromCol, toRow, toCol }
  let animating = $state(null);   // sliding piece during a step
  let thinking = $state(false);
  let notice = $state('');
  let variantIndex = $state(0);
  let animationTimer, replyTimer, replyResolve, searchAbort, generation = 0, animationId = 0;
  let reducedMotion = $state(false), focusSquare = $state(1), boardElement;
  onMount(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion = query.matches; if (reducedMotion) { clearTimeout(animationTimer); animating = null; } };
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });
  onDestroy(cancelWork);
  function cancelWork() { generation++; clearTimeout(animationTimer); clearTimeout(replyTimer); replyResolve?.(); replyResolve = null; searchAbort?.abort(); searchAbort = null; animating = null; }

  let played = $state(false);     // try mode: the reader has moved, hide the intro marks

  const view = $derived.by(() => {
    rev;
    return {
      board: game.board.map(row => row.map(p => (p ? { ...p } : null))),
      mover: game.currentPlayer,
      over: game.gameOver,
      winner: game.winner,
      drawReason: game.drawReason,
      chain: game.chainPiece ? { ...game.chainPiece } : null
    };
  });

  const activeVariant = $derived(variants && variants.length ? variants[variantIndex] : null);
  const markSquares = $derived(
    played ? [] : (activeVariant ? (activeVariant.highlight || []) : (highlight || []))
  );
  const markArrows = $derived(
    played ? [] : (activeVariant ? (activeVariant.arrows || []) : (arrows || []))
  );
  const marked = $derived(new Set(markSquares));

  const targets = $derived.by(() => {
    rev;
    if (mode !== 'try' || !selected) return [];
    return game.getValidMovesFor(selected.row, selected.col);
  });
  const targetSet = $derived(new Set(targets.map(t => `${t.toRow},${t.toCol}`)));
  const captureTargets = $derived(new Set(targets.filter(t => t.captured.length).map(t => `${t.toRow},${t.toCol}`)));

  const pieces = $derived(listPieces(view.board));
  const label = $derived(
    (caption ? caption.replace(/\.?\s*$/, '. ') : '') + describePosition(view.board, view.mover)
  );

  const arrowLines = $derived(markArrows.flatMap(parseMove).map(hop => {
    const x1 = hop.fromCol + 0.5, y1 = hop.fromRow + 0.5;
    const x2 = hop.toCol + 0.5, y2 = hop.toRow + 0.5;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const trim = 0.38;
    return { x1, y1, x2: x2 - (dx / len) * trim, y2: y2 - (dy / len) * trim };
  }));

  const status = $derived.by(() => {
    if (notice) return notice;
    if (view.over) {
      if (view.winner) return `${view.winner === 'red' ? 'Red' : 'Black'} wins.`;
      return view.drawReason === 'repetition' ? 'Draw by repetition.' : 'Draw: 50 turns without a capture.';
    }
    if (thinking) return `${view.mover === 'red' ? 'Red' : 'Black'} (bot) is thinking…`;
    if (selected && targets.length) return `Square ${squareNumber(selected.row, selected.col)} selected. ${view.chain ? 'Continue the jump. ' : ''}Legal ${targets[0].captured.length ? 'capture landings' : 'destinations'}: ${targets.map(t => squareNumber(t.toRow, t.toCol)).join(', ')}.`;
    if (view.chain) return `${view.mover === 'red' ? 'Red' : 'Black'} must continue the jump.`;
    if (mode === 'try' && game.getAllCaptures().length) return `${view.mover === 'red' ? 'Red' : 'Black'} to move: a capture is available, so it must be taken.`;
    return `${view.mover === 'red' ? 'Red' : 'Black'} to move.`;
  });

  function touch() { rev++; }

  function animateStep(fromRow, fromCol, toRow, toCol, piece) {
    clearTimeout(animationTimer); animating = null;
    if (!piece || reducedMotion) return;
    animating = { id: ++animationId, fromRow, fromCol, toRow, toCol, color: piece.color, queen: piece.queen };
    animationTimer = setTimeout(() => { animating = null; }, 220);
  }

  // ---- step mode -------------------------------------------------------
  function rebuild(count) {
    game = gameFromPosition(startPosition, startMover);
    for (let i = 0; i < count; i++) {
      for (const s of parseMove(steps[i].move)) {
        if (!game.makeMove(s.fromRow, s.fromCol, s.toRow, s.toCol)) {
          throw new Error(`Illegal move ${steps[i].move} in diagram step ${i + 1}`);
        }
      }
    }
  }

  function goTo(index) {
    index = Math.max(0, Math.min(steps.length, index));
    if (index === stepIndex) return;
    cancelWork();
    const forward = index === stepIndex + 1;
    const backward = index === stepIndex - 1;
    let anim = null;
    if (forward || backward) {
      const s = parseMove(steps[forward ? stepIndex : stepIndex - 1].move);
      const first = s[0], last = s[s.length - 1];
      if (forward) {
        anim = { fromRow: first.fromRow, fromCol: first.fromCol, toRow: last.toRow, toCol: last.toCol, piece: { ...game.at(first.fromRow, first.fromCol) } };
      } else {
        anim = { fromRow: last.toRow, fromCol: last.toCol, toRow: first.fromRow, toCol: first.fromCol, piece: { ...game.at(last.toRow, last.toCol) } };
      }
    }
    rebuild(index);
    stepIndex = index;
    if (anim) {
      lastMove = { fromRow: anim.fromRow, fromCol: anim.fromCol, toRow: anim.toRow, toCol: anim.toCol };
      animateStep(anim.fromRow, anim.fromCol, anim.toRow, anim.toCol, anim.piece);
    } else {
      lastMove = null;
    }
    touch();
  }

  // ---- try mode --------------------------------------------------------
  function humanColor() { return startMover; }
  function botColor() { return startMover === 'red' ? 'black' : 'red'; }

  function onCell(r, c) {
    if (mode !== 'try' || view.over || thinking || animating) return;
    const piece = game.at(r, c);
    const key = `${r},${c}`;
    if (selected && targetSet.has(key)) {
      const move = targets.find(t => t.toRow === r && t.toCol === c);
      applyMove(move);
      return;
    }
    if (piece && piece.color === game.currentPlayer) {
      if (bot && piece.color !== humanColor()) return;
      selected = { row: r, col: c };
      const legal = game.getValidMovesFor(r, c);
      if (!legal.length) {
        notice = game.getAllCaptures().length
          ? 'That piece cannot move now: a capture is available elsewhere and it must be taken.'
          : 'That piece has no legal move.';
      } else {
        notice = '';
      }
      return;
    }
    selected = null;
    notice = '';
  }

  function applyMove(move) {
    const piece = { ...game.at(move.fromRow, move.fromCol) };
    const result = game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    if (!result) return;
    played = true;
    notice = '';
    lastMove = { fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol };
    animateStep(move.fromRow, move.fromCol, move.toRow, move.toCol, piece);
    if (result.chainContinues) {
      selected = { row: move.toRow, col: move.toCol };
      touch();
      return;
    }
    selected = null;
    touch();
    if (bot && !game.gameOver && game.currentPlayer === botColor()) {
      thinking = true;
      replyTimer = setTimeout(botReply, reducedMotion ? 0 : 260);
    }
  }

  async function botReply() {
    const owner = generation, position = game;
    searchAbort = new AbortController();
    const signal = searchAbort.signal;
    try {
      do {
        const move = await chooseDiagramMove(position, BOT_DEPTH[bot] || 6, signal);
        if (signal.aborted || owner !== generation || game !== position) return;
        if (!move) throw new Error('The bot could not find a legal move.');
        const piece = { ...game.at(move.fromRow, move.fromCol) };
        if (!game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol)) throw new Error('The position changed.');
        lastMove = move;
        animateStep(move.fromRow, move.fromCol, move.toRow, move.toCol, piece);
        touch();
        if (!reducedMotion) await new Promise(resolve => { replyResolve = resolve; replyTimer = setTimeout(() => { replyResolve = null; resolve(); }, 220); });
        if (signal.aborted || owner !== generation || game !== position) return;
      } while (game.chainPiece && !game.gameOver);
    } catch (error) {
      if (signal.aborted || owner !== generation) return;
      notice = 'The diagram bot is unavailable. Reset to try again.';
    } finally {
      if (owner === generation) { thinking = false; searchAbort = null; touch(); }
    }
  }

  function keydown(event, row, col) {
    const next = nextBoardSquare(row, col, event.key);
    if (!next) return;
    event.preventDefault(); focusSquare = squareNumber(next.row, next.col);
    boardElement.querySelector(`[data-square="${focusSquare}"]`)?.focus();
  }

  function reset() {
    cancelWork();
    game = gameFromPosition(startPosition, startMover);
    selected = null;
    lastMove = null;
    animating = null;
    thinking = false;
    notice = '';
    played = false;
    stepIndex = 0;
    touch();
  }

  const interactive = $derived(mode === 'try');
  const boardRole = $derived(interactive ? 'group' : 'img');
</script>

<figure class="diagram" data-mode={mode}>
  {#if variants && variants.length}
    <div class="variants" role="group" aria-label="Rule variant">
      {#each variants as v, i}
        <button type="button" class="variant" class:active={i === variantIndex} aria-pressed={i === variantIndex} onclick={() => { variantIndex = i; }}>{v.label}</button>
      {/each}
    </div>
  {/if}

  <div class="board" bind:this={boardElement} role={boardRole} aria-label={label} data-position={startPosition} data-to-move={startMover}>
    {#each { length: 8 } as _, r}
      {#each { length: 8 } as _, c}
        {@const dark = isDark(r, c)}
        {@const piece = view.board[r][c]}
        {@const n = squareNumber(r, c)}
        {@const key = `${r},${c}`}
        {@const isSel = selected && selected.row === r && selected.col === c}
        {@const isFrom = lastMove && lastMove.fromRow === r && lastMove.fromCol === c}
        {@const isTo = lastMove && lastMove.toRow === r && lastMove.toCol === c}
        {@const hidePiece = animating && animating.toRow === r && animating.toCol === c}
        {#if interactive && dark}
          <button
            type="button"
            class="cell dark"
            class:mark={marked.has(n)}
            class:selected={isSel}
            class:target={targetSet.has(key)}
            class:capture={captureTargets.has(key)}
            class:from={isFrom}
            class:to={isTo}
            aria-label={`Square ${n}, ${piece ? `${piece.color} ${piece.queen ? 'king' : 'man'}` : 'empty'}${targetSet.has(key) ? captureTargets.has(key) ? ', legal capture landing' : ', legal destination' : ''}`}
            aria-pressed={isSel ? 'true' : 'false'}
            data-square={n} tabindex={focusSquare === n ? 0 : -1} aria-disabled={thinking || !!animating || view.over}
            onfocus={() => focusSquare = n} onkeydown={event => keydown(event, r, c)} onclick={() => onCell(r, c)}
          >
            {#if numbered}<span class="num" aria-hidden="true">{n}</span>{/if}
            {#if piece && !hidePiece}
              <span class="piece" class:red={piece.color === 'red'} class:black={piece.color === 'black'}>
                {#if piece.queen}<span class="crown">♛</span>{/if}
              </span>
            {/if}
          </button>
        {:else}
          <div
            class="cell"
            class:dark
            class:light={!dark}
            class:mark={dark && marked.has(n)}
            class:from={isFrom}
            class:to={isTo}
          >
            {#if numbered && dark}<span class="num" aria-hidden="true">{n}</span>{/if}
            {#if piece && !hidePiece}
              <span class="piece" class:red={piece.color === 'red'} class:black={piece.color === 'black'}>
                {#if piece.queen}<span class="crown">♛</span>{/if}
              </span>
            {/if}
          </div>
        {/if}
      {/each}
    {/each}

    {#if arrowLines.length}
      <svg class="arrows" viewBox="0 0 8 8" aria-hidden="true">
        <defs>
          <marker id="{uid}-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" />
          </marker>
        </defs>
        {#each arrowLines as a}
          <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} marker-end="url(#{uid}-head)" />
        {/each}
      </svg>
    {/if}

    {#if animating}
      {#key animating.id}
      <div class="sliding-piece"
        class:red={animating.color === 'red'} class:black={animating.color === 'black'}
        style="--from-col:{animating.fromCol};--from-row:{animating.fromRow};--to-col:{animating.toCol};--to-row:{animating.toRow}">
        {#if animating.queen}<span class="crown">♛</span>{/if}
      </div>
      {/key}
    {/if}
  </div>

  <ul class="sr-only">
    {#each pieces as p}
      <li>Square {p.square}: {p.piece}</li>
    {/each}
  </ul>

  {#if mode === 'step' && steps.length}
    <div class="controls">
      <button type="button" class="ctrl-btn" onclick={() => goTo(0)} disabled={stepIndex === 0} aria-label="Back to the start">⏮</button>
      <button type="button" class="ctrl-btn" onclick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0} aria-label="Previous step">◀</button>
      <span class="move-counter">{stepIndex} / {steps.length}</span>
      <button type="button" class="ctrl-btn" onclick={() => goTo(stepIndex + 1)} disabled={stepIndex >= steps.length} aria-label="Next step">▶</button>
      <button type="button" class="ctrl-btn" onclick={() => goTo(steps.length)} disabled={stepIndex >= steps.length} aria-label="Go to the end">⏭</button>
    </div>
    <p class="sr-only" aria-live="polite" aria-atomic="true">{stepIndex ? `Step ${stepIndex} of ${steps.length}: ${steps[stepIndex - 1].move}. ${steps[stepIndex - 1].note} ${status}` : 'Starting position.'}</p>
    <ol class="move-list">
      {#each steps as s, i}
        <li class:current={i === stepIndex - 1} class:done={i < stepIndex}>
          <button type="button" class="move-btn" aria-current={i === stepIndex - 1 ? 'step' : undefined} onclick={() => goTo(i + 1)}>{s.move}</button>
          {#if s.note}<span class="note">{s.note}</span>{/if}
        </li>
      {/each}
    </ol>
  {/if}

  {#if mode === 'try'}
    <div class="try-bar">
      <p class="status" aria-live="polite">{status}</p>
      <button type="button" class="ctrl-btn reset" onclick={reset} disabled={!played}>Reset</button>
    </div>
    {#if bot}
      <p class="hint">You play {startMover}; the {bot} bot (searches up to depth {BOT_DEPTH[bot]} with a time limit) answers for {botColor()}. Click a piece, then a highlighted square.</p>
    {:else}
      <p class="hint">Click a piece, then a highlighted square. Both sides are yours to move.</p>
    {/if}
  {/if}

  {#if caption}
    <figcaption>{caption}</figcaption>
  {/if}
</figure>

<style>
  .diagram {
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-sm);
    margin: var(--sp-lg) 0; width: 100%;
  }

  .board {
    display: grid; grid-template-columns: repeat(8, 1fr);
    width: 100%; max-width: 360px; aspect-ratio: 1;
    border-radius: var(--radius-md); overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    position: relative;
  }
  .cell {
    aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
    position: relative; border: none; padding: 0; font-family: inherit;
  }
  .cell.light { background: var(--board-light); }
  .cell.dark { background: var(--board-dark); }
  button.cell { cursor: pointer; }
  button.cell:focus-visible { outline: 2px solid var(--text); outline-offset: -2px; }

  .cell.mark { box-shadow: inset 0 0 0 3px rgba(251,191,36,0.85); }
  .cell.from { box-shadow: inset 0 0 0 2px rgba(100,180,255,0.45); }
  .cell.to { box-shadow: inset 0 0 0 2px rgba(100,180,255,0.7); }
  .cell.selected { box-shadow: inset 0 0 0 3px rgba(250,250,249,0.9); }
  .cell.target::after {
    content: ''; width: 28%; height: 28%; border-radius: 50%;
    background: rgba(250,250,249,0.6); position: absolute;
  }
  .cell.target.capture::after { background: rgba(239,68,68,0.85); }

  .num {
    position: absolute; top: 2px; left: 3px;
    font-size: 0.55rem; line-height: 1; color: rgba(255,255,255,0.55); font-family: var(--font-mono);
  }

  .piece {
    width: 70%; height: 70%; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .piece.red { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .piece.black { background: radial-gradient(circle at 35% 35%, #44403c, #1c1917); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .crown { font-size: 0.8em; color: var(--gold); line-height: 1; }

  .arrows { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .arrows line { stroke: rgba(250,250,249,0.9); stroke-width: 0.12; stroke-linecap: round; }
  .arrows marker path { fill: rgba(250,250,249,0.9); }

  .sliding-piece {
    position: absolute; width: 12.5%; height: 12.5%;
    display: flex; align-items: center; justify-content: center; z-index: 2;
    animation: slide-move 0.2s ease-out forwards;
    left: calc(var(--to-col) * 12.5%); top: calc(var(--to-row) * 12.5%);
    pointer-events: none;
  }
  .sliding-piece::before { content: ''; display: block; width: 70%; height: 70%; border-radius: 50%; }
  .sliding-piece.red::before { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .sliding-piece.black::before { background: radial-gradient(circle at 35% 35%, #44403c, #1c1917); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .sliding-piece .crown { position: absolute; }
  @keyframes slide-move {
    from { left: calc(var(--from-col) * 12.5%); top: calc(var(--from-row) * 12.5%); }
    to { left: calc(var(--to-col) * 12.5%); top: calc(var(--to-row) * 12.5%); }
  }

  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }

  .variants { display: flex; gap: var(--sp-xs); flex-wrap: wrap; justify-content: center; }
  .variant {
    background: var(--surface); border: 1px solid var(--surface2); color: var(--text-dim);
    font: inherit; font-size: var(--fs-caption); padding: var(--sp-xs) var(--sp-md);
    border-radius: var(--radius-pill); cursor: pointer;
  }
  .variant.active { color: var(--text); border-color: var(--gold); }

  .controls { display: flex; align-items: center; gap: var(--sp-sm); }
  .ctrl-btn {
    background: var(--surface); border: 1px solid var(--surface2); color: var(--text);
    font-size: 1rem; width: 40px; height: 40px; border-radius: var(--radius-md);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s; font-family: inherit;
  }
  .ctrl-btn:hover:not(:disabled) { background: var(--surface2); }
  .ctrl-btn:disabled { opacity: 0.3; cursor: default; }
  .ctrl-btn.reset { width: auto; padding: 0 var(--sp-md); font-size: var(--fs-caption); height: 32px; }
  .move-counter { font-size: var(--fs-caption); color: var(--text-dim); min-width: 60px; text-align: center; font-family: var(--font-mono); }

  .move-list {
    list-style: none; display: flex; flex-wrap: wrap; gap: var(--sp-xs) var(--sp-sm);
    justify-content: center; max-width: 360px; padding: 0; margin: 0;
  }
  .move-list li { display: flex; align-items: baseline; gap: var(--sp-xs); font-size: var(--fs-caption); color: var(--text-dim); }
  .move-btn {
    flex-shrink: 0; white-space: nowrap;
    background: none; border: none; color: var(--text-dim); font-family: var(--font-mono);
    font-size: var(--fs-caption); cursor: pointer; padding: 2px 4px; border-radius: var(--radius-sm);
  }
  .move-list li.done .move-btn { color: var(--text); }
  .move-list li.current .move-btn { color: var(--gold); font-weight: 700; background: var(--surface); }
  .note { font-style: italic; }

  .try-bar { display: flex; align-items: center; gap: var(--sp-md); flex-wrap: wrap; justify-content: center; }
  .status { font-size: var(--fs-caption); color: var(--text); margin: 0; }
  .hint { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; margin: 0; max-width: 360px; }

  figcaption { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; max-width: 480px; line-height: 1.5; }
</style>
