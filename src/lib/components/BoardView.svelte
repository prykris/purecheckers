<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  export let game;           // CheckersGame instance
  export let flip = false;   // view from black's perspective
  export let myColor = 'red';
  export let selectedPiece = null;
  export let validMoves = [];
  export let lastMove = null;
  export let lastMoveCaptured = [];
  export let interactive = true;
  export let animating = false;

  const dispatch = createEventDispatcher();

  let canvasEl;
  let ctx;
  let CELL = 60, BOARD_PX = 480;
  let boardTextureCanvas = null;
  let hoveredCell = null;
  let introAnim = null;

  // Animation state
  let moveAnimState = null;
  let shatterParticles = [];
  let capturedOverlay = [];
  let trail = [];

  export function resize() { resizeBoard(); }
  export function redraw() { drawBoard(); }

  export function playIntro() {
    introAnim = { startTime: performance.now() };
    animating = true;
    dispatch('animating', true);
    function tick() {
      const elapsed = performance.now() - introAnim.startTime;
      drawBoard();
      if (elapsed < 950) requestAnimationFrame(tick);
      else { introAnim = null; animating = false; dispatch('animating', false); drawBoard(); }
    }
    requestAnimationFrame(tick);
  }

  export async function animateMove(fromRow, fromCol, toRow, toCol, pieceColor, pieceQueen, captured) {
    const info = { fromRow, fromCol, toRow, toCol, pieceColor, pieceQueen, captured: captured || [] };
    animating = true;
    dispatch('animating', true);
    await animateSlide(info);
    if (info.captured.length > 0) {
      for (const cap of info.captured) {
        const cr = flip ? 7 - cap.row : cap.row, cc = flip ? 7 - cap.col : cap.col;
        spawnShatter(cc * CELL + CELL / 2, cr * CELL + CELL / 2, cap.color);
      }
    }
    if (shatterParticles.length > 0) await animateEffects();
    animating = false;
    dispatch('animating', false);
  }

  onMount(() => {
    ctx = canvasEl.getContext('2d');
    resizeBoard();
    window.addEventListener('resize', resizeBoard);
    window.visualViewport?.addEventListener('resize', resizeBoard);
  });

  onDestroy(() => {
    window.removeEventListener('resize', resizeBoard);
    window.visualViewport?.removeEventListener('resize', resizeBoard);
  });

  // Redraw when props change
  $: if (ctx && game) drawBoard();
  $: if (ctx && selectedPiece !== undefined) drawBoard();
  $: if (ctx && lastMove) drawBoard();

  function resizeBoard() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const chromeH = vh <= 520 ? 100 : 200;
    let maxW, maxH, cap;
    if (vw >= 1100) { maxW = Math.min(vw - 560, 640); maxH = vh - 100; cap = 640; }
    else if (vw >= 600) { maxW = Math.min(vw - 24, 560); maxH = vh - chromeH; cap = 560; }
    else { maxW = vw - 16; maxH = vh - chromeH; cap = 480; }
    BOARD_PX = Math.min(maxW, maxH, cap);
    BOARD_PX = Math.max(BOARD_PX, 200);
    CELL = BOARD_PX / 8;
    if (canvasEl) { canvasEl.width = BOARD_PX; canvasEl.height = BOARD_PX; generateBoardTexture(); drawBoard(); }
  }

  function generateBoardTexture() {
    boardTextureCanvas = document.createElement('canvas');
    boardTextureCanvas.width = BOARD_PX; boardTextureCanvas.height = BOARD_PX;
    const t = boardTextureCanvas.getContext('2d');
    const style = getComputedStyle(document.documentElement);
    const light = style.getPropertyValue('--board-light').trim() || '#c8b078';
    const dark = style.getPropertyValue('--board-dark').trim() || '#6b8e4e';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      t.fillStyle = (r + c) % 2 === 0 ? light : dark;
      t.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
    const img = t.getImageData(0, 0, BOARD_PX, BOARD_PX);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
    }
    t.putImageData(img, 0, 0);
  }

  // ---- Drawing ----
  function drawPiece(px, py, color, isQueen, alpha) {
    const r = CELL * 0.38;
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.ellipse(px + 1, py + 3, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(px, py + 2, r, 0, Math.PI * 2); ctx.fillStyle = color === 'red' ? '#b91c1c' : '#1a1a1a'; ctx.fill();
    const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
    if (color === 'red') { g.addColorStop(0, '#f87171'); g.addColorStop(0.7, '#ef4444'); g.addColorStop(1, '#dc2626'); }
    else { g.addColorStop(0, '#57534e'); g.addColorStop(0.7, '#3d3530'); g.addColorStop(1, '#1c1917'); }
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = color === 'red' ? '#991b1b' : '#44403c'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, r * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = color === 'red' ? 'rgba(252,165,165,0.3)' : 'rgba(168,162,158,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(px - r * 0.15, py - r * 0.2, r * 0.3, r * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = color === 'red' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'; ctx.fill();
    if (isQueen) {
      const cw = r * 0.55, ch = r * 0.35, cy = py - ch * 0.1;
      ctx.beginPath(); ctx.moveTo(px - cw, cy + ch * 0.4); ctx.lineTo(px - cw, cy - ch * 0.3); ctx.lineTo(px - cw * 0.5, cy + ch * 0.1);
      ctx.lineTo(px, cy - ch * 0.5); ctx.lineTo(px + cw * 0.5, cy + ch * 0.1); ctx.lineTo(px + cw, cy - ch * 0.3); ctx.lineTo(px + cw, cy + ch * 0.4); ctx.closePath();
      const cg = ctx.createLinearGradient(px, cy - ch * 0.5, px, cy + ch * 0.4);
      cg.addColorStop(0, '#ffe066'); cg.addColorStop(1, '#b8860b');
      ctx.fillStyle = cg; ctx.fill(); ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 0.5; ctx.stroke();
    }
    ctx.restore();
  }

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
    for (const m of validMoves) {
      const mr = flip ? 7 - m.toRow : m.toRow, mc = flip ? 7 - m.toCol : m.toCol, cx = mc * CELL + CELL / 2, cy = mr * CELL + CELL / 2;
      if (m.captured.length > 0) {
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(233,69,96,0.45)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.12, 0, Math.PI * 2); ctx.fillStyle = 'rgba(233,69,96,0.5)'; ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.15, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,100,0.5)'; ctx.fill();
      }
    }
    for (const t of trail) drawPiece(t.x, t.y, t.color, t.queen, t.alpha);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (moveAnimState && r === moveAnimState.destRow && c === moveAnimState.destCol) continue;
      const p = game.at(r, c); if (!p) continue;
      const dr = flip ? 7 - r : r, dc = flip ? 7 - c : c;
      if (introAnim) {
        const elapsed = performance.now() - introAnim.startTime;
        const pieceDelay = (dr + dc) * 35;
        const progress = Math.max(0, Math.min(1, (elapsed - pieceDelay) / 300));
        if (progress <= 0) continue;
        const eased = 1 - Math.pow(1 - progress, 3);
        const targetY = dr * CELL + CELL / 2;
        const curY = -CELL + (targetY + CELL) * eased;
        drawPiece(dc * CELL + CELL / 2, curY, p.color, p.queen, progress);
        continue;
      }
      drawPiece(dc * CELL + CELL / 2, dr * CELL + CELL / 2, p.color, p.queen);
    }
    for (const cap of capturedOverlay) {
      const cr = flip ? 7 - cap.row : cap.row, cc = flip ? 7 - cap.col : cap.col;
      drawPiece(cc * CELL + CELL / 2, cr * CELL + CELL / 2, cap.color, cap.queen);
    }
    for (const p of shatterParticles) {
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  // ---- Animations ----
  function animateSlide(info) {
    return new Promise(resolve => {
      const fromX = (flip ? 7 - info.fromCol : info.fromCol) * CELL + CELL / 2;
      const fromY = (flip ? 7 - info.fromRow : info.fromRow) * CELL + CELL / 2;
      const toX = (flip ? 7 - info.toCol : info.toCol) * CELL + CELL / 2;
      const toY = (flip ? 7 - info.toRow : info.toRow) * CELL + CELL / 2;
      const duration = 200, start = performance.now();
      moveAnimState = { destRow: info.toRow, destCol: info.toCol };
      capturedOverlay = info.captured; trail = []; let lastT = 0;
      function tick(now) {
        const t = Math.min((now - start) / duration, 1), e = 1 - Math.pow(1 - t, 3);
        const cx = fromX + (toX - fromX) * e, cy = fromY + (toY - fromY) * e;
        if (now - lastT > 20 && t > 0.05) { trail.push({ x: cx, y: cy, color: info.pieceColor, queen: info.pieceQueen, alpha: 0.2 }); lastT = now; if (trail.length > 6) trail.shift(); }
        for (let i = 0; i < trail.length; i++) trail[i].alpha = 0.12 * (i + 1) / trail.length;
        drawBoard(); drawPiece(cx, cy, info.pieceColor, info.pieceQueen);
        if (t < 1) requestAnimationFrame(tick);
        else { moveAnimState = null; capturedOverlay = []; trail = []; resolve(); }
      }
      requestAnimationFrame(tick);
    });
  }

  function spawnShatter(px, py, color) {
    const base = color === 'red' ? [233, 69, 96] : [45, 45, 45];
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i / 14) + (Math.random() - 0.5) * 0.5;
      const speed = 80 + Math.random() * 180, size = CELL * (0.04 + Math.random() * 0.08);
      const r = Math.min(255, Math.max(0, base[0] + (Math.random() - 0.5) * 50));
      const g = Math.min(255, Math.max(0, base[1] + (Math.random() - 0.5) * 50));
      const b = Math.min(255, Math.max(0, base[2] + (Math.random() - 0.5) * 50));
      shatterParticles.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 50, size, color: `rgb(${r | 0},${g | 0},${b | 0})`, life: 1, decay: 1.5 + Math.random(), gravity: 300 + Math.random() * 150, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 12 });
    }
  }

  function animateEffects() {
    return new Promise(resolve => {
      let last = performance.now();
      function tick(now) {
        const dt = (now - last) / 1000; last = now;
        for (const p of shatterParticles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.life -= p.decay * dt; p.rotation += p.rotSpeed * dt; p.size *= 0.98; }
        shatterParticles = shatterParticles.filter(p => p.life > 0);
        drawBoard();
        if (shatterParticles.length > 0) requestAnimationFrame(tick); else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  // ---- Input (only when interactive) ----
  function onClick(e) {
    if (!interactive || !game || game.gameOver || animating || game.currentPlayer !== myColor) return;
    const rect = canvasEl.getBoundingClientRect();
    let col = Math.floor((e.clientX - rect.left) / CELL);
    let row = Math.floor((e.clientY - rect.top) / CELL);
    if (flip) { row = 7 - row; col = 7 - col; }
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

  function onMouseMove(e) {
    if (!interactive || !game || game.gameOver || animating) { if (canvasEl) canvasEl.style.cursor = 'default'; return; }
    const rect = canvasEl.getBoundingClientRect();
    let col = Math.floor((e.clientX - rect.left) / CELL);
    let row = Math.floor((e.clientY - rect.top) / CELL);
    if (col < 0 || col > 7 || row < 0 || row > 7) return;
    if (flip) { row = 7 - row; col = 7 - col; }
    const piece = game.at(row, col), isTarget = validMoves.some(m => m.toRow === row && m.toCol === col);
    canvasEl.style.cursor = (piece?.color === myColor && game.currentPlayer === myColor) || isTarget ? 'pointer' : 'default';
    const nh = (piece?.color === myColor) ? { row, col } : null;
    if (hoveredCell?.row !== nh?.row || hoveredCell?.col !== nh?.col) { hoveredCell = nh; if (!animating) drawBoard(); }
  }
</script>

<div class="board-wrap">
  <canvas bind:this={canvasEl} width="480" height="480"
    on:click={onClick} on:mousemove={onMouseMove}
    on:mouseleave={() => { hoveredCell = null; if (canvasEl) canvasEl.style.cursor = 'default'; if (!animating) drawBoard(); }}></canvas>
  <slot />
</div>

<style>
  .board-wrap { position: relative; touch-action: none; }
  canvas {
    display: block; border-radius: var(--radius-sm); cursor: pointer; box-shadow: var(--shadow-board);
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    touch-action: none;
  }
</style>
