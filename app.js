// ============================================================
// App — UI, networking (PeerJS), bot integration, leaderboard
// With: animations, 3D pieces, board texture, confetti, etc.
// ============================================================

(() => {
  // ---- state ----
  let playerName = localStorage.getItem('checkers_name') || '';
  let myColor = 'red';
  let game = new CheckersGame();
  let selectedPiece = null;
  let validMoves = [];
  let mode = null;  // 'bot' | 'friend' | 'random'
  let peer = null;
  let conn = null;
  let timerInterval = null;
  let botInstance = new ColonelBot();
  let botThinking = false;
  const POOL_SIZE = 20;
  const POOL_PREFIX = 'checkers-pool-';
  let searchingTimeout = null;
  let poolIndex = -1;

  // ---- animation state ----
  let animating = false;
  let moveAnimState = null;
  let shatterParticles = [];
  let capturedOverlay = [];
  let promotionGlow = null;
  let lastMove = null;
  let hoveredCell = null;
  let introAnim = null;
  let trail = [];
  let scatterParticles = [];

  // ---- game tracking ----
  let capturedPieces = { red: [], black: [] }; // capturedPieces[color] = pieces captured BY that color
  let moveLog = [];
  let moveNumber = 0;

  // ---- canvas ----
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const confettiCanvas = document.getElementById('confettiCanvas');
  const confettiCtx = confettiCanvas.getContext('2d');
  let confettiParticles = [];
  let confettiAnimId = null;
  let CELL = 60;
  let BOARD_PX = CELL * 8;
  let boardTextureCanvas = null;

  function resizeBoard() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let maxW, maxH, cap;

    if (vw >= 1100) {
      // Desktop with side panels (~530px taken by panels + gaps)
      maxW = Math.min(vw - 560, 640);
      maxH = vh - 100;
      cap = 640;
    } else if (vw >= 600) {
      // Tablet
      maxW = Math.min(vw - 24, 560);
      maxH = vh - 200;
      cap = 560;
    } else {
      // Mobile
      maxW = vw - 16;
      maxH = vh - (vh <= 520 ? 120 : 190);
      cap = 480;
    }

    BOARD_PX = Math.min(maxW, maxH, cap);
    BOARD_PX = Math.max(BOARD_PX, 200);
    CELL = BOARD_PX / 8;
    canvas.width = BOARD_PX;
    canvas.height = BOARD_PX;
    confettiCanvas.width = vw;
    confettiCanvas.height = vh;
    generateBoardTexture();
    drawBoard();
  }

  // ---- board texture ----
  function generateBoardTexture() {
    boardTextureCanvas = document.createElement('canvas');
    boardTextureCanvas.width = BOARD_PX;
    boardTextureCanvas.height = BOARD_PX;
    const tctx = boardTextureCanvas.getContext('2d');
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        tctx.fillStyle = (r + c) % 2 === 0 ? '#c8b078' : '#6b8e4e';
        tctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    // Subtle noise
    const imgData = tctx.getImageData(0, 0, BOARD_PX, BOARD_PX);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      d[i]   = Math.min(255, Math.max(0, d[i] + n));
      d[i+1] = Math.min(255, Math.max(0, d[i+1] + n));
      d[i+2] = Math.min(255, Math.max(0, d[i+2] + n));
    }
    tctx.putImageData(imgData, 0, 0);
    // Wood grain lines
    tctx.strokeStyle = 'rgba(0,0,0,0.04)';
    tctx.lineWidth = 1;
    for (let y = 0; y < BOARD_PX; y += 3 + Math.random() * 5) {
      tctx.beginPath();
      tctx.moveTo(0, y);
      for (let x = 0; x < BOARD_PX; x += 20) {
        tctx.lineTo(x + 20, y + (Math.random() - 0.5) * 2);
      }
      tctx.stroke();
    }
  }

  // ---- screens ----
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ---- leaderboard ----
  function getLeaderboard() {
    try { return JSON.parse(localStorage.getItem('checkers_lb')) || []; }
    catch { return []; }
  }
  function saveLeaderboard(lb) { localStorage.setItem('checkers_lb', JSON.stringify(lb)); }

  function recordResult(winnerName, loserName, winnerIsBot, loserIsBot) {
    const lb = getLeaderboard();
    const findOrCreate = (name, isBot) => {
      let entry = lb.find(e => e.name === name);
      if (!entry) { entry = { name, wins: 0, losses: 0, isBot }; lb.push(entry); }
      return entry;
    };
    findOrCreate(winnerName, winnerIsBot).wins++;
    findOrCreate(loserName, loserIsBot).losses++;
    saveLeaderboard(lb);
  }

  function renderLeaderboard() {
    const lb = getLeaderboard().sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    const tbody = document.getElementById('lbBody');
    tbody.innerHTML = '';
    if (lb.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">No games played yet</td></tr>';
      return;
    }
    lb.slice(0, 10).forEach((e, i) => {
      const tr = document.createElement('tr');
      if (e.isBot) tr.classList.add('bot-row');
      tr.innerHTML = `
        <td class="rank">${i + 1}</td>
        <td>${e.isBot ? '* ' : ''}${esc(e.name)}</td>
        <td class="wins">${e.wins}</td>
        <td class="losses">${e.losses}</td>`;
      tbody.appendChild(tr);
    });
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ---- name screen ----
  document.getElementById('nameBtn').onclick = () => {
    const v = document.getElementById('nameInput').value.trim();
    if (!v) return;
    playerName = v;
    localStorage.setItem('checkers_name', playerName);
    enterLobby();
  };
  document.getElementById('nameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('nameBtn').click();
  });

  // ---- lobby ----
  function enterLobby() {
    cleanup();
    renderLeaderboard();
    document.getElementById('lobbyName').textContent = playerName;
    showScreen('lobby');
  }

  document.getElementById('btnBot').onclick = () => startBotGame();
  document.getElementById('btnFriend').onclick = () => startFriendFlow();
  document.getElementById('btnRandom').onclick = () => startRandomSearch();
  document.getElementById('btnChangeName').onclick = () => {
    document.getElementById('nameInput').value = playerName;
    showScreen('nameScreen');
  };

  // ---- friend flow ----
  function startFriendFlow() {
    mode = 'friend';
    initPeer(() => {
      document.getElementById('myCode').textContent = peer.id;
      showScreen('friendScreen');
    });
  }

  document.getElementById('friendConnectBtn').onclick = () => {
    const code = document.getElementById('friendCodeInput').value.trim().toUpperCase();
    if (!code) return;
    connectToPeer(code);
  };
  document.getElementById('friendCodeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('friendConnectBtn').click();
  });
  document.getElementById('friendBackBtn').onclick = () => enterLobby();

  // ---- random matchmaking ----
  function startRandomSearch() {
    mode = 'random';
    showScreen('searchScreen');
    initPeer(() => tryMatchmaking());
  }
  document.getElementById('searchBackBtn').onclick = () => enterLobby();

  function tryMatchmaking() {
    let tried = 0;
    const order = shuffleRange(POOL_SIZE);
    function tryNext() {
      if (tried >= POOL_SIZE) {
        registerInPool();
        return;
      }
      const idx = order[tried++];
      const id = POOL_PREFIX + idx;
      if (id === peer?.id) { tryNext(); return; }
      const c = peer.connect(id, { reliable: true });
      const timeout = setTimeout(() => { c.close(); tryNext(); }, 2000);
      c.on('open', () => {
        clearTimeout(timeout);
        conn = c;
        myColor = 'black';
        setupConnection();
        sendMsg({ type: 'start', name: playerName, color: 'black' });
      });
      c.on('error', () => { clearTimeout(timeout); tryNext(); });
    }
    tryNext();
  }

  function registerInPool() {
    poolIndex = Math.floor(Math.random() * POOL_SIZE);
    const id = POOL_PREFIX + poolIndex;
    if (peer) peer.destroy();
    peer = new Peer(id, { debug: 0 });
    peer.on('open', () => {
      document.getElementById('searchStatus').textContent = 'Waiting for an opponent...';
    });
    peer.on('connection', c => {
      conn = c;
      myColor = 'red';
      setupConnection();
    });
    peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        poolIndex = (poolIndex + 1) % POOL_SIZE;
        registerInPool();
      }
    });
  }

  function shuffleRange(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---- PeerJS helpers ----
  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function initPeer(cb) {
    if (peer) peer.destroy();
    const id = genCode();
    peer = new Peer(id, { debug: 0 });
    peer.on('open', () => cb && cb());
    peer.on('connection', c => {
      conn = c;
      myColor = 'red';
      setupConnection();
    });
    peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        initPeer(cb);
      } else {
        console.error('Peer error:', err);
      }
    });
  }

  function connectToPeer(id) {
    conn = peer.connect(id, { reliable: true });
    conn.on('open', () => {
      myColor = 'black';
      setupConnection();
      sendMsg({ type: 'start', name: playerName, color: 'black' });
    });
    conn.on('error', err => alert('Could not connect. Check the code and try again.'));
  }

  let opponentName = '';

  function setupConnection() {
    conn.on('data', data => handleMessage(data));
    conn.on('close', () => {
      if (!game.gameOver) {
        setStatus('Opponent disconnected');
        game.gameOver = true;
        game.winner = myColor;
        (async () => {
          await scatterPieces();
          showGameOver(myColor);
          endGame();
        })();
      }
    });
  }

  function sendMsg(msg) { if (conn && conn.open) conn.send(msg); }

  function handleMessage(data) {
    switch (data.type) {
      case 'start':
        opponentName = data.name || 'Opponent';
        sendMsg({ type: 'start-ack', name: playerName });
        startOnlineGame();
        break;
      case 'start-ack':
        opponentName = data.name || 'Opponent';
        startOnlineGame();
        break;
      case 'move':
        (async () => {
          const r = await performAnimatedMove(data.fromRow, data.fromCol, data.toRow, data.toCol);
          if (r) {
            selectedPiece = null;
            validMoves = [];
            drawBoard();
            updateUI();
            if (game.gameOver) endGame();
          }
        })();
        break;
      case 'resign':
        game.gameOver = true;
        game.winner = myColor;
        (async () => {
          await scatterPieces();
          endGame();
        })();
        break;
    }
  }

  // ---- start games ----
  function resetTracking() {
    lastMove = null;
    capturedPieces = { red: [], black: [] };
    moveLog = [];
    moveNumber = 0;
    scatterParticles = [];
    shatterParticles = [];
    trail = [];
    introAnim = null;
    renderCapturedTray();
    renderMoveHistory();
  }

  // ---- color wheel ----
  function spinColorWheel(predeterminedColor) {
    return new Promise(resolve => {
      showScreen('wheelScreen');
      const wheel = document.getElementById('colorWheel');
      const resultEl = document.getElementById('wheelResult');
      resultEl.textContent = '';
      resultEl.style.color = '';

      const pickedColor = predeterminedColor || (Math.random() < 0.5 ? 'red' : 'black');

      // After rotation R, the gradient angle at the top is (360 - R % 360).
      // Red zone: gradient 0-180deg. For pointer to land on red: R%360 in [190, 350].
      // Black zone: gradient 180-360deg. For pointer to land on black: R%360 in [10, 170].
      const spins = 3 + Math.random() * 2;
      let landAngle;
      if (pickedColor === 'red') {
        landAngle = 210 + Math.random() * 120; // land in red zone
      } else {
        landAngle = 30 + Math.random() * 120;  // land in black zone
      }
      const totalRotation = Math.floor(spins) * 360 + landAngle;

      wheel.style.transition = 'none';
      wheel.style.transform = 'rotate(0deg)';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          wheel.style.transition = 'transform 2.8s cubic-bezier(0.15, 0.6, 0.15, 1)';
          wheel.style.transform = `rotate(${totalRotation}deg)`;
        });
      });

      setTimeout(() => {
        if (pickedColor === 'red') {
          resultEl.textContent = 'You are RED — you go first!';
          resultEl.style.color = '#e94560';
        } else {
          resultEl.textContent = 'You are BLACK';
          resultEl.style.color = '#aaa';
        }
        setTimeout(() => resolve(pickedColor), 1000);
      }, 3000);
    });
  }

  // ---- start games ----
  function launchGame(color, opponent) {
    myColor = color;
    game = new CheckersGame();
    selectedPiece = null;
    validMoves = [];
    resetTracking();
    const topIsOpponent = myColor === 'red';
    document.getElementById('topName').textContent = topIsOpponent ? opponent : playerName;
    document.getElementById('bottomName').textContent = topIsOpponent ? playerName : opponent;
    document.getElementById('topDot').className = 'dot ' + (myColor === 'red' ? 'black' : 'red');
    document.getElementById('bottomDot').className = 'dot ' + myColor;
    showScreen('gameScreen');
    resizeBoard();
    startTimer();
    updateUI();
    playIntroAnimation();

    // If bot goes first (we're black), trigger bot turn after intro
    if (mode === 'bot' && myColor === 'black') {
      setTimeout(() => botTurn(), 1100);
    }
  }

  async function startOnlineGame() {
    // For online, color is already set by the protocol — show wheel with predetermined result
    await spinColorWheel(myColor);
    launchGame(myColor, opponentName);
  }

  async function startBotGame() {
    mode = 'bot';
    opponentName = botInstance.name;
    const color = await spinColorWheel();
    launchGame(color, botInstance.name);
  }

  // ---- timer ----
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (game.gameOver) { clearInterval(timerInterval); return; }
      game.tickTime(1);
      updateTimers();
      if (game.gameOver) endGame();
    }, 1000);
  }

  const TURN_TIME = 60;
  let prevMyTime = TURN_TIME;

  function updateTimers() {
    const topColor = myColor === 'red' ? 'black' : 'red';
    const topTime = topColor === 'red' ? game.redTime : game.blackTime;
    const bottomTime = myColor === 'red' ? game.redTime : game.blackTime;
    const myTime = bottomTime;
    const topTimer = document.getElementById('topTimer');
    const bottomTimer = document.getElementById('bottomTimer');
    topTimer.textContent = formatTime(topTime);
    bottomTimer.textContent = formatTime(bottomTime);

    // Urgency tiers: warning < 15s, danger < 7s, critical < 3s
    topTimer.classList.toggle('low', topTime <= 15);
    topTimer.classList.toggle('critical', topTime <= 7);
    bottomTimer.classList.toggle('low', myTime <= 15);
    bottomTimer.classList.toggle('critical', myTime <= 7);

    // Feedback when MY timer hits thresholds
    if (game.currentPlayer === myColor && !game.gameOver) {
      if (prevMyTime > 15 && myTime <= 15) {
        setStatus('Hurry up! 15 seconds left');
      } else if (prevMyTime > 7 && myTime <= 7) {
        setStatus('Running out of time!');
        triggerScreenShake(2, 150);
      } else if (prevMyTime > 3 && myTime <= 3) {
        setStatus('MOVE NOW!');
        triggerScreenShake(4, 200);
      }
    }
    prevMyTime = myTime;

    updateTimerBars();
  }

  function formatTime(s) {
    const sec = Math.ceil(s);
    return `0:${sec.toString().padStart(2, '0')}`;
  }

  function updateTimerBars() {
    const topColor = myColor === 'red' ? 'black' : 'red';
    const topTime = topColor === 'red' ? game.redTime : game.blackTime;
    const bottomTime = myColor === 'red' ? game.redTime : game.blackTime;
    const topBar = document.getElementById('topTimerBar');
    const bottomBar = document.getElementById('bottomTimerBar');
    topBar.style.width = (topTime / TURN_TIME * 100) + '%';
    bottomBar.style.width = (bottomTime / TURN_TIME * 100) + '%';
    topBar.classList.toggle('low', topTime <= 15);
    topBar.classList.toggle('critical', topTime <= 7);
    bottomBar.classList.toggle('low', bottomTime <= 15);
    bottomBar.classList.toggle('critical', bottomTime <= 7);
  }

  // ---- UI update ----
  let prevTurn = null;

  function updateUI() {
    const topColor = myColor === 'red' ? 'black' : 'red';
    document.getElementById('topInfo').classList.toggle('active-turn', game.currentPlayer === topColor);
    document.getElementById('bottomInfo').classList.toggle('active-turn', game.currentPlayer === myColor);
    updateTimers();

    const isMyTurn = game.currentPlayer === myColor && !game.gameOver;
    if (isMyTurn) {
      setStatus('Your turn');
      // Turn pulse
      if (prevTurn !== myColor) {
        canvas.classList.remove('your-turn-pulse');
        void canvas.offsetWidth;
        canvas.classList.add('your-turn-pulse');
      }
    } else if (!game.gameOver) {
      setStatus(mode === 'bot' ? 'The Colonel is thinking...' : "Opponent's turn");
    }
    prevTurn = game.currentPlayer;
    drawBoard();
  }

  function setStatus(msg) {
    document.getElementById('statusBar').textContent = msg;
  }

  // ---- drawing ----
  function drawPiece(px, py, color, isQueen, alpha) {
    const radius = CELL * 0.38;
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(px + 1, py + 3, radius, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Base disc (3D depth)
    ctx.beginPath();
    ctx.arc(px, py + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = color === 'red' ? '#b8334a' : '#1a1a1a';
    ctx.fill();

    // Main disc with radial gradient
    const grad = ctx.createRadialGradient(
      px - radius * 0.3, py - radius * 0.3, radius * 0.1,
      px, py, radius
    );
    if (color === 'red') {
      grad.addColorStop(0, '#ff6b7f');
      grad.addColorStop(0.7, '#e94560');
      grad.addColorStop(1, '#c73a52');
    } else {
      grad.addColorStop(0, '#4a4a4a');
      grad.addColorStop(0.7, '#2d2d2d');
      grad.addColorStop(1, '#1a1a1a');
    }
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = color === 'red' ? '#a02040' : '#444';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = color === 'red' ? 'rgba(255,180,190,0.35)' : 'rgba(150,150,150,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Specular highlight
    ctx.beginPath();
    ctx.ellipse(px - radius * 0.15, py - radius * 0.2, radius * 0.3, radius * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = color === 'red' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
    ctx.fill();

    // Queen crown
    if (isQueen) {
      const cw = radius * 0.55;
      const ch = radius * 0.35;
      const cy = py - ch * 0.1;
      ctx.beginPath();
      ctx.moveTo(px - cw, cy + ch * 0.4);
      ctx.lineTo(px - cw, cy - ch * 0.3);
      ctx.lineTo(px - cw * 0.5, cy + ch * 0.1);
      ctx.lineTo(px, cy - ch * 0.5);
      ctx.lineTo(px + cw * 0.5, cy + ch * 0.1);
      ctx.lineTo(px + cw, cy - ch * 0.3);
      ctx.lineTo(px + cw, cy + ch * 0.4);
      ctx.closePath();
      const crownGrad = ctx.createLinearGradient(px, cy - ch * 0.5, px, cy + ch * 0.4);
      crownGrad.addColorStop(0, '#ffe066');
      crownGrad.addColorStop(1, '#b8860b');
      ctx.fillStyle = crownGrad;
      ctx.fill();
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // Gems
      const gx = [px - cw, px, px + cw];
      const gy = [cy - ch * 0.3, cy - ch * 0.5, cy - ch * 0.3];
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(gx[i], gy[i], radius * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = i === 1 ? '#ff4444' : '#4488ff';
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawBoard() {
    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);
    const flip = myColor === 'black';

    // Board texture
    if (boardTextureCanvas && boardTextureCanvas.width === BOARD_PX) {
      if (flip) {
        ctx.save();
        ctx.translate(BOARD_PX, BOARD_PX);
        ctx.rotate(Math.PI);
        ctx.drawImage(boardTextureCanvas, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(boardTextureCanvas, 0, 0);
      }
    } else {
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
          const dr = flip ? 7 - r : r;
          const dc = flip ? 7 - c : c;
          ctx.fillStyle = (r + c) % 2 === 0 ? '#c8b078' : '#6b8e4e';
          ctx.fillRect(dc * CELL, dr * CELL, CELL, CELL);
        }
    }

    // Last move highlight
    if (lastMove && !introAnim) {
      ctx.fillStyle = 'rgba(100, 180, 255, 0.22)';
      const fr = flip ? 7 - lastMove.fromRow : lastMove.fromRow;
      const fc = flip ? 7 - lastMove.fromCol : lastMove.fromCol;
      const tr = flip ? 7 - lastMove.toRow : lastMove.toRow;
      const tc = flip ? 7 - lastMove.toCol : lastMove.toCol;
      ctx.fillRect(fc * CELL, fr * CELL, CELL, CELL);
      ctx.fillRect(tc * CELL, tr * CELL, CELL, CELL);
    }

    // Highlight selected
    if (selectedPiece) {
      const sr = flip ? 7 - selectedPiece.row : selectedPiece.row;
      const sc = flip ? 7 - selectedPiece.col : selectedPiece.col;
      ctx.fillStyle = 'rgba(255,255,100,0.45)';
      ctx.fillRect(sc * CELL, sr * CELL, CELL, CELL);
    }

    // Hover highlight
    if (hoveredCell && !selectedPiece && !animating && !game.gameOver) {
      const piece = game.at(hoveredCell.row, hoveredCell.col);
      if (piece && piece.color === myColor && game.currentPlayer === myColor) {
        const hr = flip ? 7 - hoveredCell.row : hoveredCell.row;
        const hc = flip ? 7 - hoveredCell.col : hoveredCell.col;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(hc * CELL, hr * CELL, CELL, CELL);
      }
    }

    // Valid move indicators
    for (const m of validMoves) {
      const mr = flip ? 7 - m.toRow : m.toRow;
      const mc = flip ? 7 - m.toCol : m.toCol;
      const cx = mc * CELL + CELL / 2;
      const cy = mr * CELL + CELL / 2;
      if (m.captured.length > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(233,69,96,0.45)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(233,69,96,0.5)';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,100,0.5)';
        ctx.fill();
      }
    }

    // Trail (during slide animation)
    for (const t of trail) {
      drawPiece(t.x, t.y, t.color, t.queen, t.alpha);
    }

    // Pieces
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (moveAnimState && r === moveAnimState.destRow && c === moveAnimState.destCol) continue;
        const piece = game.at(r, c);
        if (!piece) continue;

        const dr = flip ? 7 - r : r;
        const dc = flip ? 7 - c : c;

        // Intro animation
        if (introAnim) {
          const elapsed = performance.now() - introAnim.startTime;
          const pieceDelay = (dr + dc) * 35;
          const pieceProgress = Math.max(0, Math.min(1, (elapsed - pieceDelay) / 300));
          if (pieceProgress <= 0) continue;
          const targetY = dr * CELL + CELL / 2;
          const startY = -CELL;
          const eased = 1 - Math.pow(1 - pieceProgress, 3);
          const currentY = startY + (targetY - startY) * eased;
          drawPiece(dc * CELL + CELL / 2, currentY, piece.color, piece.queen, pieceProgress);
          continue;
        }

        drawPiece(dc * CELL + CELL / 2, dr * CELL + CELL / 2, piece.color, piece.queen);
      }
    }

    // Captured overlay (during slide, before shatter)
    for (const cap of capturedOverlay) {
      const cr = flip ? 7 - cap.row : cap.row;
      const cc = flip ? 7 - cap.col : cap.col;
      drawPiece(cc * CELL + CELL / 2, cr * CELL + CELL / 2, cap.color, cap.queen);
    }

    // Shatter particles
    for (const p of shatterParticles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    // Scatter particles (resign/disconnect)
    for (const p of scatterParticles) {
      drawPiece(p.x, p.y, p.color, p.queen, Math.max(0, p.life));
    }

    // Promotion glow
    if (promotionGlow) {
      const pr = flip ? 7 - promotionGlow.row : promotionGlow.row;
      const pc = flip ? 7 - promotionGlow.col : promotionGlow.col;
      const gpx = pc * CELL + CELL / 2;
      const gpy = pr * CELL + CELL / 2;
      const elapsed = performance.now() - promotionGlow.startTime;
      const t = Math.min(elapsed / promotionGlow.duration, 1);
      ctx.save();
      // Expanding ring
      const alpha = (1 - t) * 0.6;
      const glowRadius = CELL * 0.38 + CELL * 0.4 * t;
      ctx.beginPath();
      ctx.arc(gpx, gpy, glowRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Inner flash
      ctx.beginPath();
      ctx.arc(gpx, gpy, CELL * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 0, ${(1 - t) * 0.3})`;
      ctx.fill();
      // Rising sparkles
      if (t < 0.7) {
        const sparkleT = t / 0.7;
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i / 5) - Math.PI / 2;
          const dist = CELL * 0.3 * sparkleT;
          const sx = gpx + Math.cos(angle) * dist;
          const sy = gpy + Math.sin(angle) * dist - CELL * 0.15 * sparkleT;
          ctx.beginPath();
          ctx.arc(sx, sy, CELL * 0.04 * (1 - sparkleT), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 215, 0, ${(1 - sparkleT) * 0.8})`;
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // ---- animation system ----
  function gatherAnimInfo(fromRow, fromCol, toRow, toCol) {
    const piece = game.at(fromRow, fromCol);
    const moves = game.getValidMovesFor(fromRow, fromCol);
    const move = moves.find(m => m.toRow === toRow && m.toCol === toCol);
    if (!piece || !move) return null;
    return {
      fromRow, fromCol, toRow, toCol,
      pieceColor: piece.color,
      pieceQueen: piece.queen,
      captured: move.captured.map(cap => {
        const cp = game.at(cap.row, cap.col);
        return { row: cap.row, col: cap.col, color: cp.color, queen: cp.queen };
      })
    };
  }

  function animateSlide(info) {
    return new Promise(resolve => {
      const flip = myColor === 'black';
      const fdr = flip ? 7 - info.fromRow : info.fromRow;
      const fdc = flip ? 7 - info.fromCol : info.fromCol;
      const tdr = flip ? 7 - info.toRow : info.toRow;
      const tdc = flip ? 7 - info.toCol : info.toCol;
      const fromX = fdc * CELL + CELL / 2;
      const fromY = fdr * CELL + CELL / 2;
      const toX = tdc * CELL + CELL / 2;
      const toY = tdr * CELL + CELL / 2;
      const duration = 200;
      const startTime = performance.now();

      moveAnimState = { destRow: info.toRow, destCol: info.toCol };
      capturedOverlay = info.captured;
      trail = [];
      let lastTrailTime = 0;

      function tick(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const curX = fromX + (toX - fromX) * eased;
        const curY = fromY + (toY - fromY) * eased;

        // Trail
        if (now - lastTrailTime > 20 && t > 0.05) {
          trail.push({ x: curX, y: curY, color: info.pieceColor, queen: info.pieceQueen, alpha: 0.2 });
          lastTrailTime = now;
          if (trail.length > 6) trail.shift();
        }
        for (let i = 0; i < trail.length; i++) {
          trail[i].alpha = 0.12 * (i + 1) / trail.length;
        }

        drawBoard();
        drawPiece(curX, curY, info.pieceColor, info.pieceQueen);

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          moveAnimState = null;
          capturedOverlay = [];
          trail = [];
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  function spawnShatter(px, py, color) {
    const base = color === 'red' ? [233, 69, 96] : [45, 45, 45];
    const accent = color === 'red' ? [255, 138, 158] : [119, 119, 119];
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i / 14) + (Math.random() - 0.5) * 0.5;
      const speed = 80 + Math.random() * 180;
      const size = CELL * (0.04 + Math.random() * 0.08);
      const useAccent = Math.random() > 0.6;
      const src = useAccent ? accent : base;
      const r = Math.min(255, Math.max(0, src[0] + (Math.random() - 0.5) * 50));
      const g = Math.min(255, Math.max(0, src[1] + (Math.random() - 0.5) * 50));
      const b = Math.min(255, Math.max(0, src[2] + (Math.random() - 0.5) * 50));
      shatterParticles.push({
        x: px, y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40 - Math.random() * 60,
        size,
        color: `rgb(${r|0},${g|0},${b|0})`,
        life: 1,
        decay: 1.5 + Math.random() * 1,
        gravity: 300 + Math.random() * 150,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12
      });
    }
  }

  function animateEffects() {
    return new Promise(resolve => {
      let lastTime = performance.now();
      function tick(now) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        for (const p of shatterParticles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += p.gravity * dt;
          p.life -= p.decay * dt;
          p.rotation += p.rotSpeed * dt;
          p.size *= 0.98;
        }
        shatterParticles = shatterParticles.filter(p => p.life > 0);
        let promoActive = false;
        if (promotionGlow) {
          if (performance.now() - promotionGlow.startTime >= promotionGlow.duration) {
            promotionGlow = null;
          } else {
            promoActive = true;
          }
        }
        drawBoard();
        if (shatterParticles.length > 0 || promoActive) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  async function performAnimatedMove(fromRow, fromCol, toRow, toCol) {
    const info = gatherAnimInfo(fromRow, fromCol, toRow, toCol);
    const result = game.makeMove(fromRow, fromCol, toRow, toCol);
    if (!result) return null;

    // Track last move
    lastMove = { fromRow, fromCol, toRow, toCol };

    // Track captured pieces
    if (info && info.captured.length > 0) {
      for (const cap of info.captured) {
        capturedPieces[info.pieceColor].push({ color: cap.color, queen: cap.queen });
      }
      renderCapturedTray();
    }

    // Move history
    if (info) {
      addMoveToHistory(fromRow, fromCol, toRow, toCol, info.captured, info.pieceColor);
    }

    // Animate
    if (info) {
      animating = true;
      await animateSlide(info);

      if (info.captured.length > 0) {
        const flip = myColor === 'black';
        for (const cap of info.captured) {
          const cr = flip ? 7 - cap.row : cap.row;
          const cc = flip ? 7 - cap.col : cap.col;
          spawnShatter(cc * CELL + CELL / 2, cr * CELL + CELL / 2, cap.color);
        }
        triggerScreenShake(info.captured.length > 1 ? 6 : 3);
      }

      if (result.promoted) {
        promotionGlow = {
          row: toRow, col: toCol,
          startTime: performance.now(),
          duration: 600
        };
      }

      if (shatterParticles.length > 0 || promotionGlow) {
        await animateEffects();
      }
      animating = false;
    }

    return result;
  }

  // ---- hover system ----
  canvas.addEventListener('mousemove', e => {
    if (game.gameOver || animating || botThinking) {
      if (hoveredCell) { hoveredCell = null; if (!animating) drawBoard(); }
      canvas.style.cursor = 'default';
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const flip = myColor === 'black';
    let col = Math.floor(x / CELL);
    let row = Math.floor(y / CELL);
    if (col < 0 || col > 7 || row < 0 || row > 7) return;
    if (flip) { row = 7 - row; col = 7 - col; }

    const piece = game.at(row, col);
    const isValidTarget = validMoves.some(m => m.toRow === row && m.toCol === col);
    canvas.style.cursor = (piece && piece.color === myColor && game.currentPlayer === myColor) || isValidTarget
      ? 'pointer' : 'default';

    const newHovered = (piece && piece.color === myColor) ? { row, col } : null;
    if (hoveredCell?.row !== newHovered?.row || hoveredCell?.col !== newHovered?.col) {
      hoveredCell = newHovered;
      if (!animating) drawBoard();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (hoveredCell) {
      hoveredCell = null;
      canvas.style.cursor = 'default';
      if (!animating) drawBoard();
    }
  });

  // ---- intro animation ----
  function playIntroAnimation() {
    introAnim = { startTime: performance.now() };
    animating = true;
    function tick() {
      const elapsed = performance.now() - introAnim.startTime;
      drawBoard();
      if (elapsed < 950) {
        requestAnimationFrame(tick);
      } else {
        introAnim = null;
        animating = false;
        drawBoard();
      }
    }
    requestAnimationFrame(tick);
  }

  // ---- screen shake ----
  function triggerScreenShake(intensity, duration) {
    intensity = intensity || 4;
    duration = duration || 250;
    const start = performance.now();
    const container = canvas.parentElement;
    function shake(now) {
      const t = (now - start) / duration;
      if (t >= 1) {
        container.style.transform = '';
        return;
      }
      const decay = 1 - t;
      const sx = (Math.random() - 0.5) * 2 * intensity * decay;
      const sy = (Math.random() - 0.5) * 2 * intensity * decay;
      container.style.transform = `translate(${sx}px, ${sy}px)`;
      requestAnimationFrame(shake);
    }
    requestAnimationFrame(shake);
  }

  // ---- confetti ----
  function startConfetti() {
    confettiParticles = [];
    const colors = ['#ffd700', '#e94560', '#4caf50', '#2196f3', '#ff9800', '#e040fb', '#00e5ff'];
    for (let i = 0; i < 150; i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: -20 - Math.random() * 400,
        w: 6 + Math.random() * 8,
        h: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: 1.5 + Math.random() * 3,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.02 + Math.random() * 0.03
      });
    }
    function tick() {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;
      for (const p of confettiParticles) {
        p.x += p.vx + Math.sin(p.sway) * 0.5;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.sway += p.swaySpeed;
        if (p.y < confettiCanvas.height + 20) {
          alive = true;
          confettiCtx.save();
          confettiCtx.translate(p.x, p.y);
          confettiCtx.rotate(p.rotation);
          confettiCtx.fillStyle = p.color;
          confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          confettiCtx.restore();
        }
      }
      if (alive) {
        confettiAnimId = requestAnimationFrame(tick);
      } else {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiAnimId = null;
      }
    }
    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
    confettiAnimId = requestAnimationFrame(tick);
  }

  function stopConfetti() {
    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
      confettiAnimId = null;
    }
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles = [];
  }

  // ---- scatter (resign/disconnect) ----
  function scatterPieces() {
    return new Promise(resolve => {
      scatterParticles = [];
      const flip = myColor === 'black';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = game.at(r, c);
          if (!piece) continue;
          const dr = flip ? 7 - r : r;
          const dc = flip ? 7 - c : c;
          const px = dc * CELL + CELL / 2;
          const py = dr * CELL + CELL / 2;
          const angle = Math.atan2(py - BOARD_PX / 2, px - BOARD_PX / 2) + (Math.random() - 0.5) * 0.5;
          const speed = 200 + Math.random() * 300;
          scatterParticles.push({
            x: px, y: py,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 100,
            color: piece.color,
            queen: piece.queen,
            life: 1,
            decay: 0.8 + Math.random() * 0.4,
            gravity: 400
          });
          game.board[r][c] = null;
        }
      }
      if (scatterParticles.length === 0) { resolve(); return; }

      animating = true;
      let lastTime = performance.now();
      function tick(now) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        for (const p of scatterParticles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += p.gravity * dt;
          p.life -= p.decay * dt;
        }
        scatterParticles = scatterParticles.filter(p => p.life > 0);
        drawBoard();
        if (scatterParticles.length > 0) {
          requestAnimationFrame(tick);
        } else {
          animating = false;
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  // ---- captured pieces tray ----
  function renderCapturedTray() {
    const topColor = myColor === 'red' ? 'black' : 'red';
    const bottomColor = myColor;
    const topEl = document.getElementById('topCaptured');
    const bottomEl = document.getElementById('bottomCaptured');
    topEl.innerHTML = '';
    bottomEl.innerHTML = '';
    for (const cap of capturedPieces[topColor]) {
      const dot = document.createElement('div');
      dot.className = 'cap-piece ' + cap.color;
      if (cap.queen) dot.classList.add('queen');
      topEl.appendChild(dot);
    }
    for (const cap of capturedPieces[bottomColor]) {
      const dot = document.createElement('div');
      dot.className = 'cap-piece ' + cap.color;
      if (cap.queen) dot.classList.add('queen');
      bottomEl.appendChild(dot);
    }
  }

  // ---- move history ----
  function toNotation(row, col) {
    return 'abcdefgh'[col] + (8 - row);
  }

  function addMoveToHistory(fromRow, fromCol, toRow, toCol, captured, color) {
    const from = toNotation(fromRow, fromCol);
    const to = toNotation(toRow, toCol);
    moveLog.push({
      num: ++moveNumber,
      color,
      text: `${from}${captured.length > 0 ? '\u00d7' : '\u2192'}${to}`
    });
    renderMoveHistory();
  }

  function renderMoveHistory() {
    const el = document.getElementById('moveHistory');
    el.innerHTML = '';
    const recent = moveLog.slice(-10);
    for (const m of recent) {
      const div = document.createElement('div');
      div.className = 'move-entry';
      div.innerHTML = `<span class="move-dot ${m.color}"></span><span class="move-text">${m.text}</span>`;
      el.appendChild(div);
    }
    el.scrollLeft = el.scrollWidth;
  }

  // ---- input ----
  canvas.addEventListener('click', e => {
    if (game.gameOver || botThinking || animating) return;
    if (game.currentPlayer !== myColor) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const flip = myColor === 'black';
    let col = Math.floor(x / CELL);
    let row = Math.floor(y / CELL);
    if (flip) { row = 7 - row; col = 7 - col; }

    const moveTarget = validMoves.find(m => m.toRow === row && m.toCol === col);
    if (moveTarget && selectedPiece) {
      executeMove(selectedPiece.row, selectedPiece.col, row, col);
      return;
    }

    const piece = game.at(row, col);
    if (piece && piece.color === myColor) {
      const moves = game.getValidMovesFor(row, col);
      if (moves.length > 0) {
        selectedPiece = { row, col };
        validMoves = moves;
      } else {
        selectedPiece = null;
        validMoves = [];
      }
    } else {
      selectedPiece = null;
      validMoves = [];
    }
    drawBoard();
  });

  async function executeMove(fromRow, fromCol, toRow, toCol) {
    if (mode !== 'bot') {
      sendMsg({ type: 'move', fromRow, fromCol, toRow, toCol });
    }

    const result = await performAnimatedMove(fromRow, fromCol, toRow, toCol);
    if (!result) return;

    if (result.chainContinues) {
      selectedPiece = { row: toRow, col: toCol };
      validMoves = game.getValidMovesFor(toRow, toCol);
    } else {
      selectedPiece = null;
      validMoves = [];
    }

    drawBoard();
    updateUI();

    if (game.gameOver) {
      endGame();
      return;
    }

    if (mode === 'bot' && game.currentPlayer !== myColor) {
      botTurn();
    }
  }

  function botTurn() {
    botThinking = true;
    setStatus('The Colonel is thinking...');
    setTimeout(() => {
      playBotMove();
    }, 400 + Math.random() * 600);
  }

  async function playBotMove() {
    if (game.gameOver) { botThinking = false; return; }
    const move = botInstance.chooseMove(game);
    if (!move) { botThinking = false; return; }
    const result = await performAnimatedMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    if (!result) { botThinking = false; return; }

    selectedPiece = null;
    validMoves = [];
    drawBoard();
    updateUI();

    if (game.gameOver) {
      botThinking = false;
      endGame();
      return;
    }

    if (result.chainContinues) {
      setTimeout(() => playBotMove(), 300);
    } else {
      botThinking = false;
      updateUI();
    }
  }

  // ---- end game ----
  function endGame() {
    clearInterval(timerInterval);
    const winner = game.winner;
    showGameOver(winner);

    const winnerIsMe = winner === myColor;
    let winnerN, loserN, winnerBot, loserBot;
    if (mode === 'bot') {
      winnerN = winnerIsMe ? playerName : botInstance.name;
      loserN = winnerIsMe ? botInstance.name : playerName;
      winnerBot = !winnerIsMe;
      loserBot = winnerIsMe;
    } else {
      winnerN = winnerIsMe ? playerName : opponentName;
      loserN = winnerIsMe ? opponentName : playerName;
      winnerBot = false;
      loserBot = false;
    }
    recordResult(winnerN, loserN, winnerBot, loserBot);
  }

  function showGameOver(winner) {
    const overlay = document.getElementById('gameOverOverlay');
    const winnerIsMe = winner === myColor;
    document.getElementById('gameOverTitle').textContent = winnerIsMe ? 'Victory!' : 'Defeat';
    document.getElementById('gameOverTitle').style.color = winnerIsMe ? '#4caf50' : '#e94560';
    const oppName = mode === 'bot' ? botInstance.name : opponentName;
    document.getElementById('gameOverResult').textContent =
      winnerIsMe ? `You defeated ${oppName}` : `${oppName} wins`;
    overlay.classList.add('active');
    if (winnerIsMe) {
      startConfetti();
    }
  }

  document.getElementById('gameOverLobbyBtn').onclick = () => {
    document.getElementById('gameOverOverlay').classList.remove('active');
    stopConfetti();
    enterLobby();
  };

  document.getElementById('gameOverRematchBtn').onclick = () => {
    document.getElementById('gameOverOverlay').classList.remove('active');
    stopConfetti();
    if (mode === 'bot') {
      startBotGame();
    } else if (conn && conn.open) {
      sendMsg({ type: 'start', name: playerName, color: myColor === 'red' ? 'black' : 'red' });
      myColor = myColor === 'red' ? 'black' : 'red';
      startOnlineGame();
    } else {
      enterLobby();
    }
  };

  document.getElementById('resignBtn').onclick = () => {
    if (game.gameOver || animating) return;
    document.getElementById('resignOverlay').classList.add('active');
  };

  document.getElementById('resignNo').onclick = () => {
    document.getElementById('resignOverlay').classList.remove('active');
  };

  document.getElementById('resignYes').onclick = async () => {
    document.getElementById('resignOverlay').classList.remove('active');
    if (game.gameOver || animating) return;
    game.gameOver = true;
    game.winner = myColor === 'red' ? 'black' : 'red';
    if (mode !== 'bot') sendMsg({ type: 'resign' });
    await scatterPieces();
    endGame();
  };

  // ---- cleanup ----
  function cleanup() {
    clearInterval(timerInterval);
    if (conn) { try { conn.close(); } catch {} conn = null; }
    if (peer) { try { peer.destroy(); } catch {} peer = null; }
    selectedPiece = null;
    validMoves = [];
    botThinking = false;
    opponentName = '';
    animating = false;
    moveAnimState = null;
    shatterParticles = [];
    capturedOverlay = [];
    promotionGlow = null;
    lastMove = null;
    hoveredCell = null;
    introAnim = null;
    trail = [];
    scatterParticles = [];
    capturedPieces = { red: [], black: [] };
    moveLog = [];
    moveNumber = 0;
    prevTurn = null;
    prevMyTime = TURN_TIME;
    stopConfetti();
  }

  // ---- init ----
  window.addEventListener('resize', resizeBoard);

  const lb = getLeaderboard();
  if (!lb.find(e => e.name === 'The Colonel')) {
    lb.push({ name: 'The Colonel', wins: 0, losses: 0, isBot: true });
    saveLeaderboard(lb);
  }

  // Suppress fade transition on initial load
  document.body.classList.add('no-transition');
  if (playerName) {
    enterLobby();
  } else {
    showScreen('nameScreen');
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('no-transition');
    });
  });
})();
