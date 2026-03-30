<script>
  import { onMount, onDestroy } from 'svelte';
  import { screen, gameState, roomUnreadChat, roomChatMessages } from '../stores/app.js';
  import { user } from '../stores/user.js';
  import { getSocket } from '../lib/socket.js';
  import { api } from '../lib/api.js';
  import RoomChat from './chat/RoomChat.svelte';
  import { setActiveChannel } from '../lib/socketService.js';
  import { CheckersGame, ColonelBot } from '../../../shared/game.js';
  import { TURN_TIME } from '../../../shared/constants.js';

  let canvasEl;
  let ctx;
  let CELL = 60, BOARD_PX = 480;

  let game = new CheckersGame();
  let myColor = $gameState?.myColor || 'red';
  let mode = $gameState?.mode || 'online';
  let opponentName = $gameState?.opponentName || 'Opponent';
  let selectedPiece = null;
  let validMoves = [];

  // Restore state on reconnect
  if ($gameState?.reconnectState) {
    const rs = $gameState.reconnectState;
    game.board = rs.board;
    game.currentPlayer = rs.currentPlayer;
    game.redTime = rs.redTime;
    game.blackTime = rs.blackTime;
    game.chainPiece = rs.chainPiece;
    game.gameOver = rs.gameOver;
    game.winner = rs.winner;
    game.moveHistory = rs.moveHistory || [];
  }
  let lastMove = null;
  let hoveredCell = null;
  let animating = false;
  let botThinking = false;
  let gameOverData = null;
  let showResignConfirm = false;
  let opponentDisconnected = false;

  let capturedPieces = { red: [], black: [] };
  let moveLog = [];
  let moveNumber = 0;


  let ownedEmotes = [];
  let activeEmote = null;
  let showEmoteBar = false;
  let showChat = false;
  let desktopChat = window.innerWidth >= 1100;
  let emoteTimeout = null;

  let moveAnimState = null;
  let shatterParticles = [];
  let capturedOverlay = [];
  let trail = [];
  let boardTextureCanvas = null;
  let introAnim = null;
  let lastMoveCaptured = []; // [{row, col}] positions where captures happened

  const bot = new ColonelBot();
  let timerInterval = null;
  let socket = null;

  onMount(() => {
    ctx = canvasEl.getContext('2d');
    resizeBoard();
    window.addEventListener('resize', resizeBoard);

    if (mode === 'online') {
      socket = getSocket();
      if ($gameState?.gameId) setActiveChannel(`game:${$gameState.gameId}`);
      socket.on('game:moved', onServerMove);
      socket.on('game:tick', onTick);
      socket.on('game:over', onGameOver);
      socket.on('game:opponent-disconnected', () => { opponentDisconnected = true; });
      socket.on('game:opponent-reconnected', () => { opponentDisconnected = false; });
      socket.on('emote:show', onEmoteShow);

      api.get('/shop/inventory').then(({ inventory }) => {
        ownedEmotes = inventory.filter(i => i.item.type === 'EMOTE').map(i => i.item);
      }).catch(() => {});
    }

    if (mode === 'bot') {
      startTimer();
      if (myColor === 'black') setTimeout(() => botTurn(), 1100);
    }

    // Play intro animation unless reconnecting
    if (!$gameState?.reconnectState) {
      playIntroAnimation();
    } else {
      drawBoard();
    }

    // Also listen for zoom changes
    window.visualViewport?.addEventListener('resize', resizeBoard);
  });

  onDestroy(() => {
    window.removeEventListener('resize', resizeBoard);
    window.visualViewport?.removeEventListener('resize', resizeBoard);
    clearInterval(timerInterval);
    clearTimeout(emoteTimeout);
    if (socket) {
      socket.off('game:moved', onServerMove);
      socket.off('game:tick', onTick);
      socket.off('game:over', onGameOver);
      socket.off('game:opponent-disconnected');
      socket.off('game:opponent-reconnected');
      socket.off('emote:show', onEmoteShow);
    }
  });

  // ---- Board sizing ----
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
      d[i] = Math.min(255, Math.max(0, d[i]+n));
      d[i+1] = Math.min(255, Math.max(0, d[i+1]+n));
      d[i+2] = Math.min(255, Math.max(0, d[i+2]+n));
    }
    t.putImageData(img, 0, 0);
  }

  // ---- Drawing ----
  function drawPiece(px, py, color, isQueen, alpha) {
    const r = CELL * 0.38;
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.ellipse(px+1,py+3,r,r*0.7,0,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(px,py+2,r,0,Math.PI*2); ctx.fillStyle=color==='red'?'#b91c1c':'#1a1a1a'; ctx.fill();
    const g = ctx.createRadialGradient(px-r*0.3,py-r*0.3,r*0.1,px,py,r);
    if (color==='red'){g.addColorStop(0,'#f87171');g.addColorStop(0.7,'#ef4444');g.addColorStop(1,'#dc2626');}
    else{g.addColorStop(0,'#57534e');g.addColorStop(0.7,'#3d3530');g.addColorStop(1,'#1c1917');}
    ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=color==='red'?'#991b1b':'#44403c'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(px,py,r*0.65,0,Math.PI*2);
    ctx.strokeStyle=color==='red'?'rgba(252,165,165,0.3)':'rgba(168,162,158,0.2)'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(px-r*0.15,py-r*0.2,r*0.3,r*0.15,-0.3,0,Math.PI*2);
    ctx.fillStyle=color==='red'?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.08)'; ctx.fill();
    if (isQueen) {
      const cw=r*0.55,ch=r*0.35,cy=py-ch*0.1;
      ctx.beginPath(); ctx.moveTo(px-cw,cy+ch*0.4); ctx.lineTo(px-cw,cy-ch*0.3); ctx.lineTo(px-cw*0.5,cy+ch*0.1);
      ctx.lineTo(px,cy-ch*0.5); ctx.lineTo(px+cw*0.5,cy+ch*0.1); ctx.lineTo(px+cw,cy-ch*0.3); ctx.lineTo(px+cw,cy+ch*0.4); ctx.closePath();
      const cg=ctx.createLinearGradient(px,cy-ch*0.5,px,cy+ch*0.4);
      cg.addColorStop(0,'#ffe066'); cg.addColorStop(1,'#b8860b');
      ctx.fillStyle=cg; ctx.fill(); ctx.strokeStyle='#8B6914'; ctx.lineWidth=0.5; ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoard() {
    if (!ctx) return;
    ctx.clearRect(0,0,BOARD_PX,BOARD_PX);
    const flip = myColor==='black';
    if (boardTextureCanvas) { if(flip){ctx.save();ctx.translate(BOARD_PX,BOARD_PX);ctx.rotate(Math.PI);ctx.drawImage(boardTextureCanvas,0,0);ctx.restore();}else ctx.drawImage(boardTextureCanvas,0,0); }
    if (lastMove) {
      ctx.fillStyle='rgba(100,180,255,0.22)';
      const fr=flip?7-lastMove.fromRow:lastMove.fromRow,fc=flip?7-lastMove.fromCol:lastMove.fromCol;
      const tr=flip?7-lastMove.toRow:lastMove.toRow,tc=flip?7-lastMove.toCol:lastMove.toCol;
      ctx.fillRect(fc*CELL,fr*CELL,CELL,CELL); ctx.fillRect(tc*CELL,tr*CELL,CELL,CELL);
      // Highlight captured squares in red tint
      ctx.fillStyle='rgba(239,68,68,0.25)';
      for (const cap of lastMoveCaptured) {
        const cr=flip?7-cap.row:cap.row, cc=flip?7-cap.col:cap.col;
        ctx.fillRect(cc*CELL,cr*CELL,CELL,CELL);
      }
    }
    if (selectedPiece) { const sr=flip?7-selectedPiece.row:selectedPiece.row,sc=flip?7-selectedPiece.col:selectedPiece.col; ctx.fillStyle='rgba(255,255,100,0.45)'; ctx.fillRect(sc*CELL,sr*CELL,CELL,CELL); }
    if (hoveredCell&&!selectedPiece&&!animating&&!game.gameOver) { const p=game.at(hoveredCell.row,hoveredCell.col); if(p&&p.color===myColor&&game.currentPlayer===myColor){const hr=flip?7-hoveredCell.row:hoveredCell.row,hc=flip?7-hoveredCell.col:hoveredCell.col;ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(hc*CELL,hr*CELL,CELL,CELL);} }
    for (const m of validMoves) { const mr=flip?7-m.toRow:m.toRow,mc=flip?7-m.toCol:m.toCol,cx=mc*CELL+CELL/2,cy=mr*CELL+CELL/2; if(m.captured.length>0){ctx.beginPath();ctx.arc(cx,cy,CELL*0.35,0,Math.PI*2);ctx.strokeStyle='rgba(233,69,96,0.45)';ctx.lineWidth=2.5;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,CELL*0.12,0,Math.PI*2);ctx.fillStyle='rgba(233,69,96,0.5)';ctx.fill();}else{ctx.beginPath();ctx.arc(cx,cy,CELL*0.15,0,Math.PI*2);ctx.fillStyle='rgba(255,255,100,0.5)';ctx.fill();} }
    for (const t of trail) drawPiece(t.x,t.y,t.color,t.queen,t.alpha);
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      if(moveAnimState&&r===moveAnimState.destRow&&c===moveAnimState.destCol) continue;
      const p=game.at(r,c); if(!p) continue;
      const dr=flip?7-r:r,dc=flip?7-c:c;
      if (introAnim) {
        const elapsed = performance.now() - introAnim.startTime;
        const pieceDelay = (dr + dc) * 35;
        const progress = Math.max(0, Math.min(1, (elapsed - pieceDelay) / 300));
        if (progress <= 0) continue;
        const eased = 1 - Math.pow(1 - progress, 3);
        const targetY = dr*CELL+CELL/2;
        const curY = -CELL + (targetY + CELL) * eased;
        drawPiece(dc*CELL+CELL/2, curY, p.color, p.queen, progress);
        continue;
      }
      drawPiece(dc*CELL+CELL/2,dr*CELL+CELL/2,p.color,p.queen);
    }
    for (const cap of capturedOverlay) { const cr=flip?7-cap.row:cap.row,cc=flip?7-cap.col:cap.col; drawPiece(cc*CELL+CELL/2,cr*CELL+CELL/2,cap.color,cap.queen); }
    for (const p of shatterParticles) { ctx.save();ctx.globalAlpha=Math.max(0,p.life);ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);ctx.restore(); }
  }

  function playIntroAnimation() {
    introAnim = { startTime: performance.now() };
    animating = true;
    function tick() {
      const elapsed = performance.now() - introAnim.startTime;
      drawBoard();
      if (elapsed < 950) requestAnimationFrame(tick);
      else { introAnim = null; animating = false; drawBoard(); }
    }
    requestAnimationFrame(tick);
  }

  // ---- Animation system ----
  function gatherAnimInfo(fr,fc,tr,tc) { const p=game.at(fr,fc),moves=game.getValidMovesFor(fr,fc),move=moves.find(m=>m.toRow===tr&&m.toCol===tc); if(!p||!move) return null; return{fromRow:fr,fromCol:fc,toRow:tr,toCol:tc,pieceColor:p.color,pieceQueen:p.queen,captured:move.captured.map(cap=>{const cp=game.at(cap.row,cap.col);return{row:cap.row,col:cap.col,color:cp.color,queen:cp.queen};})}; }
  function animateSlide(info) { return new Promise(resolve => { const flip=myColor==='black'; const fromX=(flip?7-info.fromCol:info.fromCol)*CELL+CELL/2,fromY=(flip?7-info.fromRow:info.fromRow)*CELL+CELL/2; const toX=(flip?7-info.toCol:info.toCol)*CELL+CELL/2,toY=(flip?7-info.toRow:info.toRow)*CELL+CELL/2; const duration=200,start=performance.now(); moveAnimState={destRow:info.toRow,destCol:info.toCol}; capturedOverlay=info.captured; trail=[]; let lastT=0; function tick(now){const t=Math.min((now-start)/duration,1),e=1-Math.pow(1-t,3); const cx=fromX+(toX-fromX)*e,cy=fromY+(toY-fromY)*e; if(now-lastT>20&&t>0.05){trail.push({x:cx,y:cy,color:info.pieceColor,queen:info.pieceQueen,alpha:0.2});lastT=now;if(trail.length>6)trail.shift();} for(let i=0;i<trail.length;i++)trail[i].alpha=0.12*(i+1)/trail.length; drawBoard();drawPiece(cx,cy,info.pieceColor,info.pieceQueen); if(t<1)requestAnimationFrame(tick);else{moveAnimState=null;capturedOverlay=[];trail=[];resolve();}} requestAnimationFrame(tick);}); }
  function spawnShatter(px,py,color) { const base=color==='red'?[233,69,96]:[45,45,45]; for(let i=0;i<14;i++){const angle=(Math.PI*2*i/14)+(Math.random()-0.5)*0.5,speed=80+Math.random()*180,size=CELL*(0.04+Math.random()*0.08); const r=Math.min(255,Math.max(0,base[0]+(Math.random()-0.5)*50)),g=Math.min(255,Math.max(0,base[1]+(Math.random()-0.5)*50)),b=Math.min(255,Math.max(0,base[2]+(Math.random()-0.5)*50)); shatterParticles.push({x:px,y:py,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-50,size,color:`rgb(${r|0},${g|0},${b|0})`,life:1,decay:1.5+Math.random(),gravity:300+Math.random()*150,rotation:Math.random()*Math.PI*2,rotSpeed:(Math.random()-0.5)*12});} }
  function animateEffects() { return new Promise(resolve=>{let last=performance.now();function tick(now){const dt=(now-last)/1000;last=now;for(const p of shatterParticles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.gravity*dt;p.life-=p.decay*dt;p.rotation+=p.rotSpeed*dt;p.size*=0.98;}shatterParticles=shatterParticles.filter(p=>p.life>0);drawBoard();if(shatterParticles.length>0)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);}); }

  async function performAnimatedMove(fr,fc,tr,tc) {
    const info=gatherAnimInfo(fr,fc,tr,tc); const result=game.makeMove(fr,fc,tr,tc); if(!result)return null;
    lastMove={fromRow:fr,fromCol:fc,toRow:tr,toCol:tc};
    lastMoveCaptured = info?.captured?.map(c => ({row:c.row, col:c.col})) || [];
    if(info?.captured.length>0){for(const cap of info.captured)capturedPieces[info.pieceColor].push({color:cap.color,queen:cap.queen});capturedPieces=capturedPieces;}
    moveLog=[...moveLog,{num:++moveNumber,color:info?.pieceColor,from:`${'abcdefgh'[fc]}${8-fr}`,to:`${'abcdefgh'[tc]}${8-tr}`,capture:result.captured.length>0}];
    if(info){animating=true;await animateSlide(info);if(info.captured.length>0){const flip=myColor==='black';for(const cap of info.captured){const cr=flip?7-cap.row:cap.row,cc=flip?7-cap.col:cap.col;spawnShatter(cc*CELL+CELL/2,cr*CELL+CELL/2,cap.color);}}if(shatterParticles.length>0)await animateEffects();animating=false;}
    syncTimers();
    return result;
  }

  // ---- Input ----
  function onClick(e) { if(game.gameOver||botThinking||animating||game.currentPlayer!==myColor)return; const rect=canvasEl.getBoundingClientRect(),flip=myColor==='black'; let col=Math.floor((e.clientX-rect.left)/CELL),row=Math.floor((e.clientY-rect.top)/CELL); if(flip){row=7-row;col=7-col;} const mt=validMoves.find(m=>m.toRow===row&&m.toCol===col); if(mt&&selectedPiece){executeMove(selectedPiece.row,selectedPiece.col,row,col);return;} const piece=game.at(row,col); if(piece&&piece.color===myColor){const moves=game.getValidMovesFor(row,col);if(moves.length>0){selectedPiece={row,col};validMoves=moves;}else{selectedPiece=null;validMoves=[];}}else{selectedPiece=null;validMoves=[];} drawBoard(); }
  function onMouseMove(e) { if(game.gameOver||animating||botThinking){canvasEl.style.cursor='default';return;} const rect=canvasEl.getBoundingClientRect(),flip=myColor==='black'; let col=Math.floor((e.clientX-rect.left)/CELL),row=Math.floor((e.clientY-rect.top)/CELL); if(col<0||col>7||row<0||row>7)return; if(flip){row=7-row;col=7-col;} const piece=game.at(row,col),isTarget=validMoves.some(m=>m.toRow===row&&m.toCol===col); canvasEl.style.cursor=(piece?.color===myColor&&game.currentPlayer===myColor)||isTarget?'pointer':'default'; const nh=(piece?.color===myColor)?{row,col}:null; if(hoveredCell?.row!==nh?.row||hoveredCell?.col!==nh?.col){hoveredCell=nh;if(!animating)drawBoard();} }

  // ---- Move execution ----
  async function executeMove(fr,fc,tr,tc) { if(mode==='online')socket.emit('game:move',{gameId:$gameState.gameId,fromRow:fr,fromCol:fc,toRow:tr,toCol:tc}); const result=await performAnimatedMove(fr,fc,tr,tc); if(!result)return; if(result.chainContinues){selectedPiece={row:tr,col:tc};validMoves=game.getValidMovesFor(tr,tc);}else{selectedPiece=null;validMoves=[];} drawBoard(); if(game.gameOver){handleGameOver();return;} if(mode==='bot'&&game.currentPlayer!==myColor)botTurn(); }

  async function onServerMove(data) { if(data.fromRow===undefined)return; const isMyMove=game.currentPlayer===myColor; if(!isMyMove){const result=await performAnimatedMove(data.fromRow,data.fromCol,data.toRow,data.toCol);if(result){selectedPiece=null;validMoves=[];drawBoard();}} game.redTime=data.redTime;game.blackTime=data.blackTime; }
  function onTick(data) { game.redTime=data.redTime; game.blackTime=data.blackTime; syncTimers(); }
  function onGameOver(data) { game.gameOver=true; game.winner=data.winner; gameOverData=data; }

  function botTurn() { botThinking=true; setTimeout(async()=>{const move=bot.chooseMove(game);if(!move){botThinking=false;return;}const result=await performAnimatedMove(move.fromRow,move.fromCol,move.toRow,move.toCol);if(!result){botThinking=false;return;}selectedPiece=null;validMoves=[];drawBoard();if(game.gameOver){botThinking=false;handleGameOver();return;}if(result.chainContinues)setTimeout(()=>botTurn(),300);else botThinking=false;},400+Math.random()*600); }

  function startTimer() { timerInterval=setInterval(()=>{if(game.gameOver){clearInterval(timerInterval);return;}game.tickTime(1);syncTimers();if(game.gameOver)handleGameOver();},1000); }
  function handleGameOver() { clearInterval(timerInterval); if(!gameOverData)gameOverData={winner:game.winner,eloChanges:{red:0,black:0},coinRewards:{red:0,black:0}}; }

  function resign() { showResignConfirm=false; game.gameOver=true; game.winner=myColor==='red'?'black':'red'; if(mode==='online')socket.emit('game:resign',{gameId:$gameState.gameId}); handleGameOver(); }
  function goToLobby() { gameOverData=null; $gameState=null; $screen='lobby'; }

  function onEmoteShow(data) { activeEmote={emoji:data.emote.emoji,label:data.emote.label,username:data.username}; clearTimeout(emoteTimeout); emoteTimeout=setTimeout(()=>{activeEmote=null;},2500); }
  function sendEmote(emote) {
    socket?.emit('emote:send',{gameId:$gameState?.gameId,emote:{emoji:emote.data.emoji,label:emote.data.label}});
    // Only hide on mobile (desktop keeps it open in left panel)
    if (window.innerWidth < 1100) showEmoteBar=false;
  }

  let redTime = game.redTime;
  let blackTime = game.blackTime;
  let currentPlayer = game.currentPlayer;

  // Sync reactive time vars from game state
  function syncTimers() { redTime = game.redTime; blackTime = game.blackTime; currentPlayer = game.currentPlayer; }

  $: topColor = myColor === 'red' ? 'black' : 'red';
  $: topTime = topColor === 'red' ? redTime : blackTime;
  $: bottomTime = myColor === 'red' ? redTime : blackTime;
  $: isMyTurn = currentPlayer === myColor && !game.gameOver;
  $: statusText = game.gameOver ? (game.winner===myColor?'Victory!':'Defeat') : isMyTurn ? 'Your turn' : (mode==='bot'?'The Colonel is thinking...':"Opponent's turn");
  function fmtTime(s) { const sec=Math.ceil(s); return `0:${sec.toString().padStart(2,'0')}`; }
