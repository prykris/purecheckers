/**
 * PhantomPlayer — a single phantom's socket connection and game logic.
 *
 * Connects to the server via socket.io-client, handles game play by
 * mirroring the CheckersGame state locally and computing moves with minimax.
 */

import { io as ioClient } from 'socket.io-client';
import { CheckersGame } from '../shared/game.js';
import { MOVE_SPEEDS, rand } from './personality.js';
import { generateChat } from './chat.js';

// ---- In-game emotes (subset available to all players, no shop purchase needed) ----
const FREE_EMOTES = [
  { emoji: '🤝', label: 'GG' },
  { emoji: '🤔', label: 'Hmm...' },
  { emoji: '👏', label: 'Nice!' },
  { emoji: '👋', label: 'Hi!' },
];

// ---- In-game chat templates by situation ----
const GAME_CHAT = {
  game_start: ['gl hf', 'good luck!', 'lets go', 'hi gl', 'glhf'],
  my_capture: ['nice', 'lets gooo', 'haha', 'gotcha'],
  got_captured: ['oh no', 'nooo', 'oof', 'wait what', 'bruh'],
  my_king: ['yesss', 'king me!', 'finally', 'crown time'],
  opponent_king: ['ugh', 'oh no', 'noo', 'hmm'],
  winning: ['gg', 'almost there', 'one more'],
  losing: ['gg', 'wp', 'nice game'],
};

// ---- Minimax AI (copied from server/services/botPlayer.js, pure logic) ----

function finishChain(game) {
  while (game.chainPiece) {
    const moves = game.getAllValidMoves();
    if (moves.length === 0) break;
    game.makeMove(moves[0].fromRow, moves[0].fromCol, moves[0].toRow, moves[0].toCol);
  }
}

