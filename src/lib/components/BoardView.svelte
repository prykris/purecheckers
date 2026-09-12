<script>
  import { TwoFingerTap } from '$lib/twoFingerTap.js';
  const touchGesture = new TwoFingerTap();
  import { onMount, createEventDispatcher } from 'svelte';
  import { DEFAULT_PIECE_SKIN, pieceSkinCss } from '../../../shared/pieceSkins.js';
  import { DEFAULT_THEME_VARS } from '../../../shared/themes.js';
  import { drawCanvasPiece } from '$lib/canvasPiece.js';
  import { nextBoardSquare } from '$lib/boardKeyboard.js';
  import { squareNumber } from '../../../shared/notation.js';

  export let showHints = true;
  export let skin = DEFAULT_PIECE_SKIN;
  export let game;           // CheckersGame instance
  export let flip = false;   // view from black's perspective
  export let myColor = 'red';
  export let selectedPiece = null;
  export let validMoves = [];
  export let lastMove = null;
  export let lastMoveCaptured = [];
  export let interactive = true;
  export let readOnlyLabel = null;
  export let animation = null;
  export let maxSize = 320; // square edge allocated by the layout, in CSS pixels
  $: animating = !!animation;

  const dispatch = createEventDispatcher();

  let canvasEl;
  let ctx;
  let CELL = 60, BOARD_PX = 480;
  let boardTextureCanvas = null;
  let hoveredCell = null;
  let drag = null;
  let keyboardGrid, focusSquare = 1;

  export function resize() { resizeBoard(); }
  export function redraw() { drawBoard(); }

  onMount(() => {
    ctx = canvasEl.getContext('2d');
    resizeBoard();
    window.addEventListener('resize', resizeBoard);
    window.visualViewport?.addEventListener('resize', resizeBoard);
    const observer = new MutationObserver(() => { generateBoardTexture(); drawBoard(); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeBoard);
      window.visualViewport?.removeEventListener('resize', resizeBoard);
    };
  });

  // Redraw when props change
  $: if (ctx && game) { skin; showHints; flip; animation; selectedPiece; validMoves; lastMove; lastMoveCaptured; interactive; drawBoard(); }
  // The owner reallocates space on resize or when the surrounding controls change.
  $: if (ctx) { maxSize; resizeBoard(); }

  function resizeBoard() {
    // The table layout owns available space; the canvas only preserves a square.
    BOARD_PX = Math.max(1, Number.isFinite(maxSize) && maxSize > 0 ? maxSize : 320);
    CELL = BOARD_PX / 8;
    if (canvasEl) { const ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvasEl.width = Math.round(BOARD_PX * ratio); canvasEl.height = Math.round(BOARD_PX * ratio);
      canvasEl.style.width = BOARD_PX + 'px'; canvasEl.style.height = BOARD_PX + 'px';
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); generateBoardTexture(); drawBoard(); }
  }

  function generateBoardTexture() {
    boardTextureCanvas = document.createElement('canvas');
    boardTextureCanvas.width = BOARD_PX; boardTextureCanvas.height = BOARD_PX;
    const t = boardTextureCanvas.getContext('2d');
    const style = getComputedStyle(document.documentElement);
    const light = style.getPropertyValue('--board-light').trim() || DEFAULT_THEME_VARS['--board-light'];
    const dark = style.getPropertyValue('--board-dark').trim() || DEFAULT_THEME_VARS['--board-dark'];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      t.fillStyle = (r + c) % 2 === 0 ? light : dark;
      t.fillRect(c * CELL, r * CELL, CELL, CELL);
      const finish = t.createLinearGradient(0, r * CELL, 0, (r+1) * CELL);
      finish.addColorStop(0, 'rgba(255,240,210,0.075)'); finish.addColorStop(0.45, 'rgba(255,240,210,0)'); finish.addColorStop(1, 'rgba(20,12,4,0.06)');
      t.fillStyle=finish; t.fillRect(c*CELL,r*CELL,CELL,CELL);
      t.strokeStyle='rgba(40,25,12,0.08)';t.lineWidth=0.5;t.strokeRect(c*CELL+0.25,r*CELL+0.25,CELL-0.5,CELL-0.5);
    }

  }

  // ---- Drawing ----
  function drawPiece(...args) { drawCanvasPiece(ctx, CELL, skin, ...args); }

  function drawBoard() {
    if (!ctx || !game) return;
    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);
    if (boardTextureCanvas) {
      if (flip) { ctx.save(); ctx.translate(BOARD_PX, BOARD_PX); ctx.rotate(Math.PI); ctx.drawImage(boardTextureCanvas, 0, 0); ctx.restore(); }
      else ctx.drawImage(boardTextureCanvas, 0, 0);
    }
    if (lastMove) {
      ctx.fillStyle = 'rgba(100,180,255,0.22)';
      const fr = flip ? 7 - lastMove.fromRow : lastMove.fromRow, fc = flip ? 7 - lastMove.fromCol : lastMove.fromCol;
      const tr = flip ? 7 - lastMove.toRow : lastMove.toRow, tc = flip ? 7 - lastMove.toCol : lastMove.toCol;
      ctx.fillRect(fc * CELL, fr * CELL, CELL, CELL); ctx.fillRect(tc * CELL, tr * CELL, CELL, CELL);
      ctx.fillStyle = 'rgba(239,68,68,0.25)';
      for (const cap of lastMoveCaptured) {
        const cr = flip ? 7 - cap.row : cap.row, cc = flip ? 7 - cap.col : cap.col;
        ctx.fillRect(cc * CELL, cr * CELL, CELL, CELL);
      }
    }
    if (selectedPiece) {
      const sr = flip ? 7 - selectedPiece.row : selectedPiece.row, sc = flip ? 7 - selectedPiece.col : selectedPiece.col;
      ctx.fillStyle = 'rgba(255,255,100,0.45)'; ctx.fillRect(sc * CELL, sr * CELL, CELL, CELL);
    }
    if (interactive && hoveredCell && !selectedPiece && !animating && !game.gameOver) {
      const p = game.at(hoveredCell.row, hoveredCell.col);
      if (p && p.color === myColor && game.currentPlayer === myColor) {
        const hr = flip ? 7 - hoveredCell.row : hoveredCell.row, hc = flip ? 7 - hoveredCell.col : hoveredCell.col;
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(hc * CELL, hr * CELL, CELL, CELL);
      }
    }
    for (const m of (showHints ? validMoves : [])) {
      const mr = flip ? 7 - m.toRow : m.toRow, mc = flip ? 7 - m.toCol : m.toCol, cx = mc * CELL + CELL / 2, cy = mr * CELL + CELL / 2;
      if (m.captured.length > 0) {
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(233,69,96,0.45)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.12, 0, Math.PI * 2); ctx.fillStyle = 'rgba(233,69,96,0.5)'; ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.15, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,100,0.5)'; ctx.fill();
      }
    }
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (animation && r === animation.toRow && c === animation.toCol) continue;
      if (drag?.moved && r === drag.row && c === drag.col) continue;
      const p = game.at(r, c); if (!p) continue;
      const dr = flip ? 7 - r : r, dc = flip ? 7 - c : c;
      drawPiece(dc * CELL + CELL / 2, dr * CELL + CELL / 2, p.color, p.queen);
    }
    if (drag?.moved) drawPiece(drag.x, drag.y - CELL * 0.08, drag.piece.color, drag.piece.queen, 1, 1.1);
    for (const cap of animation?.captured || []) {
      const cr = flip ? 7 - cap.row : cap.row, cc = flip ? 7 - cap.col : cap.col;
      drawPiece(cc * CELL + CELL / 2, cr * CELL + CELL / 2, cap.color, cap.queen,
        1 - animation.captureProgress, 1 - animation.captureProgress * 0.45);
    }
    if (animation) {
      const { fromRow, fromCol, toRow, toCol, movement, crownProgress, pieceColor, pieceQueen, promoted } = animation;
      const row = fromRow + (toRow - fromRow) * movement, col = fromCol + (toCol - fromCol) * movement;
      const x = ((flip ? 7 - col : col) + 0.5) * CELL, y = ((flip ? 7 - row : row) + 0.5) * CELL;
      if (promoted && crownProgress > 0) {
        ctx.save(); ctx.globalAlpha = Math.sin(crownProgress * Math.PI) * 0.8;
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, CELL * (0.35 + crownProgress * 0.18), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      drawPiece(x, y, pieceColor, pieceQueen || crownProgress > 0.35, 1,
        1 + (promoted ? Math.sin(crownProgress * Math.PI) * 0.12 : 0));
    }
  }

  // Dragging is presentation only; release sends the same intent as click-to-move.
  $: if (drag && (!interactive || drag.ply !== game.moveHistory.length)) { drag = null; drawBoard(); }
  function pointerDown(event) {
    if (event.pointerType === 'touch') {
      canvasEl.setPointerCapture(event.pointerId);
      if (touchGesture.down(event.pointerId,event.clientX,event.clientY,event.timeStamp)) {
        drag = null; hoveredCell = null; dispatch('deselect'); drawBoard(); return;
      }
    }
    if (!event.isPrimary || event.button !== 0 || !interactive || animating || game.gameOver || game.currentPlayer !== myColor) return;
    const rect = canvasEl.getBoundingClientRect();
    let col = Math.floor((event.clientX - rect.left) * 8 / rect.width), row = Math.floor((event.clientY - rect.top) * 8 / rect.height);
    if (flip) { row = 7-row; col = 7-col; }
    const piece = game.at(row, col);
    if (piece?.color !== myColor) return;
    const moves = game.getValidMovesFor(row, col);
    if (!moves.length) return;
    drag = { pointerId: event.pointerId, row, col, piece, moves, ply: game.moveHistory.length, startX: event.clientX, startY: event.clientY, moved: false };
    canvasEl.setPointerCapture(event.pointerId);
    dispatch('select', { row, col, moves });
  }
  function pointerMove(event) {
    if (event.pointerType === 'touch' && touchGesture.move(event.pointerId,event.clientX,event.clientY)) return;
    if (!drag) { onMouseMove(event); return; }
    if (event.pointerId !== drag.pointerId) return;
    const rect = canvasEl.getBoundingClientRect();
    drag = { ...drag, moved: drag.moved || Math.hypot(event.clientX-drag.startX, event.clientY-drag.startY)>6,
      x: (event.clientX-rect.left)*BOARD_PX/rect.width, y: (event.clientY-rect.top)*BOARD_PX/rect.height };
    drawBoard();
  }
  function pointerUp(event) {
    if (event.pointerType === 'touch') {
      const gesture = touchGesture.up(event.pointerId,event.clientX,event.clientY,event.timeStamp);
      if (gesture.consume) {
        if (canvasEl.hasPointerCapture(event.pointerId)) canvasEl.releasePointerCapture(event.pointerId);
        if (gesture.toggle) dispatch('togglefocus');
        return;
      }
    }
    if (drag && event.pointerId !== drag.pointerId) return;
    const held = drag; drag = null;
    if (canvasEl.hasPointerCapture(event.pointerId)) canvasEl.releasePointerCapture(event.pointerId);
    if (!held?.moved) { onClick(event); return; }
    const rect = canvasEl.getBoundingClientRect();
    let col = Math.floor((event.clientX-rect.left)*8/rect.width), row = Math.floor((event.clientY-rect.top)*8/rect.height);
    if (flip) { row=7-row; col=7-col; }
    if (interactive && held.ply === game.moveHistory.length && held.moves.some(move => move.toRow === row && move.toCol === col)) {
      dispatch('move', { fromRow: held.row, fromCol: held.col, toRow: row, toCol: col });
    }
    drawBoard();
  }
  function cancelPointer(event) {
    touchGesture.up(event.pointerId,event.clientX,event.clientY,event.timeStamp,true);
    if (!drag || drag.pointerId === event.pointerId) { drag = null; dispatch('deselect'); drawBoard(); }
  }
  // ---- Input (only when interactive) ----
  function onClick(e) {
    if (!interactive || !game || game.gameOver || animating || game.currentPlayer !== myColor) return;
    const rect = canvasEl.getBoundingClientRect();
    let col = Math.floor((e.clientX - rect.left) * 8 / rect.width);
    let row = Math.floor((e.clientY - rect.top) * 8 / rect.height);
    if (flip) { row = 7 - row; col = 7 - col; }
    activateSquare(row, col);
  }
  function activateSquare(row, col) {
    if (!interactive || !game || game.gameOver || animating || game.currentPlayer !== myColor) return;
    const mt = validMoves.find(m => m.toRow === row && m.toCol === col);
    if (mt && selectedPiece) {
      dispatch('move', { fromRow: selectedPiece.row, fromCol: selectedPiece.col, toRow: row, toCol: col });
      return;
    }
    const piece = game.at(row, col);
    if (piece && piece.color === myColor) {
      const moves = game.getValidMovesFor(row, col);
      if (moves.length > 0) dispatch('select', { row, col, moves });
      else dispatch('deselect');
    } else {
      dispatch('deselect');
    }
  }

  function keydown(event, row, col) {
    if (event.key === 'Escape') { event.preventDefault(); dispatch('deselect'); return; }
    const next = nextBoardSquare(row, col, event.key, flip);
    if (!next) return;
    event.preventDefault(); focusSquare = squareNumber(next.row, next.col);
    keyboardGrid.querySelector(`[data-square="${focusSquare}"]`)?.focus();
  }

  function onMouseMove(e) {
    if (!interactive || !game || game.gameOver || animating) { if (canvasEl) canvasEl.style.cursor = 'default'; return; }
    const rect = canvasEl.getBoundingClientRect();
    let col = Math.floor((e.clientX - rect.left) * 8 / rect.width);
    let row = Math.floor((e.clientY - rect.top) * 8 / rect.height);
    if (col < 0 || col > 7 || row < 0 || row > 7) return;
    if (flip) { row = 7 - row; col = 7 - col; }
    const piece = game.at(row, col), isTarget = validMoves.some(m => m.toRow === row && m.toCol === col);
    canvasEl.style.cursor = (piece?.color === myColor && game.currentPlayer === myColor) || isTarget ? 'pointer' : 'default';
    const nh = (piece?.color === myColor) ? { row, col } : null;
    if (hoveredCell?.row !== nh?.row || hoveredCell?.col !== nh?.col) { hoveredCell = nh; if (!animating) drawBoard(); }
  }