</script>

<div class="game-layout">
  <!-- Top: opponent -->
  <div class="player-bar opponent">
    <div class="pinfo" class:active={currentPlayer === topColor}>
      <div class="dot {topColor}"></div>
      <span class="pname">{myColor==='red'?opponentName:$user?.username}</span>
      <span class="timer" class:low={topTime<=15} class:critical={topTime<=7}>{fmtTime(topTime)}</span>
      <div class="tbar-track"><div class="tbar-fill" class:low={topTime<=15} class:critical={topTime<=7} style="width:{topTime/TURN_TIME*100}%"></div></div>
    </div>
    <div class="captured">
      {#each capturedPieces[topColor]||[] as cap}<div class="cap {cap.color}"></div>{/each}
    </div>
  </div>

  <!-- Center: board -->
  <div class="board-wrap">
    <canvas bind:this={canvasEl} width="480" height="480"
      on:click={onClick} on:mousemove={onMouseMove}
      on:mouseleave={()=>{hoveredCell=null;if(canvasEl)canvasEl.style.cursor='default';if(!animating)drawBoard();}}></canvas>

    {#if gameOverData}
      <div class="game-over">
        <h2 style="color:{game.winner===myColor?'var(--success)':'var(--accent)'}">{game.winner===myColor?'Victory!':'Defeat'}</h2>
        {#if gameOverData.eloChanges}<p class="elo">ELO: {gameOverData.eloChanges[myColor]>=0?'+':''}{gameOverData.eloChanges[myColor]}</p>{/if}
        {#if gameOverData.coinRewards?.[myColor]}<p class="coins">+{gameOverData.coinRewards[myColor]} coins</p>{/if}
        <button class="btn btn-primary btn-small" on:click={goToLobby}>Lobby</button>
      </div>
    {/if}
  </div>

  <!-- Bottom: self -->
  <div class="player-bar self">
    <div class="captured">
      {#each capturedPieces[myColor]||[] as cap}<div class="cap {cap.color}"></div>{/each}
    </div>
    <div class="pinfo" class:active={currentPlayer === myColor}>
      <div class="tbar-track"><div class="tbar-fill" class:low={bottomTime<=15} class:critical={bottomTime<=7} style="width:{bottomTime/TURN_TIME*100}%"></div></div>
      <div class="dot {myColor}"></div>
      <span class="pname">{myColor==='red'?$user?.username:opponentName}</span>
      <span class="timer" class:low={bottomTime<=15} class:critical={bottomTime<=7}>{fmtTime(bottomTime)}</span>
    </div>
  </div>

  {#if opponentDisconnected}
    <div class="disconnect-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Opponent disconnected — waiting 30s for reconnect...
    </div>
  {:else}
    <div class="status">{statusText}</div>
  {/if}

  <div class="actions">
    {#if !game.gameOver && mode !== 'spectator'}
      <button class="btn btn-dark btn-small" on:click={()=>showResignConfirm=true}>Resign</button>
    {/if}
    {#if mode==='online'}
      <button class="btn btn-dark btn-small chat-toggle" class:mobile-only={showChat || desktopChat} on:click={()=>{ showChat=!showChat; desktopChat=!desktopChat; $roomUnreadChat=0; }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        Chat
        {#if $roomUnreadChat > 0 && !showChat && !desktopChat}
          <span class="unread-badge">{$roomUnreadChat > 9 ? '9+' : $roomUnreadChat}</span>
        {/if}
      </button>
      {#if ownedEmotes.length>0}
        <button class="btn btn-dark btn-small mobile-only" on:click={()=>showEmoteBar=!showEmoteBar}>Emote</button>
      {/if}
    {/if}
  </div>

  <div class="moves">
    {#each moveLog.slice(-10) as m}
      <div class="move-pill"><span class="mdot {m.color}"></span><span class="mtxt">{m.from}{m.capture?'\u00d7':'\u2192'}{m.to}</span></div>
    {/each}
  </div>

  <!-- Overlays -->
  {#if showResignConfirm}
    <div class="overlay" on:click|self={()=>showResignConfirm=false}>
      <div class="card confirm"><p>Resign this game?</p><div class="confirm-btns"><button class="btn btn-primary btn-small" on:click={resign}>Resign</button><button class="btn btn-dark btn-small" on:click={()=>showResignConfirm=false}>Cancel</button></div></div>
    </div>
  {/if}

  {#if activeEmote}
    <div class="emote-bubble"><span class="emote-emoji">{activeEmote.emoji}</span><span class="emote-who">{activeEmote.username}</span></div>
  {/if}

  <!-- Left panel: emotes + chat (desktop: always visible, mobile: toggled) -->
  <div class="left-panel" class:mobile-hidden-emotes={!showEmoteBar} class:mobile-hidden-chat={!showChat}>
    {#if ownedEmotes.length > 0}
      <div class="emote-bar" class:mobile-hidden={!showEmoteBar}>
        {#each ownedEmotes as e}<button class="emote-btn" on:click={()=>sendEmote(e)} title={e.name}>{e.data.emoji}</button>{/each}
      </div>
    {/if}
    {#if mode === 'online'}
      {#if showChat || desktopChat}
        <div class="game-chat card" class:minimized={!showChat && !desktopChat}>
          <RoomChat channelId={$gameState?.gameId ? `game:${$gameState.gameId}` : null} closeable={true} readOnly={mode === 'spectator'} on:close={() => { showChat = false; desktopChat = false; }} />
        </div>
      {/if}
    {/if}
  </div>

</div>

<style>
  .game-layout {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: var(--sp-sm); padding-top: max(var(--sp-sm), env(safe-area-inset-top));
    padding-bottom: max(var(--sp-sm), env(safe-area-inset-bottom));
    gap: var(--sp-xs); background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg) 30%);
  }

  .player-bar { width: 100%; max-width: 640px; display: flex; flex-direction: column; }
  .pinfo {
    display: flex; align-items: center; gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md); padding-bottom: var(--sp-xs);
    border-radius: var(--radius-md); background: var(--surface);
    border: 1px solid var(--surface2);
    transition: border-color 0.3s, box-shadow 0.3s;
    flex-wrap: wrap;
    overflow: hidden;
  }
  .pinfo.active { border-color: var(--accent); box-shadow: 0 0 12px rgba(239,68,68,0.15); }
  .dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
  .dot.red { background: var(--red-piece); }
  .dot.black { background: var(--black-piece); border: 2px solid #555; }
  .pname { font-weight: 600; font-size: var(--fs-caption); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .timer { font-family: var(--font-mono); font-size: var(--fs-caption); color: var(--text-dim); margin-left: auto; flex-shrink: 0; }
  .timer.low { color: var(--warning); font-weight: 700; }
  .timer.critical { color: var(--accent); animation: timerPulse 0.5s ease-in-out infinite; }

  .tbar-track { width: 100%; height: 3px; background: var(--surface2); border-radius: 2px; overflow: hidden; margin-top: var(--sp-xs); }
  .tbar-fill { height: 100%; background: var(--accent2); border-radius: 2px; transition: width 1s linear; }
  .tbar-fill.low { background: var(--warning); }
  .tbar-fill.critical { background: var(--accent); }

  .captured { display: flex; gap: 2px; min-height: 14px; padding: 2px; flex-wrap: wrap; }
  .cap { width: 10px; height: 10px; border-radius: 50%; animation: capPop 0.3s ease-out; }
  .cap.red { background: var(--red-piece); }
  .cap.black { background: var(--black-piece); border: 1px solid #555; }

  .board-wrap { position: relative; touch-action: none; }
  canvas {
    display: block; border-radius: var(--radius-sm); cursor: pointer; box-shadow: var(--shadow-board);
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    touch-action: none;
  }

  .game-over {
    position: absolute; inset: 0; background: rgba(0,0,0,0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-sm); border-radius: var(--radius-sm); z-index: 10; backdrop-filter: blur(4px);
  }
  .game-over h2 { font-size: var(--fs-title); }
  .elo { font-size: var(--fs-body); color: var(--text-dim); }
  .coins { font-size: var(--fs-body); color: var(--gold); }

  .status { font-size: var(--fs-caption); color: var(--text-dim); height: 18px; }
  .disconnect-banner {
    display: flex; align-items: center; gap: var(--sp-xs);
    padding: var(--sp-xs) var(--sp-md);
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid var(--warning);
    border-radius: var(--radius-sm);
    color: var(--warning);
    font-size: var(--fs-caption);
    font-weight: 500;
    animation: pulse-border 2s ease-in-out infinite;
  }
  @keyframes pulse-border { 0%,100%{border-color:var(--warning);} 50%{border-color:transparent;} }
  .actions { display: flex; gap: var(--sp-sm); }
  .chat-toggle { position: relative; }
  .unread-badge {
    position: absolute; top: -6px; right: -6px;
    min-width: 16px; height: 16px;
    background: var(--accent); color: #fff;
    font-size: 0.55rem; font-weight: 700;
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    padding: 0 4px; line-height: 1;
  }

  .moves { display: flex; gap: var(--sp-xs); overflow-x: auto; width: 100%; max-width: 640px; scrollbar-width: none; min-height: 18px; }
  .moves::-webkit-scrollbar { display: none; }
  .move-pill { display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: var(--surface); border-radius: var(--radius-pill); font-size: 0.65rem; white-space: nowrap; flex-shrink: 0; }
  .mdot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .mdot.red { background: var(--red-piece); }
  .mdot.black { background: var(--black-piece); }
  .mtxt { color: var(--text-dim); font-family: var(--font-mono); }

  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 20; }
  .confirm { text-align: center; display: flex; flex-direction: column; gap: var(--sp-md); padding: var(--sp-lg); }
  .confirm-btns { display: flex; gap: var(--sp-sm); justify-content: center; }

  .emote-bubble { position: fixed; top: 20%; left: 50%; transform: translateX(-50%); background: var(--surface); border: 2px solid var(--accent); border-radius: var(--radius-lg); padding: var(--sp-sm) var(--sp-md); display: flex; flex-direction: column; align-items: center; gap: var(--sp-xs); z-index: 30; animation: emoteFloat 2.5s ease-out forwards; pointer-events: none; }
  .emote-emoji { font-size: 2.5rem; }
  .emote-who { font-size: 0.6rem; color: var(--text-dim); }
  @keyframes emoteFloat { 0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(0.5);} 15%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.1);} 25%{transform:translateX(-50%) translateY(0) scale(1);} 80%{opacity:1;} 100%{opacity:0;transform:translateX(-50%) translateY(-30px);} }

  .left-panel { display: contents; } /* On mobile, children flow into the main flex */
  .mobile-only { display: inline-flex; }
  .mobile-hidden { display: none !important; }

  .emote-bar { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; background: var(--surface); border: 1px solid var(--surface2); border-radius: var(--radius-lg); padding: var(--sp-sm) var(--sp-md); }

  .game-chat {
    width: 100%; max-width: 640px; height: 200px; padding: 0; overflow: hidden;
    position: fixed; bottom: 0; left: 0; right: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    z-index: 15;
  }

  @media (min-width: 1100px) {
    .mobile-only { display: none !important; }
    .left-panel {
      display: flex !important; flex-direction: column; gap: var(--sp-sm);
      grid-column: 1; grid-row: 1 / 6;
      align-self: center;
      width: 100%;
    }
    .game-chat {
      position: static; height: 360px; max-width: none; width: 100%;
      border-radius: var(--radius-lg);
    }
    .emote-bar { width: 100%; }
  }
  .emote-btn { width: 40px; height: 40px; border-radius: var(--radius-sm); background: var(--surface2); border: none; cursor: pointer; font-size: 1.4rem; transition: transform 0.1s; }
  .emote-btn:hover { transform: scale(1.15); }


  /* ---- Desktop 3-column ---- */
  /* Left: emotes | Center: opponent + board + self + status + actions | Right: moves */
  @media (min-width: 1100px) {
    .game-layout {
      display: grid;
      grid-template-columns: var(--side-panel) auto var(--side-panel);
      grid-template-rows: auto auto auto auto auto;
      align-content: center;
      justify-content: center;
      gap: var(--sp-xs) var(--sp-xl);
      padding: var(--sp-lg);
    }

    .player-bar { max-width: none; grid-column: 2; }
    .player-bar.opponent { grid-row: 1; }
    .board-wrap { grid-column: 2; grid-row: 2; justify-self: center; }
    .player-bar.self { grid-column: 2; grid-row: 3; }
    .status { grid-column: 2; grid-row: 4; text-align: center; }
    .disconnect-banner { grid-column: 2; grid-row: 4; }
    .actions { grid-column: 2; grid-row: 5; justify-self: center; }


    .moves {
      grid-column: 3; grid-row: 1 / 6;
      flex-direction: column; overflow-y: auto; overflow-x: hidden;
      max-height: 400px; max-width: none;
      align-self: center;
      scrollbar-width: thin;
    }
  }
</style>