function minimax(game, depth, alpha, beta, maximizing, botColor) {
  if (depth === 0 || game.gameOver) return game.evaluate(botColor);
  const moves = game.getAllValidMoves();
  if (moves.length === 0) return game.evaluate(botColor);

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const sim = game.clone();
      sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      finishChain(sim);
      const ev = minimax(sim, depth - 1, alpha, beta, false, botColor);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const sim = game.clone();
      sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      finishChain(sim);
      const ev = minimax(sim, depth - 1, alpha, beta, true, botColor);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function chooseBotMove(game, depth) {
  const moves = game.getAllValidMoves();
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const botColor = game.currentPlayer;
  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of moves) {
    const sim = game.clone();
    sim.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    finishChain(sim);
    const score = minimax(sim, depth - 1, -Infinity, Infinity, false, botColor);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ---- PhantomPlayer ----

export class PhantomPlayer {
  /**
   * @param {object} personality - profile from personality.js
   * @param {string} jwt - auth token
   * @param {string} serverUrl - e.g. http://localhost:3001
   */
  constructor(personality, jwt, serverUrl) {
    this.p = personality;
    this.jwt = jwt;
    this.serverUrl = serverUrl;

    this.socket = null;
    this.connected = false;
    this.userId = null;

    // Game state
    this.localGame = null;
    this.myColor = null;
    this.gameId = null;
    this.moveTimer = null;
    this.moveCount = 0;
    this.movesSinceCapture = 0; // stalemate detection

    // Phase tracking (mirrors server phases)
    this.phase = 'offline'; // offline | idle | matchmaking | in-room | in-game

    // Room tracking
    this.currentRoomId = null;

    // Cooldowns
    this.lastActionTime = 0;
    this.lastChatTime = 0;
    this.lastGameChatTime = 0;
    this.lastEmoteTime = 0;

    // Event callbacks (set by brain.js)
    this.onPhaseChange = null;
    this.onPresenceStats = null;
    this.onChatMessage = null;
    this.onGameEnded = null;
    this.onRoomUpdate = null;

    // Recent chat buffer for LLM context
    this.recentChat = [];

    // Chat config (set by PhantomManager after construction)
    this.chatConfig = null;
  }

  get name() {
    return this.p.username;
  }

  get isIdle() {
    return this.connected && this.phase === 'idle';
  }

  get isInGame() {
    return this.phase === 'in-game';
  }

  canAct() {
    return this.isIdle && (Date.now() - this.lastActionTime > this.p.actionDelay[0] * 1000);
  }

  // ---- Connection lifecycle ----

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = ioClient(this.serverUrl, {
        auth: { token: this.jwt },
        transports: ['websocket'],
        reconnection: false,
      });

      const timeout = setTimeout(() => {
        this.socket.disconnect();
        reject(new Error(`${this.name}: connection timeout`));
      }, 10000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        console.log(`[Phantom] ${this.name} connected`);
      });

      let resolved = false;
      this.socket.on('sync:state', (data) => {
        if (!resolved) {
          resolved = true;
          this.phase = data.phase || 'idle';

          // If reconnecting into an active game, restore state
          if (data.phase === 'in-game' && data.game) {
            this._recoverGame(data.game);
          }

          resolve();
        }
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this._setupListeners();
    });
  }

  disconnect() {
    if (this.moveTimer) {
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.phase = 'offline';
    this.localGame = null;
    this.myColor = null;
    this.gameId = null;
    this.currentRoomId = null;
    this.moveCount = 0;
    console.log(`[Phantom] ${this.name} disconnected`);
    this._firePhaseChange('offline');
  }

  // ---- Socket event listeners ----

  _setupListeners() {
    const s = this.socket;

    // Presence
    s.on('presence:stats', (stats) => {
      if (this.onPresenceStats) this.onPresenceStats(this, stats);
    });

    // Global chat
    s.on('chat:message', (msg) => {
      if (msg.channelId === 'global' || !msg.channelId) {
        this.recentChat.push({ username: msg.username, content: msg.content });
        if (this.recentChat.length > 10) this.recentChat.shift();
        if (this.onChatMessage) this.onChatMessage(this, msg);
      }
    });

    // Global game ended
    s.on('global:game-ended', (data) => {
      if (this.onGameEnded) this.onGameEnded(this, data);
    });

    // Room events
    s.on('room:list-update', (data) => {
      if (this.onRoomUpdate) this.onRoomUpdate(this, data);
    });
    s.on('room:updated', (data) => {
      if (this.onRoomUpdate) this.onRoomUpdate(this, data);
    });

    // Matchmaking
    s.on('matchmaking:found', (data) => {
      this.gameId = data.gameId;
      this.myColor = data.yourColor;
      this.phase = 'in-game';
      this.moveCount = 0;
      console.log(`[Phantom] ${this.name} matched! Game ${data.gameId} as ${data.yourColor} vs ${data.opponent?.username}`);
      this._firePhaseChange('in-game');
    });

    s.on('matchmaking:joined', () => {
      this.phase = 'matchmaking';
      console.log(`[Phantom] ${this.name} joined matchmaking`);
      this._firePhaseChange('matchmaking');
    });

    s.on('matchmaking:left', () => {
      if (this.phase === 'matchmaking') {
        this.phase = 'idle';
        this._firePhaseChange('idle');
      }
    });

    // Room lifecycle
    s.on('room:created', (data) => {
      this.currentRoomId = data.room?.id || data.roomId;
      this.phase = 'in-room';
      console.log(`[Phantom] ${this.name} created room ${this.currentRoomId}`);
      this._firePhaseChange('in-room');
    });

    s.on('room:joined', (data) => {
      this.currentRoomId = data.room?.id || data.roomId;
      this.phase = 'in-room';
      console.log(`[Phantom] ${this.name} joined room ${this.currentRoomId}`);
      this._firePhaseChange('in-room');
    });

    s.on('room:kicked', () => {
      this.phase = 'idle';
      this.currentRoomId = null;
      this._firePhaseChange('idle');
    });

    // Game events
    s.on('game:start', (data) => {
      this.localGame = new CheckersGame();
      if (data.redTime) this.localGame.redTime = data.redTime;
      if (data.blackTime) this.localGame.blackTime = data.blackTime;
      this.gameId = data.gameId;
      this.phase = 'in-game';
      this.moveCount = 0;
      this.movesSinceCapture = 0;
      this.lastGameChatTime = 0;
      this.lastEmoteTime = 0;
      console.log(`[Phantom] ${this.name} game started ${data.gameId}`);

      // Opening chat/emote
      setTimeout(() => {
        this._maybeGameChat('game_start');
        this._maybeEmote('game_start');
      }, rand(1000, 3000));

      // If we move first, schedule a move
      if (this.localGame.currentPlayer === this.myColor) {
        this._scheduleMove();
      }
    });

    s.on('game:moved', (data) => {
      if (!this.localGame) return;

      // Track who moved (before applying — currentPlayer is the mover)
      const moverColor = this.localGame.currentPlayer;
      const wasMyMove = moverColor === this.myColor;

      // Apply the move to our local mirror
      this.localGame.makeMove(data.fromRow, data.fromCol, data.toRow, data.toCol);
      this.moveCount++;

      // Track captures for stalemate detection
      if (data.captured && data.captured.length > 0) {
        this.movesSinceCapture = 0;
      } else {
        this.movesSinceCapture++;
      }

      // React to game events with chat/emotes
      if (data.captured && data.captured.length > 0) {
        if (wasMyMove) {
          this._maybeGameChat('my_capture');
          this._maybeEmote('my_capture');
        } else {
          this._maybeGameChat('got_captured');
          this._maybeEmote('got_captured');
        }
      }
      if (data.promoted) {
        if (wasMyMove) {
          this._maybeGameChat('my_king');
          this._maybeEmote('my_king');
        } else {
          this._maybeGameChat('opponent_king');
        }
      }

      // React to winning/losing position (after move 12+)
      if (this.moveCount > 12 && !data.chainContinues) {
        const score = this.localGame.evaluate(this.myColor);
        if (score > 8) {
          this._maybeGameChat('winning');
        } else if (score < -8) {
          this._maybeGameChat('losing');
        }
      }

      // If it's now our turn, schedule a move
      if (!this.localGame.gameOver && this.localGame.currentPlayer === this.myColor) {
        this._scheduleMove();
      }
    });

    // Game sync response (reconnect) — authoritative board state from server
    s.on('game:sync', (data) => {
      if (!this.gameId || !data.board) return;

      // Rebuild local game from server's authoritative state
      this.localGame = new CheckersGame();
      if (data.moveHistory && data.moveHistory.length > 0) {
        for (const move of data.moveHistory) {
          this.localGame.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        }
        this.moveCount = data.moveHistory.length;
      } else {
        this.localGame.board = data.board;
        if (data.currentPlayer) this.localGame.currentPlayer = data.currentPlayer;
        if (data.chainPiece) this.localGame.chainPiece = data.chainPiece;
      }
      if (data.redTime != null) this.localGame.redTime = data.redTime;
      if (data.blackTime != null) this.localGame.blackTime = data.blackTime;

      console.log(`[Phantom] ${this.name} synced game ${this.gameId} (move ${this.moveCount})`);

      // If it's our turn, resume playing
      if (!this.localGame.gameOver && this.localGame.currentPlayer === this.myColor) {
        this._scheduleMove();
      }
    });

    s.on('game:over', (data) => {
      console.log(`[Phantom] ${this.name} game over: ${data.result}`);
      if (this.moveTimer) {
        clearTimeout(this.moveTimer);
        this.moveTimer = null;
      }

      // Leave game after a delay
      const leaveDelay = rand(3000, 8000);
      setTimeout(() => {
        if (this.socket && this.gameId) {
          this.socket.emit('game:leave', { gameId: this.gameId });
        }
        this.localGame = null;
        this.myColor = null;
        this.gameId = null;
        this.currentRoomId = null;
        this.moveCount = 0;
        this.movesSinceCapture = 0;
        this.phase = 'idle';
        this.lastActionTime = Date.now();
        this._firePhaseChange('idle');
      }, leaveDelay);
    });

    s.on('session:kicked', () => {
      console.log(`[Phantom] ${this.name} was kicked (another session)`);
      this.disconnect();
    });

    s.on('disconnect', () => {
      this.connected = false;
      this.phase = 'offline';
    });
  }

  _firePhaseChange(newPhase) {
    if (this.onPhaseChange) this.onPhaseChange(this, newPhase);
  }

  // ---- Game recovery on reconnect ----

  _recoverGame(gameData) {
    this.gameId = gameData.gameId;
    this.myColor = gameData.yourColor;
    this.moveCount = 0;

    // Rebuild local game from the board state
    this.localGame = new CheckersGame();

    // If server gave us moveHistory, replay to reconstruct
    if (gameData.moveHistory && gameData.moveHistory.length > 0) {
      for (const move of gameData.moveHistory) {
        this.localGame.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        this.moveCount++;
      }
    } else if (gameData.board) {
      // Fallback: directly set the board (less accurate but works)
      this.localGame.board = gameData.board;
      if (gameData.currentPlayer) this.localGame.currentPlayer = gameData.currentPlayer;
      if (gameData.chainPiece) this.localGame.chainPiece = gameData.chainPiece;
    }

    if (gameData.redTime != null) this.localGame.redTime = gameData.redTime;
    if (gameData.blackTime != null) this.localGame.blackTime = gameData.blackTime;

    this.phase = 'in-game';
    console.log(`[Phantom] ${this.name} recovered game ${this.gameId} as ${this.myColor} (move ${this.moveCount})`);

    // Request full game sync from server to ensure we're aligned
    this.socket.emit('game:sync', { gameId: this.gameId });

    // If it's our turn, start playing
    if (!this.localGame.gameOver && this.localGame.currentPlayer === this.myColor) {
      this._scheduleMove();
    }

    this._firePhaseChange('in-game');
  }

  // ---- In-game chat & emotes ----

  async _maybeGameChat(situation) {
    if (!this.gameId || !this.socket) return;
    // Rate limit: one game chat per 15s, gated by chattiness
    const now = Date.now();
    if (now - this.lastGameChatTime < 15000) return;
    if (Math.random() > this.p.chattiness * 0.5) return;

    let msg = null;

    // Try LLM for more natural in-game chat
    if (this.chatConfig) {
      const situationMap = {
        game_start: 'starting a checkers game',
        my_capture: 'you just captured an opponent piece',
        got_captured: 'opponent just captured your piece',
        my_king: 'your piece just got kinged',
        opponent_king: 'opponent piece just got kinged',
        winning: 'you are winning the game',
        losing: 'you are losing the game',
      };
      msg = await generateChat(
        this.p, 'in_game', [],
        this.chatConfig, situationMap[situation] || situation
      );
    }

    // Fallback to templates
    if (!msg) {
      const pool = GAME_CHAT[situation];
      if (!pool) return;
      msg = pool[Math.floor(Math.random() * pool.length)];
    }

    this.lastGameChatTime = now;
    this.socket.emit('chat:send', { channelId: `game:${this.gameId}`, content: msg });
  }

  _maybeEmote(situation) {
    if (!this.gameId || !this.socket) return;
    // Rate limit: one emote per 10s, gated by chattiness
    const now = Date.now();
    if (now - this.lastEmoteTime < 10000) return;
    if (Math.random() > this.p.chattiness * 0.4) return;

    let emote;
    if (situation === 'my_capture' || situation === 'winning') {
      emote = FREE_EMOTES.find(e => e.label === 'Nice!' || e.label === 'GG');
    } else if (situation === 'my_king') {
      emote = FREE_EMOTES.find(e => e.label === 'GG');
    } else if (situation === 'got_captured' || situation === 'losing') {
      emote = FREE_EMOTES.find(e => e.label === 'Hmm...');
    } else if (situation === 'game_start') {
      emote = FREE_EMOTES.find(e => e.label === 'Hi!');
    }
    if (!emote) return;

    this.lastEmoteTime = now;
    this.socket.emit('emote:send', { gameId: this.gameId, emote });
  }

  // ---- Game play ----

  _scheduleMove() {
    if (this.moveTimer) clearTimeout(this.moveTimer);

    // Check resignation: losing position or stalemate (no captures for 30+ moves)
    if (this.moveCount >= 10) {
      const score = this.localGame.evaluate(this.myColor);
      const shouldResignScore = this.p.resignThreshold > -Infinity && score <= this.p.resignThreshold;
      const shouldResignStalemate = this.movesSinceCapture >= 30;

      if (shouldResignScore || shouldResignStalemate) {
        const resignDelay = rand(1000, 3000);
        const reason = shouldResignStalemate ? `stalemate (${this.movesSinceCapture} moves no capture)` : `score ${score}`;
        this.moveTimer = setTimeout(() => {
          console.log(`[Phantom] ${this.name} resigning (${reason})`);
          this._maybeGameChat('losing');
          this.socket.emit('game:resign', { gameId: this.gameId });
        }, resignDelay);
        return;
      }
    }

    // Calculate delay based on personality
    const isChain = this.localGame.chainPiece != null;
    let delay;
    if (isChain) {
      delay = rand(200, 500);
    } else {
      const [min, max] = MOVE_SPEEDS[this.p.moveSpeed] || MOVE_SPEEDS.normal;
      delay = rand(min, max);
    }

    this.moveTimer = setTimeout(() => {
      if (!this.localGame || this.localGame.gameOver) return;
      if (this.localGame.currentPlayer !== this.myColor) return;

      const move = chooseBotMove(this.localGame, this.p.skill);
      if (!move) return;

      this.socket.emit('game:move', {
        gameId: this.gameId,
        fromRow: move.fromRow,
        fromCol: move.fromCol,
        toRow: move.toRow,
        toCol: move.toCol,
      });
    }, delay);
  }

  // ---- Actions (called by brain) ----

  joinMatchmaking(elo) {
    if (this.phase !== 'idle') return false;
    this.lastActionTime = Date.now();
    this.socket.emit('matchmaking:join', { elo });
    return true;
  }

  leaveMatchmaking() {
    if (this.phase !== 'matchmaking') return false;
    this.socket.emit('matchmaking:leave');
    this.phase = 'idle';
    this._firePhaseChange('idle');
    return true;
  }

  createRoom() {
    if (this.phase !== 'idle') return false;
    this.lastActionTime = Date.now();
    const timers = [30, 60, 90];
    this.socket.emit('room:create', {
      buyIn: 0,
      turnTimer: timers[Math.floor(Math.random() * timers.length)],
      isPrivate: false,
      allowSpectators: true,
    });
    return true;
  }

  joinRoom(roomId) {
    if (this.phase !== 'idle') return false;
    this.lastActionTime = Date.now();
    this.socket.emit('room:join', { roomId });
    return true;
  }

  readyUp() {
    if (this.phase !== 'in-room' || !this.currentRoomId) return false;
    this.socket.emit('room:ready', { roomId: this.currentRoomId });
    return true;
  }

  leaveRoom() {
    if (this.phase !== 'in-room' || !this.currentRoomId) return false;
    this.socket.emit('room:leave', { roomId: this.currentRoomId });
    this.currentRoomId = null;
    this.phase = 'idle';
    this._firePhaseChange('idle');
    return true;
  }

  sendChat(channelId, content) {
    if (!this.socket || !this.connected) return false;
    this.lastChatTime = Date.now();
    this.socket.emit('chat:send', { channelId, content });
    return true;
  }

  requestRoomList() {
    return new Promise((resolve) => {
      if (!this.socket || !this.connected) return resolve([]);
      this.socket.emit('room:list', { filter: 'available' });
      // room:list response comes as a callback or event — listen once
      const handler = (data) => {
        resolve(data.rooms || data || []);
      };
      this.socket.once('room:list', handler);
      // Timeout fallback
      setTimeout(() => {
        this.socket.off('room:list', handler);
        resolve([]);
      }, 3000);
    });
  }
}
