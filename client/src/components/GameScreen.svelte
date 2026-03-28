<script>
  import { onMount, onDestroy } from 'svelte';
  import { screen, gameState } from '../stores/app.js';
  import { user } from '../stores/user.js';
  import { getSocket } from '../lib/socket.js';
  import { CheckersGame, ColonelBot } from '../../../shared/game.js';
  import { TURN_TIME } from '../../../shared/constants.js';

  let canvasEl;
  let ctx;
  let CELL = 60, BOARD_PX = 480;

  // Game state
  let game = new CheckersGame();
  let myColor = $gameState?.myColor || 'red';
  let mode = $gameState?.mode || 'online';
  let opponentName = $gameState?.opponentName || 'Opponent';
  let selectedPiece = null;
  let validMoves = [];
  let lastMove = null;
  let hoveredCell = null;
  let animating = false;
  let botThinking = false;
  let gameOverData = null;
  let showResignConfirm = false;

  // Tracking
  let capturedPieces = { red: [], black: [] };
  let moveLog = [];
  let moveNumber = 0;

  // Chat
  let chatMessages = [];
  let chatInput = '';
  let showChat = false;

  // Animation state
  let moveAnimState = null;
  let shatterParticles = [];
  let capturedOverlay = [];
  let trail = [];
  let boardTextureCanvas = null;

  const bot = new ColonelBot();
  let timerInterval = null;
  let socket = null;

  onMount(() => {
    ctx = canvasEl.getContext('2d');
    resizeBoard();
    window.addEventListener('resize', resizeBoard);

    if (mode === 'online') {
      socket = getSocket();
      socket.on('game:moved', onServerMove);
      socket.on('game:tick', onTick);
      socket.on('game:over', onGameOver);
      socket.on('game:opponent-disconnected', () => { /* show status */ });
      socket.on('chat:game-message', onChatMessage);
    }

    if (mode === 'bot') {
      startTimer();
      if (myColor === 'black') {
        setTimeout(() => botTurn(), 600);
      }
    }

    drawBoard();
  });

  onDestroy(() => {
    window.removeEventListener('resize', resizeBoard);
    clearInterval(timerInterval);
    if (socket) {
      socket.off('game:moved', onServerMove);
      socket.off('game:tick', onTick);
      socket.off('game:over', onGameOver);
      socket.off('chat:game-message', onChatMessage);
    }
  });

  function resizeBoard() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let maxW, maxH, cap;
    if (vw >= 1100) { maxW = Math.min(vw - 560, 640); maxH = vh - 100; cap = 640; }
    else if (vw >= 600) { maxW = Math.min(vw - 24, 560); maxH = vh - 200; cap = 560; }
    else { maxW = vw - 16; maxH = vh - (vh <= 520 ? 120 : 190); cap = 480; }
    BOARD_PX = Math.min(maxW, maxH, cap);
    BOARD_PX = Math.max(BOARD_PX, 200);
    CELL = BOARD_PX / 8;
    if (canvasEl) {
      canvasEl.width = BOARD_PX;
      canvasEl.height = BOARD_PX;
      generateBoardTexture();
      drawBoard();
    }
  }

  function generateBoardTexture() {
    boardTextureCanvas = document.createElement('canvas');
    boardTextureCanvas.width = BOARD_PX;
    boardTextureCanvas.height = BOARD_PX;
    const tctx = boardTextureCanvas.getContext('2d');
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        tctx.fillStyle = (r + c) % 2 === 0 ? '#c8b078' : '#6b8e4e';
        tctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    const imgData = tctx.getImageData(0, 0, BOARD_PX, BOARD_PX);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + n));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + n));
    }
    tctx.putImageData(imgData, 0, 0);
  }

  // ---- Drawing (ported from prototype) ----
  function drawPiece(px, py, color, isQueen, alpha) {
    const radius = CELL * 0.38;
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(px + 1, py + 3, radius, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(px, py + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = color === 'red' ? '#b8334a' : '#1a1a1a'; ctx.fill();
    const grad = ctx.createRadialGradient(px - radius*0.3, py - radius*0.3, radius*0.1, px, py, radius);
    if (color === 'red') { grad.addColorStop(0,'#ff6b7f'); grad.addColorStop(0.7,'#e94560'); grad.addColorStop(1,'#c73a52'); }
    else { grad.addColorStop(0,'#4a4a4a'); grad.addColorStop(0.7,'#2d2d2d'); grad.addColorStop(1,'#1a1a1a'); }
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = color === 'red' ? '#a02040' : '#444'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, radius * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = color === 'red' ? 'rgba(255,180,190,0.35)' : 'rgba(150,150,150,0.25)';
    ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(px - radius*0.15, py - radius*0.2, radius*0.3, radius*0.15, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = color === 'red' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'; ctx.fill();
    if (isQueen) {
      const cw = radius*0.55, ch = radius*0.35, cy = py - ch*0.1;
      ctx.beginPath();
      ctx.moveTo(px-cw, cy+ch*0.4); ctx.lineTo(px-cw, cy-ch*0.3); ctx.lineTo(px-cw*0.5, cy+ch*0.1);
      ctx.lineTo(px, cy-ch*0.5); ctx.lineTo(px+cw*0.5, cy+ch*0.1); ctx.lineTo(px+cw, cy-ch*0.3);
      ctx.lineTo(px+cw, cy+ch*0.4); ctx.closePath();
      const cg = ctx.createLinearGradient(px, cy-ch*0.5, px, cy+ch*0.4);
      cg.addColorStop(0,'#ffe066'); cg.addColorStop(1,'#b8860b');
      ctx.fillStyle = cg; ctx.fill(); ctx.strokeStyle='#8B6914'; ctx.lineWidth=0.5; ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoard() {
    if (!ctx) return;
    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);
    const flip = myColor === 'black';
    if (boardTextureCanvas) {
      if (flip) { ctx.save(); ctx.translate(BOARD_PX,BOARD_PX); ctx.rotate(Math.PI); ctx.drawImage(boardTextureCanvas,0,0); ctx.restore(); }
      else ctx.drawImage(boardTextureCanvas, 0, 0);
    }
    if (lastMove) {
      ctx.fillStyle = 'rgba(100,180,255,0.22)';
      const fr = flip?7-lastMove.fromRow:lastMove.fromRow, fc = flip?7-lastMove.fromCol:lastMove.fromCol;
      const tr = flip?7-lastMove.toRow:lastMove.toRow, tc = flip?7-lastMove.toCol:lastMove.toCol;
      ctx.fillRect(fc*CELL,fr*CELL,CELL,CELL); ctx.fillRect(tc*CELL,tr*CELL,CELL,CELL);
    }
    if (selectedPiece) {
      const sr = flip?7-selectedPiece.row:selectedPiece.row, sc = flip?7-selectedPiece.col:selectedPiece.col;
      ctx.fillStyle = 'rgba(255,255,100,0.45)'; ctx.fillRect(sc*CELL,sr*CELL,CELL,CELL);
    }
    if (hoveredCell && !selectedPiece && !animating && !game.gameOver) {
      const p = game.at(hoveredCell.row, hoveredCell.col);
      if (p && p.color === myColor && game.currentPlayer === myColor) {
        const hr = flip?7-hoveredCell.row:hoveredCell.row, hc = flip?7-hoveredCell.col:hoveredCell.col;
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(hc*CELL,hr*CELL,CELL,CELL);
      }
    }
    for (const m of validMoves) {
      const mr = flip?7-m.toRow:m.toRow, mc = flip?7-m.toCol:m.toCol;
      const cx = mc*CELL+CELL/2, cy = mr*CELL+CELL/2;
      if (m.captured.length > 0) {
        ctx.beginPath(); ctx.arc(cx,cy,CELL*0.35,0,Math.PI*2);
        ctx.strokeStyle='rgba(233,69,96,0.45)'; ctx.lineWidth=2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx,cy,CELL*0.12,0,Math.PI*2);
        ctx.fillStyle='rgba(233,69,96,0.5)'; ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(cx,cy,CELL*0.15,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,100,0.5)'; ctx.fill();
      }
    }
    for (const t of trail) drawPiece(t.x, t.y, t.color, t.queen, t.alpha);
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      if (moveAnimState && r===moveAnimState.destRow && c===moveAnimState.destCol) continue;
      const p = game.at(r,c); if (!p) continue;
      const dr = flip?7-r:r, dc = flip?7-c:c;
      drawPiece(dc*CELL+CELL/2, dr*CELL+CELL/2, p.color, p.queen);
    }
    for (const cap of capturedOverlay) {
      const cr = flip?7-cap.row:cap.row, cc = flip?7-cap.col:cap.col;
      drawPiece(cc*CELL+CELL/2, cr*CELL+CELL/2, cap.color, cap.queen);
    }
    for (const p of shatterParticles) {
      ctx.save(); ctx.globalAlpha=Math.max(0,p.life);
      ctx.translate(p.x,p.y); ctx.rotate(p.rotation);
      ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
      ctx.restore();
    }
  }

  // ---- Animation ----
  function gatherAnimInfo(fr,fc,tr,tc) {
    const piece = game.at(fr,fc);
    const moves = game.getValidMovesFor(fr,fc);
    const move = moves.find(m => m.toRow===tr && m.toCol===tc);
    if (!piece || !move) return null;
    return { fromRow:fr,fromCol:fc,toRow:tr,toCol:tc, pieceColor:piece.color, pieceQueen:piece.queen,
      captured: move.captured.map(cap => { const cp=game.at(cap.row,cap.col); return{row:cap.row,col:cap.col,color:cp.color,queen:cp.queen}; })
    };
  }

  function animateSlide(info) {
    return new Promise(resolve => {
      const flip = myColor==='black';
      const fromX=(flip?7-info.fromCol:info.fromCol)*CELL+CELL/2;
      const fromY=(flip?7-info.fromRow:info.fromRow)*CELL+CELL/2;
      const toX=(flip?7-info.toCol:info.toCol)*CELL+CELL/2;
      const toY=(flip?7-info.toRow:info.toRow)*CELL+CELL/2;
      const duration=200, startTime=performance.now();
      moveAnimState={destRow:info.toRow,destCol:info.toCol};
      capturedOverlay=info.captured; trail=[]; let lastTrailTime=0;
      function tick(now) {
        const t=Math.min((now-startTime)/duration,1), eased=1-Math.pow(1-t,3);
        const curX=fromX+(toX-fromX)*eased, curY=fromY+(toY-fromY)*eased;
        if (now-lastTrailTime>20&&t>0.05) {
          trail.push({x:curX,y:curY,color:info.pieceColor,queen:info.pieceQueen,alpha:0.2});
          lastTrailTime=now; if(trail.length>6) trail.shift();
        }
        for(let i=0;i<trail.length;i++) trail[i].alpha=0.12*(i+1)/trail.length;
        drawBoard(); drawPiece(curX,curY,info.pieceColor,info.pieceQueen);
        if(t<1) requestAnimationFrame(tick);
        else { moveAnimState=null; capturedOverlay=[]; trail=[]; resolve(); }
      }
      requestAnimationFrame(tick);
    });
  }

  function spawnShatter(px,py,color) {
    const base = color==='red'?[233,69,96]:[45,45,45];
    for(let i=0;i<14;i++) {
      const angle=(Math.PI*2*i/14)+(Math.random()-0.5)*0.5;
      const speed=80+Math.random()*180, size=CELL*(0.04+Math.random()*0.08);
      const r=Math.min(255,Math.max(0,base[0]+(Math.random()-0.5)*50));
      const g=Math.min(255,Math.max(0,base[1]+(Math.random()-0.5)*50));
      const b=Math.min(255,Math.max(0,base[2]+(Math.random()-0.5)*50));
      shatterParticles.push({x:px,y:py,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-50,
        size,color:`rgb(${r|0},${g|0},${b|0})`,life:1,decay:1.5+Math.random(),gravity:300+Math.random()*150,
        rotation:Math.random()*Math.PI*2,rotSpeed:(Math.random()-0.5)*12});
    }
  }

  function animateEffects() {
    return new Promise(resolve => {
      let lastTime=performance.now();
      function tick(now) {
        const dt=(now-lastTime)/1000; lastTime=now;
        for(const p of shatterParticles) { p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.gravity*dt; p.life-=p.decay*dt; p.rotation+=p.rotSpeed*dt; p.size*=0.98; }
        shatterParticles=shatterParticles.filter(p=>p.life>0);
        drawBoard();
        if(shatterParticles.length>0) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  async function performAnimatedMove(fr,fc,tr,tc) {
    const info = gatherAnimInfo(fr,fc,tr,tc);
    const result = game.makeMove(fr,fc,tr,tc);
    if (!result) return null;
    lastMove = {fromRow:fr,fromCol:fc,toRow:tr,toCol:tc};
    if (info?.captured.length > 0) {
      for (const cap of info.captured) capturedPieces[info.pieceColor].push({color:cap.color,queen:cap.queen});
      capturedPieces = capturedPieces;
    }
    moveLog = [...moveLog, { num: ++moveNumber, color: info?.pieceColor, from: `${'abcdefgh'[fc]}${8-fr}`, to: `${'abcdefgh'[tc]}${8-tr}`, capture: result.captured.length > 0 }];
    if (info) {
      animating = true;
      await animateSlide(info);
      if (info.captured.length > 0) {
        const flip = myColor==='black';
        for (const cap of info.captured) {
          const cr=flip?7-cap.row:cap.row, cc=flip?7-cap.col:cap.col;
          spawnShatter(cc*CELL+CELL/2, cr*CELL+CELL/2, cap.color);
        }
      }
      if (shatterParticles.length > 0) await animateEffects();
      animating = false;
    }
    return result;
  }

  // ---- Input ----
  function onClick(e) {
    if (game.gameOver || botThinking || animating) return;
    if (game.currentPlayer !== myColor) return;
    const rect = canvasEl.getBoundingClientRect();
    const flip = myColor==='black';
    let col = Math.floor((e.clientX-rect.left)/CELL);
    let row = Math.floor((e.clientY-rect.top)/CELL);
    if (flip) { row=7-row; col=7-col; }
    const moveTarget = validMoves.find(m => m.toRow===row && m.toCol===col);
    if (moveTarget && selectedPiece) { executeMove(selectedPiece.row, selectedPiece.col, row, col); return; }
    const piece = game.at(row, col);
    if (piece && piece.color === myColor) {
      const moves = game.getValidMovesFor(row, col);
      if (moves.length > 0) { selectedPiece = {row,col}; validMoves = moves; }
      else { selectedPiece = null; validMoves = []; }
    } else { selectedPiece = null; validMoves = []; }
    drawBoard();
  }

  function onMouseMove(e) {
    if (game.gameOver || animating || botThinking) { canvasEl.style.cursor='default'; return; }
    const rect = canvasEl.getBoundingClientRect();
    const flip = myColor==='black';
    let col = Math.floor((e.clientX-rect.left)/CELL);
    let row = Math.floor((e.clientY-rect.top)/CELL);
    if (col<0||col>7||row<0||row>7) return;
    if (flip) { row=7-row; col=7-col; }
    const piece = game.at(row, col);
    const isTarget = validMoves.some(m => m.toRow===row && m.toCol===col);
    canvasEl.style.cursor = (piece?.color===myColor && game.currentPlayer===myColor) || isTarget ? 'pointer' : 'default';
    const newH = (piece?.color===myColor) ? {row,col} : null;
    if (hoveredCell?.row !== newH?.row || hoveredCell?.col !== newH?.col) { hoveredCell = newH; if (!animating) drawBoard(); }
  }

  // ---- Move execution ----
  async function executeMove(fr, fc, tr, tc) {
    if (mode === 'online') {
      socket.emit('game:move', { gameId: $gameState.gameId, fromRow: fr, fromCol: fc, toRow: tr, toCol: tc });
    }
    const result = await performAnimatedMove(fr, fc, tr, tc);
    if (!result) return;
    if (result.chainContinues) { selectedPiece = {row:tr,col:tc}; validMoves = game.getValidMovesFor(tr,tc); }
    else { selectedPiece = null; validMoves = []; }
    drawBoard();
    if (game.gameOver) { handleGameOver(); return; }
    if (mode === 'bot' && game.currentPlayer !== myColor) botTurn();
  }

  // ---- Server events ----
  async function onServerMove(data) {
    if (data.fromRow === undefined) return;
    // Only animate opponent moves (we already animated our own)
    const isMyMove = game.currentPlayer === myColor;
    if (!isMyMove) {
      // Opponent's move — apply from server state
      const result = await performAnimatedMove(data.fromRow, data.fromCol, data.toRow, data.toCol);
      if (result) { selectedPiece = null; validMoves = []; drawBoard(); }
    }
    // Sync timer from server
    game.redTime = data.redTime;
    game.blackTime = data.blackTime;
  }

  function onTick(data) {
    game.redTime = data.redTime;
    game.blackTime = data.blackTime;
  }

  function onGameOver(data) {
    game.gameOver = true;
    game.winner = data.winner;
    gameOverData = data;
  }

  // ---- Bot ----
  function botTurn() {
    botThinking = true;
    setTimeout(async () => {
      const move = bot.chooseMove(game);
      if (!move) { botThinking = false; return; }
      const result = await performAnimatedMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      if (!result) { botThinking = false; return; }
      selectedPiece = null; validMoves = []; drawBoard();
      if (game.gameOver) { botThinking = false; handleGameOver(); return; }
      if (result.chainContinues) { setTimeout(() => botTurn(), 300); }
      else { botThinking = false; }
    }, 400 + Math.random() * 600);
  }

  // ---- Timer (bot mode only, online uses server ticks) ----
  function startTimer() {
    timerInterval = setInterval(() => {
      if (game.gameOver) { clearInterval(timerInterval); return; }
      game.tickTime(1);
      game = game; // trigger reactivity
      if (game.gameOver) handleGameOver();
    }, 1000);
  }

  function handleGameOver() {
    clearInterval(timerInterval);
    if (!gameOverData) gameOverData = { winner: game.winner, eloChanges: {red:0,black:0}, coinRewards: {red:0,black:0} };
  }

  function resign() {
    showResignConfirm = false;
    game.gameOver = true;
    game.winner = myColor === 'red' ? 'black' : 'red';
    if (mode === 'online') socket.emit('game:resign', { gameId: $gameState.gameId });
    handleGameOver();
  }

  function goToLobby() {
    gameOverData = null;
    $gameState = null;
    $screen = 'lobby';
  }

  // ---- Chat ----
  function onChatMessage(msg) { chatMessages = [...chatMessages, msg]; }
  function sendChat() {
    if (!chatInput.trim()) return;
    socket?.emit('chat:game-message', { gameId: $gameState?.gameId, content: chatInput.trim() });
    chatInput = '';
  }

  // ---- Derived ----
  $: isMyTurn = game.currentPlayer === myColor && !game.gameOver;
  $: topColor = myColor === 'red' ? 'black' : 'red';
  $: topTime = topColor === 'red' ? game.redTime : game.blackTime;
  $: bottomTime = myColor === 'red' ? game.redTime : game.blackTime;
  $: statusText = game.gameOver ? (game.winner === myColor ? 'Victory!' : 'Defeat') : isMyTurn ? 'Your turn' : (mode === 'bot' ? 'The Colonel is thinking...' : "Opponent's turn");

  function fmtTime(s) { const sec = Math.ceil(s); return `0:${sec.toString().padStart(2, '0')}`; }
</script>

<div class="game-screen">
  <div class="game-header">
    <div class="player-info-wrap">
      <div class="player-info" class:active-turn={game.currentPlayer === topColor}>
        <div class="dot {topColor}"></div>
        <span class="pname">{myColor === 'red' ? opponentName : $user?.username}</span>
        <span class="timer" class:low={topTime <= 15} class:critical={topTime <= 7}>{fmtTime(topTime)}</span>
      </div>
      <div class="timer-bar-track"><div class="timer-bar-fill" class:low={topTime<=15} class:critical={topTime<=7} style="width:{topTime/TURN_TIME*100}%"></div></div>
      <div class="captured-tray">
        {#each capturedPieces[topColor] || [] as cap}
          <div class="cap-piece {cap.color}"></div>
        {/each}
      </div>
    </div>
    <span class="vs-label">VS</span>
    <div class="player-info-wrap">
      <div class="player-info" class:active-turn={game.currentPlayer === myColor}>
        <div class="dot {myColor}"></div>
        <span class="pname">{myColor === 'red' ? $user?.username : opponentName}</span>
        <span class="timer" class:low={bottomTime <= 15} class:critical={bottomTime <= 7}>{fmtTime(bottomTime)}</span>
      </div>
      <div class="timer-bar-track"><div class="timer-bar-fill" class:low={bottomTime<=15} class:critical={bottomTime<=7} style="width:{bottomTime/TURN_TIME*100}%"></div></div>
      <div class="captured-tray">
        {#each capturedPieces[myColor] || [] as cap}
          <div class="cap-piece {cap.color}"></div>
        {/each}
      </div>
    </div>
  </div>

  <div class="board-container">
    <canvas bind:this={canvasEl} width="480" height="480"
      on:click={onClick} on:mousemove={onMouseMove}
      on:mouseleave={() => { hoveredCell=null; canvasEl.style.cursor='default'; if(!animating) drawBoard(); }}
    ></canvas>

    {#if gameOverData}
      <div class="game-over-overlay">
        <h2 style="color:{game.winner === myColor ? '#4caf50' : '#e94560'}">{game.winner === myColor ? 'Victory!' : 'Defeat'}</h2>
        {#if gameOverData.eloChanges}
          <p class="elo-change">ELO: {gameOverData.eloChanges[myColor] >= 0 ? '+' : ''}{gameOverData.eloChanges[myColor]}</p>
        {/if}
        {#if gameOverData.coinRewards?.[myColor]}
          <p class="coin-reward">+{gameOverData.coinRewards[myColor]} coins</p>
        {/if}
        <div class="lobby-row">
          <button class="btn btn-primary btn-small" on:click={goToLobby}>Lobby</button>
        </div>
      </div>
    {/if}
  </div>

  <div class="status-bar">{statusText}</div>

  <div class="move-history">
    {#each moveLog.slice(-10) as m}
      <div class="move-entry">
        <span class="move-dot {m.color}"></span>
        <span class="move-text">{m.from}{m.capture ? '\u00d7' : '\u2192'}{m.to}</span>
      </div>
    {/each}
  </div>

  <div class="game-actions">
    <button class="btn btn-dark btn-small" on:click={() => showResignConfirm = true}>Resign</button>
    {#if mode === 'online'}
      <button class="btn btn-dark btn-small" on:click={() => showChat = !showChat}>
        Chat {chatMessages.length > 0 ? `(${chatMessages.length})` : ''}
      </button>
    {/if}
  </div>

  {#if showResignConfirm}
    <div class="confirm-overlay">
      <div class="confirm-box">
        <p>Are you sure you want to resign?</p>
        <div class="lobby-row">
          <button class="btn btn-primary btn-small" on:click={resign}>Resign</button>
          <button class="btn btn-dark btn-small" on:click={() => showResignConfirm = false}>Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showChat}
    <div class="chat-panel">
      <div class="chat-messages">
        {#each chatMessages as msg}
          <div class="chat-msg">
            <strong>{msg.username}:</strong> {msg.content}
          </div>
        {/each}
      </div>
      <div class="chat-input-row">
        <input type="text" bind:value={chatInput} placeholder="Message..." maxlength="200"
          on:keydown={(e) => e.key === 'Enter' && sendChat()} />
        <button class="btn btn-primary btn-small" on:click={sendChat}>Send</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .game-screen {
    display: flex; flex-direction: column; align-items: center;
    gap: 5px; padding: 8px; width: 100%;
  }
  .game-header { display: flex; align-items: flex-start; justify-content: space-between; width: 100%; max-width: 520px; gap: 8px; }
  .player-info-wrap { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .player-info {
    display: flex; align-items: center; gap: 6px; padding: 6px 10px;
    border-radius: 8px; background: var(--surface); transition: outline-color 0.3s, box-shadow 0.3s;
  }
  .player-info.active-turn { outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 12px rgba(233,69,96,0.2); }
  .dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
  .dot.red { background: var(--red-piece); }
  .dot.black { background: var(--black-piece); border: 2px solid #555; }
  .pname { font-weight: 600; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .timer { font-family: 'Courier New', monospace; font-size: 0.8rem; color: var(--text-dim); margin-left: auto; flex-shrink: 0; }
  .timer.low { color: #ff9800; font-weight: 700; }
  .timer.critical { color: var(--accent); animation: pulse 0.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .vs-label { font-size: 0.75rem; color: var(--text-dim); font-weight: 700; margin-top: 10px; flex-shrink: 0; }
  .timer-bar-track { height: 3px; background: var(--surface2); border-radius: 2px; overflow: hidden; margin-top: 3px; }
  .timer-bar-fill { height: 100%; background: var(--accent2); border-radius: 2px; transition: width 1s linear; }
  .timer-bar-fill.low { background: #ff9800; }
  .timer-bar-fill.critical { background: var(--accent); }
  .captured-tray { display: flex; gap: 2px; min-height: 16px; padding: 2px; flex-wrap: wrap; }
  .cap-piece { width: 12px; height: 12px; border-radius: 50%; }
  .cap-piece.red { background: var(--red-piece); }
  .cap-piece.black { background: var(--black-piece); border: 1px solid #555; }

  .board-container { position: relative; touch-action: none; }
  canvas { display: block; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 30px rgba(0,0,0,0.4); }

  .game-over-overlay {
    position: absolute; inset: 0; background: rgba(0,0,0,0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; border-radius: 6px; z-index: 10; backdrop-filter: blur(4px);
  }
  .game-over-overlay h2 { font-size: 1.8rem; }
  .elo-change { font-size: 1rem; color: var(--text-dim); }
  .coin-reward { font-size: 0.9rem; color: #ffd700; }

  .status-bar { font-size: 0.8rem; color: var(--text-dim); height: 18px; }

  .move-history { display: flex; gap: 4px; overflow-x: auto; max-width: 520px; width: 100%; scrollbar-width: none; min-height: 20px; }
  .move-history::-webkit-scrollbar { display: none; }
  .move-entry { display: flex; align-items: center; gap: 4px; padding: 2px 7px; background: var(--surface); border-radius: 10px; font-size: 0.7rem; white-space: nowrap; flex-shrink: 0; }
  .move-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .move-dot.red { background: var(--red-piece); }
  .move-dot.black { background: var(--black-piece); border: 1px solid #555; }
  .move-text { color: var(--text-dim); font-family: 'Courier New', monospace; }

  .game-actions { display: flex; gap: 8px; }

  .confirm-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center; z-index: 20;
  }
  .confirm-box { background: var(--surface); border-radius: 12px; padding: 24px 28px; text-align: center; display: flex; flex-direction: column; gap: 16px; }
  .lobby-row { display: flex; gap: 12px; justify-content: center; }

  .chat-panel {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: var(--surface); border-top: 2px solid var(--surface2);
    max-height: 200px; display: flex; flex-direction: column; z-index: 15;
  }
  .chat-messages { flex: 1; overflow-y: auto; padding: 8px 12px; font-size: 0.8rem; }
  .chat-msg { margin-bottom: 4px; }
  .chat-msg strong { color: var(--accent); }
  .chat-input-row { display: flex; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--surface2); }
  .chat-input-row input {
    flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--surface2);
    background: var(--bg); color: var(--text); font-size: 0.85rem; outline: none;
  }
</style>