</script>

<div class="board-wrap" style={pieceSkinCss(skin)} class:finished={game.gameOver} data-stage={animation?.stage || 'settled'} data-progress={animation?.movement ?? 1}>
  <canvas bind:this={canvasEl} width="480" height="480" aria-hidden="true"
    on:pointerdown={pointerDown} on:pointermove={pointerMove} on:pointerup={pointerUp}
    on:pointercancel={cancelPointer} on:lostpointercapture={event=>{if(touchGesture.points.has(event.pointerId)||drag?.pointerId===event.pointerId)cancelPointer(event);}}
    on:mouseleave={() => { hoveredCell = null; if (canvasEl) canvasEl.style.cursor = 'default'; if (!animating) drawBoard(); }}></canvas>
  <div class="keyboard-grid" bind:this={keyboardGrid} role="group" aria-label="Checkers board. Arrow keys move focus; Enter or Space selects a piece or destination. Escape clears selection.">
    {#each { length: 8 } as _, vr}
      {#each { length: 8 } as _, vc}
        {@const row = flip ? 7 - vr : vr}
        {@const col = flip ? 7 - vc : vc}
        {@const n = squareNumber(row, col)}
        {@const piece = game.board[row][col]}
        {@const selected = selectedPiece?.row === row && selectedPiece?.col === col}
        {#if n}
          <button type="button" class="keyboard-square" data-square={n} data-focus-fallback={focusSquare === n ? '' : undefined}
            tabindex={focusSquare === n ? 0 : -1} aria-pressed={selected} aria-disabled={!interactive}
            aria-label={`Square ${n}: ${piece ? `${piece.color} ${piece.queen ? 'king' : 'man'}` : 'empty'}${validMoves.some(m => m.toRow === row && m.toCol === col) ? ', legal destination' : ''}`}
            on:focus={() => focusSquare = n} on:click={() => activateSquare(row, col)} on:keydown={event => keydown(event, row, col)}></button>
        {:else}<span aria-hidden="true"></span>{/if}
      {/each}
    {/each}
  </div>
  <p class="sr-only" role="status">{readOnlyLabel || (game.gameOver ? 'Game ended.' : !interactive ? 'Waiting for your turn or server confirmation.' : game.chainPiece ? 'Continue capturing with the same piece.' : selectedPiece ? 'Choose a legal destination.' : `${game.currentPlayer} to move. Select a piece.`)}</p>
  <slot />
</div>

<style>
  .board-wrap { position: relative; touch-action: none; }

  .keyboard-grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); pointer-events: none; }
  .keyboard-square { padding: 0; background: transparent; border: 0; min-width: 0; min-height: 0; pointer-events: none; }
  .keyboard-square:focus-visible { outline: 3px solid var(--gold, #ffd166); outline-offset: -4px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  canvas {
    display: block; border-radius: var(--radius-sm); cursor: pointer; box-shadow: var(--shadow-board);
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    touch-action: none;
  }
</style>
