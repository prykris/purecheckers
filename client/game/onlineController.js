import { getSocket } from '../lib/socket.js';

let currentGameId = null;
let myColor = null;
let onMatchFound = null;
let onGameStart = null;
let onMoved = null;
let onMoveRejected = null;
let onGameOver = null;
let onTick = null;
let onOpponentDisconnected = null;
let onRematchRequested = null;
let onRematchAccepted = null;

export function initOnlineListeners() {
  const socket = getSocket();
  if (!socket) return;

  socket.on('matchmaking:found', (data) => {
    currentGameId = data.gameId;
    myColor = data.yourColor;
    if (onMatchFound) onMatchFound(data);
  });

  socket.on('game:start', (data) => {
    if (onGameStart) onGameStart(data);
  });

  socket.on('game:moved', (data) => {
    if (onMoved) onMoved(data);
  });

  socket.on('game:move-rejected', (data) => {
    console.warn('Move rejected:', data.reason);
    if (onMoveRejected) onMoveRejected(data);
  });

  socket.on('game:over', (data) => {
    if (onGameOver) onGameOver(data);
  });

  socket.on('game:tick', (data) => {
    if (onTick) onTick(data);
  });

  socket.on('game:opponent-disconnected', (data) => {
    if (onOpponentDisconnected) onOpponentDisconnected(data);
  });

  socket.on('game:rematch-requested', (data) => {
    if (onRematchRequested) onRematchRequested(data);
  });

  socket.on('game:rematch-accepted', (data) => {
    currentGameId = data.newGameId;
    if (onRematchAccepted) onRematchAccepted(data);
  });

  socket.on('game:sync', (data) => {
    // Full state sync on reconnect
    if (onGameStart) onGameStart(data);
  });
}

export function joinMatchmaking(elo) {
  getSocket()?.emit('matchmaking:join', { elo });
}

export function leaveMatchmaking() {
  getSocket()?.emit('matchmaking:leave');
}

export function sendMove(fromRow, fromCol, toRow, toCol) {
  getSocket()?.emit('game:move', {
    gameId: currentGameId,
    fromRow, fromCol, toRow, toCol
  });
}

export function sendResign() {
  getSocket()?.emit('game:resign', { gameId: currentGameId });
}

export function requestRematch() {
  getSocket()?.emit('game:rematch-request', { gameId: currentGameId });
}

export function requestSync() {
  getSocket()?.emit('game:sync', { gameId: currentGameId });
}

export function getMyColor() { return myColor; }
export function getGameId() { return currentGameId; }
export function setMyColor(c) { myColor = c; }
export function setGameId(id) { currentGameId = id; }

// Event handler setters
export function onMatch(fn) { onMatchFound = fn; }
export function onStart(fn) { onGameStart = fn; }
export function onMove(fn) { onMoved = fn; }
export function onReject(fn) { onMoveRejected = fn; }
export function onOver(fn) { onGameOver = fn; }
export function onTimerTick(fn) { onTick = fn; }
export function onDisconnect(fn) { onOpponentDisconnected = fn; }
export function onRematchRequest(fn) { onRematchRequested = fn; }
export function onRematchAccept(fn) { onRematchAccepted = fn; }
