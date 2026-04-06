import { CheckersGame } from '../../shared/game.js';
import { quickPlayPool } from '../services/quickPlay.js';
import { createQuickPlayRoom } from './roomHandler.js';
import { isBotUser, chooseBotMove, getBotDifficulty } from '../services/botPlayer.js';
import { analyzeMoveQuality } from '../services/moveAnalysis.js';
import { shouldEmote, getMoveTriggers, getAnalysisTriggers, cleanupGame as cleanupBotEmotes } from '../services/botEmotes.js';
import { connectedUsers, emitSyncState } from './index.js';
import { getSession, setPhase, forceIdle } from './userState.js';
import { calculateElo } from '../services/elo.js';
import { awardCoins } from '../services/coins.js';
import { COINS_RANKED_WIN, COINS_LOSS, RANKED_TAX_RATE, MAX_DAILY_WINS_VS_SAME } from '../../shared/constants.js';
import { calculateRankedPayout, depositToVault, awardDailyBounty, checkMilestones, isValidWager } from '../services/vault.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Active games: gameId -> GameRoom
export const activeGames = new Map();
// Pending friend game lobbies: code -> { hostId, hostSocket }
// Timestamp-based unique ID — never collides across restarts
let nextGameId = Date.now();

// Diminishing returns: track wins per (winner, loser) pair per day
// Key: "winnerId:loserId:YYYY-MM-DD" -> count
const dailyWinTracker = new Map();
// MAX_DAILY_WINS_VS_SAME imported from shared/constants.js

function getDailyWinKey(winnerId, loserId) {
  const d = new Date().toISOString().slice(0, 10);
  return `${winnerId}:${loserId}:${d}`;
}

function trackAndCheckDiminishing(winnerId, loserId) {
  if (MAX_DAILY_WINS_VS_SAME <= 0) return false; // disabled
  const key = getDailyWinKey(winnerId, loserId);
  const count = (dailyWinTracker.get(key) || 0) + 1;
  dailyWinTracker.set(key, count);
  return count > MAX_DAILY_WINS_VS_SAME;
}

class GameRoom {
  constructor(id, redUserId, blackUserId, mode = 'RANKED', buyIn = 0) {
    this.id = id;
    this.game = new CheckersGame();
    this.redUserId = redUserId;
    this.blackUserId = blackUserId;
    this.mode = mode;
    this.buyIn = buyIn;
    this.timerInterval = null;
    this.disconnectTimers = new Map(); // userId -> timeout
    this.startedAt = new Date();
  }

  getPlayerColor(userId) {
    if (userId === this.redUserId) return 'red';
    if (userId === this.blackUserId) return 'black';
    return null;
  }

  getOpponentId(userId) {
    return userId === this.redUserId ? this.blackUserId : this.redUserId;
  }

