import { CheckersGame } from '../../shared/game.js';
import { TURN_TIME } from '../../shared/constants.js';
import { rankedQueue } from '../services/matchmaking.js';
import { connectedUsers } from './index.js';
import { setUserStatus } from './presenceHandler.js';
import { calculateElo } from '../services/elo.js';
import { awardCoins } from '../services/coins.js';
import { COINS_RANKED_WIN, COINS_LOSS } from '../../shared/constants.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Active games: gameId -> GameRoom
export const activeGames = new Map();
// Pending friend game lobbies: code -> { hostId, hostSocket }
const pendingFriendGames = new Map();
let nextGameId = 1;

class GameRoom {
  constructor(id, redUserId, blackUserId, mode = 'RANKED') {
    this.id = id;
    this.game = new CheckersGame();
    this.redUserId = redUserId;
    this.blackUserId = blackUserId;
    this.mode = mode;
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

          // Award coins
          const winnerCoinAmount = COINS_RANKED_WIN;
          const loserCoinAmount = COINS_LOSS;
          const winnerUserId = winner === 'red' ? this.redUserId : this.blackUserId;
          const loserUserId = winner === 'red' ? this.blackUserId : this.redUserId;

          await awardCoins(winnerUserId, winnerCoinAmount, 'WIN_REWARD');
          await awardCoins(loserUserId, loserCoinAmount, 'WIN_REWARD');

          coinRewards = {
            red: winner === 'red' ? winnerCoinAmount : loserCoinAmount,
            black: winner === 'black' ? winnerCoinAmount : loserCoinAmount
          };
        }
      } catch (err) {
        console.error('Failed to persist game result:', err);
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

    // Update presence
    setUserStatus(this.redUserId, 'online');
    setUserStatus(this.blackUserId, 'online');

    // Clean up after a delay (allow rematch requests)
    setTimeout(() => {
      activeGames.delete(this.id);
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
  // Start matchmaking loop once
  if (!matchmakingInterval) {
    matchmakingInterval = setInterval(() => {
      const pairs = rankedQueue.tryMatch();
      for (const [a, b] of pairs) {
        createGame(io, a, b);
      }
    }, 2000);
  }

  // --- Check for active game on reconnect ---
  const activeGame = findActiveGameForUser(socket.userId);
  if (activeGame) {
    const { gameId, room, color } = activeGame;
    const opponentId = room.getOpponentId(socket.userId);
    const opponentConn = connectedUsers.get(opponentId);
    socket.join(`game:${gameId}`);

    // Clear disconnect timer
    if (room.disconnectTimers.has(socket.userId)) {
      clearTimeout(room.disconnectTimers.get(socket.userId));
      room.disconnectTimers.delete(socket.userId);
    }

    socket.emit('game:reconnect', {
      gameId,
      yourColor: color,
      opponentName: opponentConn?.username || 'Opponent',
      opponentId,
      state: room.getState()
    });
  }

  // --- Matchmaking ---
  socket.on('matchmaking:join', (data) => {
    const elo = data?.elo || 1000;
    rankedQueue.add(socket.userId, elo, socket.id);
    socket.emit('matchmaking:joined');
  });

  socket.on('matchmaking:leave', () => {
    rankedQueue.remove(socket.userId);
    socket.emit('matchmaking:left');
  });

  // --- Friend game invites ---
  socket.on('friend-game:create', () => {
    // Create a pending lobby with a 6-char code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    pendingFriendGames.set(code, { hostId: socket.userId, hostSocket: socket });
    socket.emit('friend-game:created', { code });
  });

  socket.on('friend-game:join', ({ code }) => {
    const lobby = pendingFriendGames.get(code);
    if (!lobby) return socket.emit('friend-game:error', { error: 'Game not found' });
    if (lobby.hostId === socket.userId) return socket.emit('friend-game:error', { error: 'Cannot join your own game' });

    pendingFriendGames.delete(code);
    // Create the game — host is red, joiner is black
    createGameDirect(io, lobby.hostId, socket.userId, 'FRIENDLY');
  });

  socket.on('friend-game:cancel', ({ code }) => {
    const lobby = pendingFriendGames.get(code);
    if (lobby && lobby.hostId === socket.userId) {
      pendingFriendGames.delete(code);
    }
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

    const result = room.game.makeMove(fromRow, fromCol, toRow, toCol);
    if (!result) {
      return socket.emit('game:move-rejected', { reason: 'Invalid move' });
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

    if (room.game.gameOver) {
      room.endGame(io, room.game.winner);
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

  // --- Sync (reconnect) ---
  socket.on('game:sync', ({ gameId }) => {
    const room = activeGames.get(gameId);
    if (!room) return;

    const color = room.getPlayerColor(socket.userId);
    if (!color) return;

    // Rejoin the socket room
    socket.join(`game:${gameId}`);
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
  socket.on('disconnect', () => {
    rankedQueue.removeBySocket(socket.id);

    // Find any active game for this user
    for (const [gameId, room] of activeGames) {
      if (room.game.gameOver) continue;
      const color = room.getPlayerColor(socket.userId);
      if (!color) continue;

      // Give 30 seconds to reconnect
      const timer = setTimeout(() => {
        if (room.game.gameOver) return;
        const winner = color === 'red' ? 'black' : 'red';
        room.game.gameOver = true;
        room.game.winner = winner;
        room.endGame(io, winner);
      }, 30000);

      room.disconnectTimers.set(socket.userId, timer);

      // Notify opponent
      const opponentId = room.getOpponentId(socket.userId);
      const opponentConn = connectedUsers.get(opponentId);
      if (opponentConn) {
        opponentConn.socket.emit('game:opponent-disconnected', { gameId });
      }
    }
  });
}

function createGame(io, playerA, playerB) {
  // Randomly assign colors
  const isARed = Math.random() < 0.5;
  const redUserId = isARed ? playerA.userId : playerB.userId;
  const blackUserId = isARed ? playerB.userId : playerA.userId;

  return createGameDirect(io, redUserId, blackUserId, 'RANKED');
}

function createGameDirect(io, redUserId, blackUserId, mode) {
  const gameId = nextGameId++;
  const room = new GameRoom(gameId, redUserId, blackUserId, mode);
  activeGames.set(gameId, room);

  // Join socket rooms
  const redConn = connectedUsers.get(redUserId);
  const blackConn = connectedUsers.get(blackUserId);

  if (redConn) {
    redConn.socket.join(`game:${gameId}`);
    redConn.socket.emit('matchmaking:found', {
      gameId,
      yourColor: 'red',
      opponent: { id: blackUserId, username: blackConn?.username || 'Opponent' }
    });
  }
  if (blackConn) {
    blackConn.socket.join(`game:${gameId}`);
    blackConn.socket.emit('matchmaking:found', {
      gameId,
      yourColor: 'black',
      opponent: { id: redUserId, username: redConn?.username || 'Opponent' }
    });
  }

  // Update presence
  setUserStatus(redUserId, 'in-game');
  setUserStatus(blackUserId, 'in-game');

  // Start the game after a short delay (for wheel animation)
  setTimeout(() => {
    io.to(`game:${gameId}`).emit('game:start', {
      gameId,
      board: room.game.board,
      redTime: room.game.redTime,
      blackTime: room.game.blackTime,
      currentPlayer: room.game.currentPlayer
    });
    room.startTimer(io);
  }, 4500); // matches wheel animation duration

  return room;
}

export { createGameDirect };