  startTimer(io) {
    this.timerInterval = setInterval(() => {
      if (this.game.gameOver) {
        this.stopTimer();
        return;
      }
      this.game.tickTime(1);
      io.to(`game:${this.id}`).emit('game:tick', {
        redTime: this.game.redTime,
        blackTime: this.game.blackTime
      });
      if (this.game.gameOver) {
        this.endGame(io, this.game.winner);
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  async endGame(io, winner) {
    this.stopTimer();
    const result = winner === 'red' ? 'RED_WIN' : winner === 'black' ? 'BLACK_WIN' : 'DRAW';
    const winnerId = winner === 'red' ? this.redUserId : winner === 'black' ? this.blackUserId : null;

    let eloChanges = { red: 0, black: 0 };
    let coinRewards = { red: 0, black: 0 };

    // Compute ELO for ranked games
    if (this.mode === 'RANKED' && winnerId) {
      try {
        const [redUser, blackUser] = await Promise.all([
          prisma.user.findUnique({ where: { id: this.redUserId } }),
          prisma.user.findUnique({ where: { id: this.blackUserId } })
        ]);

        if (redUser && blackUser) {
          const winnerUser = winner === 'red' ? redUser : blackUser;
          const loserUser = winner === 'red' ? blackUser : redUser;

          const { winnerDelta, loserDelta } = calculateElo(
            winnerUser.elo, loserUser.elo,
            winnerUser.gamesPlayed, loserUser.gamesPlayed
          );

          eloChanges = {
            red: winner === 'red' ? winnerDelta : loserDelta,
            black: winner === 'black' ? winnerDelta : loserDelta
          };

          // Update users and create game record atomically
          await prisma.$transaction([
            prisma.user.update({
              where: { id: this.redUserId },
              data: {
                elo: { increment: eloChanges.red },
                gamesPlayed: { increment: 1 },
                wins: winner === 'red' ? { increment: 1 } : undefined,
                losses: winner === 'black' ? { increment: 1 } : undefined
              }
            }),
            prisma.user.update({
              where: { id: this.blackUserId },
              data: {
                elo: { increment: eloChanges.black },
                gamesPlayed: { increment: 1 },
                wins: winner === 'black' ? { increment: 1 } : undefined,
                losses: winner === 'red' ? { increment: 1 } : undefined
              }
            }),
            prisma.game.create({
              data: {
                redPlayerId: this.redUserId,
                blackPlayerId: this.blackUserId,
                winnerId,
                result,
                redEloChange: eloChanges.red,
                blackEloChange: eloChanges.black,
                moveHistory: this.game.moveHistory,
                mode: this.mode,
                endedAt: new Date()
              }
            })
          ]);

          // Award coins with vault economics
          const winnerUserId = winner === 'red' ? this.redUserId : this.blackUserId;
          const loserUserId = winner === 'red' ? this.blackUserId : this.redUserId;

          // Diminishing returns check
          const isDiminished = trackAndCheckDiminishing(winnerUserId, loserUserId);

          let winnerTotal = isDiminished ? 0 : COINS_RANKED_WIN;
          let tax = 0;

          // Buy-in pot with 5% tax (only if wager is valid)
          if (this.buyIn > 0) {
            const wagerValid = isValidWager(this.game.moveHistory, this.startedAt);
            if (wagerValid && !isDiminished) {
              const payout = calculateRankedPayout(this.buyIn);
              winnerTotal += payout.winnerPot;
              tax = payout.tax;
              await depositToVault(tax, 'Ranked tax', `${RANKED_TAX_RATE * 100}% of ${this.buyIn * 2} pot, game #${this.id}`);
            } else if (isDiminished && wagerValid) {
              // 100% tax: entire pot goes to vault (anti-farming)
              tax = this.buyIn * 2;
              await depositToVault(tax, 'Anti-farm tax', `100% tax, same-opponent limit, game #${this.id}`);
            } else {
              // Invalid wager: refund both players
              await awardCoins(this.redUserId, this.buyIn, 'WIN_REWARD');
              await awardCoins(this.blackUserId, this.buyIn, 'WIN_REWARD');
            }
          }

          const loserTotal = COINS_LOSS;

          await awardCoins(winnerUserId, winnerTotal, 'WIN_REWARD');
          await awardCoins(loserUserId, loserTotal, 'WIN_REWARD');

          // Daily bounty (first win of day, paid from vault)
          const dailyBonus = await awardDailyBounty(winnerUserId);
          if (dailyBonus > 0) winnerTotal += dailyBonus;

          // ELO milestone check
          const updatedWinner = await prisma.user.findUnique({ where: { id: winnerUserId } });
          if (updatedWinner) {
            const milestones = await checkMilestones(winnerUserId, updatedWinner.elo);
            for (const m of milestones) winnerTotal += m.reward;
          }

          coinRewards = {
            red: winner === 'red' ? winnerTotal : loserTotal,
            black: winner === 'black' ? winnerTotal : loserTotal,
            tax,
            dailyBonus
          };
        }
      } catch (err) {
        console.error('Failed to persist game result:', err);
      }
    } else {
      // FRIENDLY game — still record the game, just no ELO/coins
      try {
        await prisma.game.create({
          data: {
            redPlayerId: this.redUserId,
            blackPlayerId: this.blackUserId,
            winnerId,
            result,
            moveHistory: this.game.moveHistory,
            mode: this.mode,
            endedAt: new Date()
          }
        });
        // Update gamesPlayed/wins/losses for both players (stats tracking, no ELO)
        await Promise.all([
          prisma.user.update({ where: { id: this.redUserId }, data: {
            gamesPlayed: { increment: 1 },
            wins: winner === 'red' ? { increment: 1 } : undefined,
            losses: winner === 'black' ? { increment: 1 } : undefined
          }}),
          prisma.user.update({ where: { id: this.blackUserId }, data: {
            gamesPlayed: { increment: 1 },
            wins: winner === 'black' ? { increment: 1 } : undefined,
            losses: winner === 'red' ? { increment: 1 } : undefined
          }})
        ]);
      } catch (err) {
        console.error('Failed to persist friendly game:', err);
      }
    }

    io.to(`game:${this.id}`).emit('game:over', {
      winner,
      result,
      winnerId,
      gameId: this.id,
      moveHistory: this.game.moveHistory,
      eloChanges,
      coinRewards
    });

    // Broadcast to all connected clients for the global game log
    const redConn = connectedUsers.get(this.redUserId);
    const blackConn = connectedUsers.get(this.blackUserId);
    let redName = redConn?.username || getSession(this.redUserId)?.username;
    let blackName = blackConn?.username || getSession(this.blackUserId)?.username;
    if (!redName || !blackName) {
      try {
        if (!redName) { const u = await prisma.user.findUnique({ where: { id: this.redUserId }, select: { username: true } }); redName = u?.username || 'Unknown'; }
        if (!blackName) { const u = await prisma.user.findUnique({ where: { id: this.blackUserId }, select: { username: true } }); blackName = u?.username || 'Unknown'; }
      } catch {}
    }
    io.emit('global:game-ended', {
      id: this.id,
      redPlayer: redName,
      blackPlayer: blackName,
      result,
      mode: this.mode,
      date: new Date().toISOString(),
    });

    // Phase stays 'in-game' — client shows game-over screen.
    // Player emits 'game:leave' to dismiss, which triggers forceIdle + sync:state.
    // 60-second cleanup timer (below) handles abandoned sessions.

    // Clean up game room reference
    const { gameRooms } = await import('./roomHandler.js');
    for (const [roomId, room] of gameRooms) {
      if (room.gameId === this.id) {
        room.status = 'finished';
        io.to(`room:${roomId}`).emit('room:updated', { room: null, closed: true });
        io.emit('room:list-update', { room: { id: roomId, closed: true } });
        gameRooms.delete(roomId);
        break;
      }
    }

    // Clean up after 60s — force idle for players who never dismissed
    const redId = this.redUserId;
    const blackId = this.blackUserId;
    setTimeout(() => {
      activeGames.delete(this.id);
      // Force idle if still in-game (never dismissed game-over screen)
      const rSession = getSession(redId);
      if (rSession?.phase === 'in-game' && rSession.gameId === this.id) {
        forceIdle(redId);
        const rc = connectedUsers.get(redId);
        if (rc) emitSyncState(rc.socket, redId);
      }
      const bSession = getSession(blackId);
      if (bSession?.phase === 'in-game' && bSession.gameId === this.id) {
        forceIdle(blackId);
        const bc = connectedUsers.get(blackId);
        if (bc) emitSyncState(bc.socket, blackId);
      }
      cleanupBotEmotes(this.id);
    }, 60000);
  }

  getState() {
    return {
      gameId: this.id,
      board: this.game.board,
      currentPlayer: this.game.currentPlayer,
      redTime: this.game.redTime,
      blackTime: this.game.blackTime,
      chainPiece: this.game.chainPiece,
      gameOver: this.game.gameOver,
      winner: this.game.winner,
      moveHistory: this.game.moveHistory
    };
  }
}

export function findActiveGameForUser(userId) {
  for (const [gameId, room] of activeGames) {
    if (room.game.gameOver) continue;
    const color = room.getPlayerColor(userId);
    if (color) return { gameId, room, color };
  }
  return null;
}

let matchmakingInterval = null;

export function setupGameHandler(io, socket) {
  // Start quick play matchmaking loop once
  if (!matchmakingInterval) {
    matchmakingInterval = setInterval(() => {
      const pairs = quickPlayPool.tryMatch();
      for (const { a, b, mode } of pairs) {
        createQuickPlayRoom(io, a, b, mode);
      }
    }, 2000);
  }

  // --- Check for active game on reconnect ---
  // (Phase/routing is handled by sync:state in index.js)
  const activeGame = findActiveGameForUser(socket.userId);
  if (activeGame) {
    const { gameId, room, color } = activeGame;
    // Sync session phase if needed
    const session = getSession(socket.userId);
    if (session && session.phase !== 'in-game') {
      forceIdle(socket.userId);
      setPhase(socket.userId, 'in-game', { gameId, gameColor: color });
    }

    // Clear disconnect timer
    if (room.disconnectTimers.has(socket.userId)) {
      clearTimeout(room.disconnectTimers.get(socket.userId));
      room.disconnectTimers.delete(socket.userId);
    }

    // Notify opponent
    const opponentId = room.getOpponentId(socket.userId);
    const opponentConn = connectedUsers.get(opponentId);
    if (opponentConn) {
      opponentConn.socket.emit('game:opponent-reconnected', { gameId });
    }

    // System message
    const channelId = `game:${gameId}`;
    prisma.chatMessage.create({
      data: { channelId, senderId: 0, username: 'System', content: `${socket.username} reconnected.` }
    }).then(msg => {
      io.to(`chat:${channelId}`).emit('chat:message', { id: msg.id, channelId, senderId: 0, username: 'System', content: msg.content, createdAt: msg.createdAt, system: true });
    }).catch(() => {});
  }

  // --- Quick Play Matchmaking ---
  socket.on('matchmaking:join', (data) => {
    const mmSession = getSession(socket.userId);
    if (!mmSession || mmSession.phase !== 'idle') {
      return socket.emit('matchmaking:error', { error: 'Cannot search while in a room or game' });
    }
    const elo = data?.elo || 1000;
    setPhase(socket.userId, 'matchmaking');
    quickPlayPool.add(socket.userId, elo, socket.isGuest);
    socket.emit('matchmaking:joined');
    emitSyncState(socket, socket.userId);
  });

  socket.on('matchmaking:leave', () => {
    forceIdle(socket.userId);
    quickPlayPool.remove(socket.userId);
    socket.emit('matchmaking:left');
    emitSyncState(socket, socket.userId);
  });

  // --- Emotes ---
  socket.on('emote:send', ({ gameId, emote }) => {
    const room = activeGames.get(gameId);
    if (!room) return;
    if (!room.getPlayerColor(socket.userId)) return;
    // Rate limit: 1 emote per 2 seconds per user
    const now = Date.now();
    if (!room.lastEmote) room.lastEmote = {};
    if (room.lastEmote[socket.userId] && now - room.lastEmote[socket.userId] < 2000) return;
    room.lastEmote[socket.userId] = now;

    io.to(`game:${gameId}`).emit('emote:show', {
      userId: socket.userId,
      username: socket.username,
      emote
    });
  });

  // --- Game moves ---
  socket.on('game:move', ({ gameId, fromRow, fromCol, toRow, toCol }) => {
    const room = activeGames.get(gameId);
    if (!room) return socket.emit('game:move-rejected', { reason: 'Game not found' });

    const color = room.getPlayerColor(socket.userId);
    if (!color) return socket.emit('game:move-rejected', { reason: 'Not in this game' });
    if (room.game.currentPlayer !== color) {
      return socket.emit('game:move-rejected', { reason: 'Not your turn' });
    }

    // Clone pre-move state for analysis (async, non-blocking)
    const preMoveClone = room.game.clone();

    const result = room.game.makeMove(fromRow, fromCol, toRow, toCol);
    if (!result) {
      socket.emit('game:move-rejected', { reason: 'Invalid move' });
      socket.emit('game:sync', room.getState());
      return;
    }

    io.to(`game:${gameId}`).emit('game:moved', {
      fromRow, fromCol, toRow, toCol,
      captured: result.captured,
      promoted: result.promoted,
      chainContinues: result.chainContinues,
      redTime: room.game.redTime,
      blackTime: room.game.blackTime,
      currentPlayer: room.game.currentPlayer
    });

    // Async move analysis — don't block the move response
    setTimeout(() => {
      try {
        const analysis = analyzeMoveQuality(preMoveClone, { fromRow, fromCol, toRow, toCol }, color);
        socket.emit('game:move-analysis', { rating: analysis.rating, scoreDiff: analysis.scoreDiff });

        // Check if opponent is a bot — trigger emote reaction to player's move
        const opponentId = room.getOpponentId(socket.userId);
        isBotUser(opponentId).then(isBot => {
          if (!isBot) return;
          getBotDifficulty(opponentId).then(diff => {
            if (!diff) return;
            const moveNum = room.game.moveHistory?.length || 0;
            const triggers = getAnalysisTriggers(analysis, moveNum);
            for (const trigger of triggers) {
              const emote = shouldEmote(trigger, diff, gameId);
              if (emote) {
                io.to(`game:${gameId}`).emit('emote:show', {
                  userId: opponentId,
                  username: 'Bot',
                  emote
                });
                break; // one emote per move
              }
            }
          });
        });
      } catch {}
    }, 0);

    if (room.game.gameOver) {
      room.endGame(io, room.game.winner);
    } else {
      scheduleBotMoveIfNeeded(io, room);
    }
  });

  // --- Resign ---
  socket.on('game:resign', ({ gameId }) => {
    const room = activeGames.get(gameId);
    if (!room) return;

    const color = room.getPlayerColor(socket.userId);
    if (!color) return;

    const winner = color === 'red' ? 'black' : 'red';
    room.game.gameOver = true;
    room.game.winner = winner;
    room.endGame(io, winner);
  });

  // --- Leave game (dismiss game-over screen) ---
  socket.on('game:leave', ({ gameId }) => {
    forceIdle(socket.userId);
    emitSyncState(socket, socket.userId);
  });

  // --- Sync (reconnect) ---
  socket.on('game:sync', ({ gameId }) => {
    const room = activeGames.get(gameId);
    if (!room) return;

    const color = room.getPlayerColor(socket.userId);
    if (!color) return;

    // Rejoin the socket room
    socket.join(`game:${gameId}`);
    socket.join(`chat:game:${gameId}`);
    socket.emit('game:sync', room.getState());

    // Clear disconnect timer
    if (room.disconnectTimers.has(socket.userId)) {
      clearTimeout(room.disconnectTimers.get(socket.userId));
      room.disconnectTimers.delete(socket.userId);
    }
  });

  // --- Rematch ---
  socket.on('game:rematch-request', ({ gameId }) => {
    const room = activeGames.get(gameId);
    if (!room || !room.game.gameOver) return;

    if (!room.rematchRequests) room.rematchRequests = new Set();
    room.rematchRequests.add(socket.userId);

    const opponentId = room.getOpponentId(socket.userId);
    const opponentConn = connectedUsers.get(opponentId);
    if (opponentConn) {
      opponentConn.socket.emit('game:rematch-requested', { gameId });
    }

    // Both requested — create new game with swapped colors
    if (room.rematchRequests.size === 2) {
      const newRoom = createGameDirect(
        io,
        room.blackUserId, // swap: old black is new red
        room.redUserId,
        room.mode
      );
      io.to(`game:${room.id}`).emit('game:rematch-accepted', {
        newGameId: newRoom.id
      });
      activeGames.delete(room.id);
    }
  });

  // --- Handle disconnect during game ---
  // Disconnect timers are handled centrally by userState.
  // Here we only handle matchmaking cleanup and opponent notification.
  socket.on('disconnect', () => {
    quickPlayPool.remove(socket.userId);

    // Notify opponent if in an active game
    for (const [gameId, room] of activeGames) {
      if (room.game.gameOver) continue;
      const color = room.getPlayerColor(socket.userId);
      if (!color) continue;

      const opponentId = room.getOpponentId(socket.userId);
      const opponentConn = connectedUsers.get(opponentId);
      if (opponentConn) {
        opponentConn.socket.emit('game:opponent-disconnected', { gameId });
      }
      const channelId = `game:${gameId}`;
      prisma.chatMessage.create({
        data: { channelId, senderId: 0, username: 'System', content: `${socket.username} disconnected. Waiting 30s...` }
      }).then(msg => {
        io.to(`chat:${channelId}`).emit('chat:message', { id: msg.id, channelId, senderId: 0, username: 'System', content: msg.content, createdAt: msg.createdAt, system: true });
      }).catch(() => {});
    }
  });
}

async function createGameDirect(io, redUserId, blackUserId, mode, buyIn = 0) {
  const gameId = nextGameId++;
  const room = new GameRoom(gameId, redUserId, blackUserId, mode, buyIn);
  activeGames.set(gameId, room);

  // Set phase for human players (bots have no session)
  const redConn = connectedUsers.get(redUserId);
  const blackConn = connectedUsers.get(blackUserId);
  if (redConn) {
    setPhase(redUserId, 'in-game', { gameId, gameColor: 'red' });
  }
  if (blackConn) {
    setPhase(blackUserId, 'in-game', { gameId, gameColor: 'black' });
  }

  // Look up usernames — bots have no connection or session, fall back to DB
  let redName = redConn?.username || getSession(redUserId)?.username;
  let blackName = blackConn?.username || getSession(blackUserId)?.username;
  if (!redName) {
    const u = await prisma.user.findUnique({ where: { id: redUserId }, select: { username: true } });
    redName = u?.username || 'Opponent';
  }
  if (!blackName) {
    const u = await prisma.user.findUnique({ where: { id: blackUserId }, select: { username: true } });
    blackName = u?.username || 'Opponent';
  }

  if (redConn) {
    redConn.socket.join(`game:${gameId}`);
    redConn.socket.join(`chat:game:${gameId}`);
    redConn.socket.emit('matchmaking:found', {
      gameId,
      yourColor: 'red',
      opponent: { id: blackUserId, username: blackName }
    });
  }
  if (blackConn) {
    blackConn.socket.join(`game:${gameId}`);
    blackConn.socket.join(`chat:game:${gameId}`);
    blackConn.socket.emit('matchmaking:found', {
      gameId,
      yourColor: 'black',
      opponent: { id: redUserId, username: redName }
    });
  }

  // Presence is derived from session phase (already set to 'in-game' above)

  // Grace period for the first mover — added before sync so client sees correct time
  const WHEEL_GRACE = 5;
  room.game.redTime += WHEEL_GRACE;

  // Emit sync:state to both players (with grace time included)
  if (redConn) emitSyncState(redConn.socket, redUserId);
  if (blackConn) emitSyncState(blackConn.socket, blackUserId);

  // Start immediately — wheel is purely cosmetic on client
  io.to(`game:${gameId}`).emit('game:start', {
    gameId,
    board: room.game.board,
    redTime: room.game.redTime,
    blackTime: room.game.blackTime,
    currentPlayer: room.game.currentPlayer
  });
  room.startTimer(io);
  // Schedule first bot move with a small delay for client to mount
  setTimeout(() => scheduleBotMoveIfNeeded(io, room), 500);

  return room;
}

/**
 * If the current player in a game is a bot, schedule a bot move after a natural delay.
 */
async function scheduleBotMoveIfNeeded(io, gameRoom) {
  if (gameRoom.game.gameOver) return;

  const currentColor = gameRoom.game.currentPlayer;
  const currentUserId = currentColor === 'red' ? gameRoom.redUserId : gameRoom.blackUserId;
  const isBot = await isBotUser(currentUserId);
  if (!isBot) return;

  const difficulty = await getBotDifficulty(currentUserId);
  if (!difficulty) return;

  // Chain continuations are fast (150ms), first move gets natural thinking delay
  const isChain = gameRoom.game.chainPiece != null;
  const delay = isChain ? 150 : (400 + Math.random() * 600);

  setTimeout(() => {
    if (gameRoom.game.gameOver) return;

    const move = chooseBotMove(gameRoom.game, difficulty);
    if (!move) return;

    const result = gameRoom.game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    if (!result) return;

    io.to(`game:${gameRoom.id}`).emit('game:moved', {
      fromRow: move.fromRow, fromCol: move.fromCol,
      toRow: move.toRow, toCol: move.toCol,
      captured: result.captured,
      promoted: result.promoted,
      chainContinues: result.chainContinues,
      redTime: gameRoom.game.redTime,
      blackTime: gameRoom.game.blackTime,
      currentPlayer: gameRoom.game.currentPlayer
    });

    // Bot emote triggers based on what just happened
    const triggers = getMoveTriggers(result, gameRoom.game, currentColor);
    for (const trigger of triggers) {
      const emote = shouldEmote(trigger, difficulty, gameRoom.id);
      if (emote) {
        io.to(`game:${gameRoom.id}`).emit('emote:show', {
          userId: currentUserId,
          username: 'Bot',
          emote
        });
        break;
      }
    }

    if (gameRoom.game.gameOver) {
      gameRoom.endGame(io, gameRoom.game.winner);
    } else {
      scheduleBotMoveIfNeeded(io, gameRoom);
    }
  }, delay);
}

export { createGameDirect, scheduleBotMoveIfNeeded };
