import { reject } from './sessionCommands.js';
import { CheckersGame } from '../../shared/game.js';
import { quickPlayPool } from '../services/quickPlay.js';
import { createQuickPlayRoom, gameRooms } from './rooms.js';
import { isBotUser, chooseBotMove, getBotDifficulty } from '../services/botPlayer.js';
import { analyzeMoveQuality } from '../services/moveAnalysis.js';
import { shouldEmote, getMoveTriggers, getAnalysisTriggers, cleanupGame as cleanupBotEmotes } from '../services/botEmotes.js';
import { publishUser, publishGame, broadcast, notifyChannel, notifyUser } from './events.js';
import { getSession, setPhase, forceIdle, handleDisconnect, getAllSessions } from './sessions.js';
import { calculateElo } from '../services/elo.js';
import { awardCoins } from '../services/coins.js';
import { COINS_RANKED_WIN, COINS_LOSS, RANKED_TAX_RATE, MAX_DAILY_WINS_VS_SAME, DRAW_OFFER_COOLDOWN_MS, REVEAL_TIMEOUT_MS } from '../../shared/constants.js';
import { calculateRankedPayout, depositToVault, awardDailyBounty, checkMilestones, isValidWager } from '../services/vault.js';
import prisma from '../db.js';

// Active games: gameId -> GameRoom
export const activeGames = new Map();
// Tunable at runtime so tests can exercise the reveal timeout without waiting.
export const gameConfig = { revealTimeoutMs: REVEAL_TIMEOUT_MS };
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
  constructor(id, redUserId, blackUserId, mode = 'RANKED', buyIn = 0, turnTime = 60) {
    this.id = id;
    this.game = new CheckersGame(turnTime);
    this.version = 0;
    this.finalization = null;
    this.resultData = null;
    this.botScheduled = false;
    this.lastClockAt = null;
    this.redUserId = redUserId;
    this.blackUserId = blackUserId;
    this.mode = mode;
    this.buyIn = buyIn;
    this.timerInterval = null;
    this.startedAt = new Date();
    this.pendingDrawOffer = null; // userId who offered
    this.lastDrawOffer = {};     // userId -> timestamp (cooldown)
    this.endReason = null;       // resign, timeout, no-moves, draw-agreement, repetition, 25-move
    // Colour reveal: colours are assigned, but the clock waits until every human
    // player has finished (or skipped) the wheel, or the reveal deadline passes.
    this.started = false;
    this.revealAcks = new Set();
    this.revealDeadline = null;
    this.revealTimer = null;
  }

  openReveal(botIds, timeoutMs = gameConfig.revealTimeoutMs) {
    for (const id of botIds) this.revealAcks.add(id); // bots never watch the wheel
    this.revealDeadline = Date.now() + timeoutMs;
    this.revealTimer = setTimeout(() => this.begin(), timeoutMs);
    this.revealTimer.unref?.();
  }

  acknowledgeReveal(userId) {
    if (this.started || this.game.gameOver || !this.getPlayerColor(userId)) return;
    if (this.revealAcks.has(userId)) return;
    this.revealAcks.add(userId);
    if ([this.redUserId, this.blackUserId].every(id => this.revealAcks.has(id))) return this.begin();
    this.version++;
    publishGame(this.id);
  }

  begin() {
    clearTimeout(this.revealTimer); this.revealTimer = null;
    if (this.started || this.game.gameOver) return;
    this.started = true;
    this.startedAt = new Date();
    this.version++;
    this.startTimer();
    publishGame(this.id);
    // Small delay so clients can mount the board before the first bot move.
    setTimeout(() => scheduleBotMoveIfNeeded(this), 500);
  }

  getPlayerColor(userId) {
    if (userId === this.redUserId) return 'red';
    if (userId === this.blackUserId) return 'black';
    return null;
  }

  getOpponentId(userId) {
    return userId === this.redUserId ? this.blackUserId : this.redUserId;
  }

  startTimer() {
    this.stopTimer();
    this.lastClockAt = performance.now();
    this.timerInterval = setInterval(() => {
      if (this.game.gameOver) {
        this.stopTimer();
        return;
      }
      this.advanceClock();

      publishGame(this.id);
      if (this.game.gameOver) {
        if (!this.endReason) this.endReason = 'timeout';
        this.endGame(this.game.winner);
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  advanceClock() {
    if (this.lastClockAt === null || this.game.gameOver) return;
    const now = performance.now();
    this.game.tickTime((now - this.lastClockAt) / 1000);
    this.lastClockAt = now;
    this.version++;
  }

  endGame(winner) {
    if (this.finalization) return this.finalization;
    this.game.gameOver = true;
    this.game.winner = winner;
    this.pendingDrawOffer = null;
    this.version++;
    this.stopTimer();
    clearTimeout(this.revealTimer); this.revealTimer = null;
    // Latch before any asynchronous persistence work or competing terminal event.
    this.finalization = Promise.resolve().then(() => this.persistResult(winner));

    publishGame(this.id);
    return this.finalization;
  }

  async persistResult(winner) {
    this.stopTimer();
    const result = winner === 'red' ? 'RED_WIN' : winner === 'black' ? 'BLACK_WIN' : 'DRAW';
    const winnerId = winner === 'red' ? this.redUserId : winner === 'black' ? this.blackUserId : null;

    let eloChanges = { red: 0, black: 0 };
    let coinRewards = { red: 0, black: 0 };
    let coinBreakdown = { red: [], black: [] }; // [{label, amount}]
    let eloDetail = {}; // { opponentElo, kFactor } per color

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

          eloDetail = {
            red: { opponentElo: winner === 'red' ? loserUser.elo : winnerUser.elo },
            black: { opponentElo: winner === 'black' ? loserUser.elo : winnerUser.elo }
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
          const winnerColor = winner;
          const loserColor = winner === 'red' ? 'black' : 'red';

          // Diminishing returns check
          const isDiminished = trackAndCheckDiminishing(winnerUserId, loserUserId);

          let winnerTotal = isDiminished ? 0 : COINS_RANKED_WIN;
          const winnerBreakdown = [];
          const loserBreakdown = [];
          let tax = 0;

          if (!isDiminished) {
            winnerBreakdown.push({ label: 'Win reward', amount: COINS_RANKED_WIN });
          }

          // Buy-in pot with 5% tax (only if wager is valid)
          if (this.buyIn > 0) {
            const wagerValid = isValidWager(this.game.moveHistory, this.startedAt);
            if (wagerValid && !isDiminished) {
              const payout = calculateRankedPayout(this.buyIn);
              winnerTotal += payout.winnerPot;
              tax = payout.tax;
              winnerBreakdown.push({ label: 'Wager pot', amount: payout.winnerPot });
              await depositToVault(tax, 'Ranked tax', `${RANKED_TAX_RATE * 100}% of ${this.buyIn * 2} pot, game #${this.id}`);
            } else if (isDiminished && wagerValid) {
              tax = this.buyIn * 2;
              await depositToVault(tax, 'Anti-farm tax', `100% tax, same-opponent limit, game #${this.id}`);
            } else {
              await awardCoins(this.redUserId, this.buyIn, 'WIN_REWARD');
              await awardCoins(this.blackUserId, this.buyIn, 'WIN_REWARD');
              // Refund shows in both breakdowns
              coinBreakdown.red.push({ label: 'Wager refund', amount: this.buyIn });
              coinBreakdown.black.push({ label: 'Wager refund', amount: this.buyIn });
            }
          }

          const loserTotal = COINS_LOSS;
          loserBreakdown.push({ label: 'Consolation', amount: COINS_LOSS });

          await awardCoins(winnerUserId, winnerTotal, 'WIN_REWARD');
          await awardCoins(loserUserId, loserTotal, 'WIN_REWARD');

          // Daily bounty (first win of day, paid from vault)
          const dailyBonus = await awardDailyBounty(winnerUserId);
          if (dailyBonus > 0) {
            winnerTotal += dailyBonus;
            winnerBreakdown.push({ label: 'Daily bonus', amount: dailyBonus });
          }

          // ELO milestone check
          const updatedWinner = await prisma.user.findUnique({ where: { id: winnerUserId } });
          if (updatedWinner) {
            const milestones = await checkMilestones(winnerUserId, updatedWinner.elo);
            for (const m of milestones) {
              winnerTotal += m.reward;
              winnerBreakdown.push({ label: `${m.name} milestone`, amount: m.reward });
            }
          }

          coinBreakdown[winnerColor].push(...winnerBreakdown);
          coinBreakdown[loserColor].push(...loserBreakdown);

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
    } else if (this.mode === 'RANKED' && result === 'DRAW') {
      // DRAW — small ELO convergence, consolation coins, refund buy-ins
      try {
        const [redUser, blackUser] = await Promise.all([
          prisma.user.findUnique({ where: { id: this.redUserId } }),
          prisma.user.findUnique({ where: { id: this.blackUserId } })
        ]);

        if (redUser && blackUser) {
          // Small convergence: lower-rated gets +2, higher-rated gets -2
          let redEloDelta = 0, blackEloDelta = 0;
          if (redUser.elo !== blackUser.elo) {
            if (redUser.elo < blackUser.elo) { redEloDelta = 2; blackEloDelta = -2; }
            else { redEloDelta = -2; blackEloDelta = 2; }
          }
          eloChanges = { red: redEloDelta, black: blackEloDelta };
          eloDetail = {
            red: { opponentElo: blackUser.elo },
            black: { opponentElo: redUser.elo }
          };

          await prisma.$transaction([
            prisma.user.update({
              where: { id: this.redUserId },
              data: { elo: { increment: redEloDelta }, gamesPlayed: { increment: 1 } }
            }),
            prisma.user.update({
              where: { id: this.blackUserId },
              data: { elo: { increment: blackEloDelta }, gamesPlayed: { increment: 1 } }
            }),
            prisma.game.create({
              data: {
                redPlayerId: this.redUserId, blackPlayerId: this.blackUserId,
                winnerId: null, result, redEloChange: redEloDelta, blackEloChange: blackEloDelta,
                moveHistory: this.game.moveHistory, mode: this.mode, endedAt: new Date()
              }
            })
          ]);

          // Consolation coins to both
          await awardCoins(this.redUserId, COINS_LOSS, 'WIN_REWARD');
          await awardCoins(this.blackUserId, COINS_LOSS, 'WIN_REWARD');
          coinRewards = { red: COINS_LOSS, black: COINS_LOSS };
          coinBreakdown.red.push({ label: 'Draw consolation', amount: COINS_LOSS });
          coinBreakdown.black.push({ label: 'Draw consolation', amount: COINS_LOSS });

          // Refund buy-in on draw
          if (this.buyIn > 0) {
            await awardCoins(this.redUserId, this.buyIn, 'WIN_REWARD');
            await awardCoins(this.blackUserId, this.buyIn, 'WIN_REWARD');
            coinBreakdown.red.push({ label: 'Wager refund', amount: this.buyIn });
            coinBreakdown.black.push({ label: 'Wager refund', amount: this.buyIn });
          }
        }
      } catch (err) {
        console.error('Failed to persist draw result:', err);
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

    this.resultData = {
      winner,
      result,
      winnerId,
      gameId: this.id,
      moveHistory: this.game.moveHistory,
      eloChanges,
      eloDetail,
      coinRewards,
      coinBreakdown,
      endReason: this.endReason || this.game.drawReason || 'no-moves',
      drawReason: this.game.drawReason || null
    };
    this.version++;

    publishGame(this.id);

    // Broadcast to all connected clients for the global game log
    let redName = this.playerNames[this.redUserId];
    let blackName = this.playerNames[this.blackUserId];
    if (!redName || !blackName) {
      try {
        if (!redName) { const u = await prisma.user.findUnique({ where: { id: this.redUserId }, select: { username: true } }); redName = u?.username || 'Unknown'; }
        if (!blackName) { const u = await prisma.user.findUnique({ where: { id: this.blackUserId }, select: { username: true } }); blackName = u?.username || 'Unknown'; }
      } catch {}
    }
    broadcast('global:game-ended', {
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
    const { gameRooms } = await import('./rooms.js');
    for (const [roomId, room] of gameRooms) {
      if (room.gameId === this.id) {
        room.status = 'finished';

        broadcast('room:list-update', { room: { id: roomId, closed: true } });
        gameRooms.delete(roomId);
        break;
      }
    }

    // Clean up after 60s — force idle for players who never dismissed
    const redId = this.redUserId;
    const blackId = this.blackUserId;
    this.cleanupTimer = setTimeout(() => {
      activeGames.delete(this.id);
      // Force idle if still in-game (never dismissed game-over screen)
      const rSession = getSession(redId);
      if (rSession?.phase === 'in-game' && rSession.gameId === this.id) {
        forceIdle(redId);
        publishUser(redId);
      }
      const bSession = getSession(blackId);
      if (bSession?.phase === 'in-game' && bSession.gameId === this.id) {
        forceIdle(blackId);
        publishUser(blackId);
      }
      for (const session of getAllSessions().values()) {
        if (session.phase === 'spectating' && session.spectatingGameId === this.id) {
          forceIdle(session.userId);
          if (session.connectionId) publishUser(session.userId);
        }
      }
      cleanupBotEmotes(this.id);
    }, 60000);
  }

  getState() {
    return {
      gameId: this.id,
      version: this.version,
      started: this.started,
      revealAcks: [...this.revealAcks],
      revealDeadline: this.revealDeadline,
      turnTime: this.game.turnTime,
      pendingDrawOffer: this.pendingDrawOffer,
      endReason: this.endReason || this.game.drawReason,
      drawReason: this.game.drawReason,
      resultData: this.resultData,
      movesWithoutCapture: this.game.movesWithoutCapture,
      positionHistory: this.game.positionHistory,
      board: this.game.board,
      currentPlayer: this.game.currentPlayer,
      redTime: this.game.redTime,
      blackTime: this.game.blackTime,
      chainPiece: this.game.chainPiece,
      gameOver: this.game.gameOver,
      winner: this.game.winner,
      moveHistory: this.game.moveHistory,
      rematchRequests: [...(this.rematchRequests || [])]
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
export function startMatchmaking() {
  if (matchmakingInterval) return;
  matchmakingInterval = setInterval(() => {
    for (const { a, b, mode } of quickPlayPool.tryMatch()) createQuickPlayRoom(a, b, mode).catch(error => console.error('Match creation failed:', error));
  }, 2000);
  matchmakingInterval.unref?.();
}
export function stopMatchmaking() { clearInterval(matchmakingInterval); matchmakingInterval = null; }

export function createGameActions(actor) {
  const actions = {};
  // --- Quick Play Matchmaking ---
  actions["matchmaking:join"] = async () => {
    const mmSession = getSession(actor.userId);
    if (!mmSession || mmSession.phase !== 'idle') {
      return reject({ error: 'Cannot search while in a room or game' });
    }
    const player = await prisma.user.findUnique({ where: { id: actor.userId } });
    if (!player || mmSession.phase !== 'idle' || mmSession.connectionId !== actor.connectionId) return reject('Session changed');
    const elo = player.elo;
    setPhase(actor.userId, 'matchmaking');
    quickPlayPool.add(actor.userId, elo, actor.isGuest);

    publishUser(actor.userId);
  };

  actions["matchmaking:leave"] = () => {
    if (getSession(actor.userId)?.phase !== 'matchmaking') return publishUser(actor.userId);
    if ([...gameRooms.values()].some(room => room.status === 'starting' && room.players.some(p => p.userId === actor.userId))) return publishUser(actor.userId);
    forceIdle(actor.userId);
    quickPlayPool.remove(actor.userId);

    publishUser(actor.userId);
  };

  // --- Emotes ---
  actions["emote:send"] = ({ gameId, emote }) => {
    const room = activeGames.get(gameId);
    if (!room) return;
    if (!room.getPlayerColor(actor.userId)) return;
    // Rate limit: 1 emote per 2 seconds per user
    const now = Date.now();
    if (!room.lastEmote) room.lastEmote = {};
    if (room.lastEmote[actor.userId] && now - room.lastEmote[actor.userId] < 2000) return;
    room.lastEmote[actor.userId] = now;

    notifyChannel(`game:${gameId}`, 'emote:show', {
      userId: actor.userId,
      username: actor.username,
      emote
    });
  };

  // --- Game moves ---
  actions["game:move"] = ({ gameId, fromRow, fromCol, toRow, toCol, expectedPly }) => {
    const room = activeGames.get(gameId);
    if (!room) return reject('Game not found');

    const color = room.getPlayerColor(actor.userId);
    if (!color || getSession(actor.userId)?.gameId !== gameId) return reject('Not in this game');
    if (!room.started) return reject('The game has not started yet');
    room.advanceClock();
    if (room.game.gameOver) {
      room.endReason ||= 'timeout';
      room.endGame(room.game.winner);
      return reject('Game is over');
    }
    if (!Number.isSafeInteger(expectedPly) || expectedPly !== room.game.moveHistory.length) return reject('Stale move; state refreshed');
    if (room.game.currentPlayer !== color) {
      return reject('Not your turn');
    }

    // Clone pre-move state for analysis (async, non-blocking)
    const preMoveClone = room.game.clone();

    const result = room.game.makeMove(fromRow, fromCol, toRow, toCol);
    if (!result) {
      return reject('Invalid move');
    }

    room.version++;

    publishGame(gameId);

    // Async move analysis — don't block the move response
    setTimeout(() => {
      try {
        const analysis = analyzeMoveQuality(preMoveClone, { fromRow, fromCol, toRow, toCol }, color);
        notifyUser(actor.userId, 'game:move-analysis', { gameId, rating: analysis.rating, scoreDiff: analysis.scoreDiff });

        // Check if opponent is a bot — trigger emote reaction to player's move
        const opponentId = room.getOpponentId(actor.userId);
        isBotUser(opponentId).then(isBot => {
          if (!isBot) return;
          return getBotDifficulty(opponentId).then(diff => {
            if (!diff) return;
            const moveNum = room.game.moveHistory?.length || 0;
            const triggers = getAnalysisTriggers(analysis, moveNum);
            for (const trigger of triggers) {
              const emote = shouldEmote(trigger, diff, gameId);
              if (emote) {
                notifyChannel(`game:${gameId}`, 'emote:show', {
                  userId: opponentId,
                  username: 'Bot',
                  emote
                });
                break; // one emote per move
              }
            }
          });
        }).catch(() => {});
      } catch {}
    }, 0);

    if (room.game.gameOver) {
      if (!room.endReason) {
        room.endReason = room.game.drawReason || 'no-moves';
      }
      room.endGame(room.game.winner);
    } else {
      scheduleBotMoveIfNeeded(room);
    }
  };

  // --- Colour reveal finished or skipped ---
  actions["game:reveal-done"] = ({ gameId }) => {
    const room = activeGames.get(gameId);
    if (!room || !room.getPlayerColor(actor.userId) || getSession(actor.userId)?.gameId !== gameId) return reject('Not in this game');
    room.acknowledgeReveal(actor.userId); // idempotent; a repeat simply returns the current snapshot
  };

  // --- Resign ---
  actions["game:resign"] = ({ gameId }) => {
    const room = activeGames.get(gameId);
    if (!room || room.game.gameOver || getSession(actor.userId)?.gameId !== gameId) return;

    const color = room.getPlayerColor(actor.userId);
    if (!color) return;

    const winner = color === 'red' ? 'black' : 'red';
    room.endReason = 'resign';
    room.endGame(winner);
  };

  // --- Draw offer ---
  actions["game:draw-offer"] = ({ gameId }) => {
    const room = activeGames.get(gameId);
    if (!room) return;
    const color = room.getPlayerColor(actor.userId);
    if (!color) return;
    if (room.game.gameOver) return;
    if (room.pendingDrawOffer) return;

    // Cooldown check
    const lastOffer = room.lastDrawOffer[actor.userId] || 0;
    if (Date.now() - lastOffer < DRAW_OFFER_COOLDOWN_MS) {
      return reject({ error: 'Wait before offering again' });
    }

    // Don't allow vs bots
    const opponentId = room.getOpponentId(actor.userId);
    if (room.botIds.has(opponentId)) return reject('Bots do not accept draw offers');

    room.pendingDrawOffer = actor.userId;
    room.lastDrawOffer[actor.userId] = Date.now();
    room.version++;

    publishGame(gameId);

  };

  actions["game:draw-response"] = ({ gameId, accepted }) => {
    const room = activeGames.get(gameId);
    if (!room || room.game.gameOver || typeof accepted !== 'boolean') return;
    if (!room.pendingDrawOffer) return;
    if (room.pendingDrawOffer === actor.userId) return; // can't accept own offer

    const color = room.getPlayerColor(actor.userId);
    if (!color) return;

    const offererId = room.pendingDrawOffer;
    room.pendingDrawOffer = null;
    room.version++;

    if (accepted) {
      room.game.drawReason = 'agreement';
      room.endReason = 'draw-agreement';
      room.endGame(null);
    } else {

      publishGame(gameId);

    }
  };

  // --- Leave game (dismiss game-over screen) ---
  actions["game:leave"] = ({ gameId }) => {
    const session = getSession(actor.userId);
    if (session?.phase !== 'in-game' || session.gameId !== gameId) return publishUser(actor.userId);
    const room = activeGames.get(gameId);
    if (room && !room.game.gameOver) return reject('Finish or resign the game before leaving');


    forceIdle(actor.userId);
    publishUser(actor.userId);
  };

  // --- Rematch ---
  actions["game:rematch-request"] = async ({ gameId }) => {
    const room = activeGames.get(gameId);
    if (!room || !room.game.gameOver || !room.getPlayerColor(actor.userId) || room.rematching) return;
    if (getSession(actor.userId)?.gameId !== gameId) return;

    if (!room.rematchRequests) room.rematchRequests = new Set();
    room.rematchRequests.add(actor.userId);

    const opponentId = room.getOpponentId(actor.userId);

    // Both requested — create new game with swapped colors
    if (room.rematchRequests.size === 2) {
      if (![room.redUserId, room.blackUserId].every(id => getSession(id)?.gameId === gameId && !!getSession(id)?.connectionId)) return;
      room.rematching = true;
      await room.finalization;
      if (![room.redUserId, room.blackUserId].every(id => getSession(id)?.gameId === gameId && !!getSession(id)?.connectionId)) { room.rematching = false; return; }

      await createGameDirect(
        room.blackUserId, // swap: old black is new red
        room.redUserId,
        room.mode, 0, room.game.turnTime, gameId
      );

      room.rematching = false;
    }
  };

  // --- Handle disconnect during game ---
  // Disconnect timers are handled centrally by userState.
  // Here we only handle matchmaking cleanup and opponent notification.
  actions["disconnect"] = () => {
    quickPlayPool.remove(actor.userId);

    // Notify opponent if in an active game
    for (const [gameId, room] of activeGames) {
      if (room.game.gameOver) continue;
      const color = room.getPlayerColor(actor.userId);
      if (!color) continue;

      const opponentId = room.getOpponentId(actor.userId);

      const channelId = `game:${gameId}`;
      prisma.chatMessage.create({
        data: { channelId, senderId: 0, username: 'System', content: `${actor.username} disconnected. Waiting 30s...` }
      }).then(msg => {
        notifyChannel(`chat:${channelId}`, 'chat:message', { id: msg.id, channelId, senderId: 0, username: 'System', content: msg.content, createdAt: msg.createdAt, system: true });
      }).catch(() => {});
    }
  };
  return actions;
}

async function createGameDirect(redUserId, blackUserId, mode, buyIn = 0, turnTime = 60, previousGameId = null) {
  if (redUserId === blackUserId) throw new Error('Players must be different');
  const players = await Promise.all([redUserId, blackUserId].map(id => prisma.user.findUnique({ where: { id } })));
  for (const player of players) {
    if (!player) throw new Error('Player not found');
    if (player.isBot) continue;
    const session = getSession(player.id);
    const rematching = previousGameId !== null && session?.phase === 'in-game' && session.gameId === previousGameId && activeGames.get(previousGameId)?.game.gameOver;
    if (!session || (!rematching && !['idle', 'in-room', 'matchmaking'].includes(session.phase)) || findActiveGameForUser(player.id)) throw new Error('Player is already occupied');
  }
  const gameId = nextGameId++;
  const room = new GameRoom(gameId, redUserId, blackUserId, mode, buyIn, turnTime);
  room.botIds = new Set(players.filter(p => p.isBot).map(p => p.id));
  room.playerNames = Object.fromEntries(players.map(p => [p.id, p.username]));
  activeGames.set(gameId, room);
  for (const [index, player] of players.entries()) {
    if (player.isBot) continue;
    if (previousGameId !== null) forceIdle(player.id);
    setPhase(player.id, 'in-game', { gameId, gameColor: index === 0 ? 'red' : 'black' });
    if (!!!getSession(player.id)?.connectionId) handleDisconnect(player.id);
  }

  // Presence is derived from session phase (already set to 'in-game' above)

  // The clock and the first bot move wait for the colour reveal (see GameRoom.begin).
  room.openReveal(room.botIds);
  publishUser(redUserId);
  publishUser(blackUserId);

  return room;
}

/**
 * If the current player in a game is a bot, schedule a bot move after a natural delay.
 */
async function scheduleBotMoveIfNeeded(gameRoom) {
  if (gameRoom.game.gameOver || gameRoom.botScheduled) return;

  const currentColor = gameRoom.game.currentPlayer;
  const ply = gameRoom.game.moveHistory.length;
  const currentUserId = currentColor === 'red' ? gameRoom.redUserId : gameRoom.blackUserId;
  if (!gameRoom.botIds?.has(currentUserId)) return;
  gameRoom.botScheduled = true;
  let difficulty;
  try {
    difficulty = await getBotDifficulty(currentUserId);
  } catch (err) { console.error('Bot lookup failed:', err); }
  if (!difficulty) { gameRoom.botScheduled = false; return; }

  // Chain continuations are fast (150ms), first move gets natural thinking delay
  const isChain = gameRoom.game.chainPiece != null;
  const delay = isChain ? 150 : (400 + Math.random() * 600);

  setTimeout(() => {
    gameRoom.botScheduled = false;
    if (gameRoom.game.gameOver || activeGames.get(gameRoom.id) !== gameRoom || gameRoom.game.currentPlayer !== currentColor || gameRoom.game.moveHistory.length !== ply) return;

    const move = chooseBotMove(gameRoom.game, difficulty);
    if (!move) return;
    gameRoom.advanceClock();
    if (gameRoom.game.gameOver) {
      gameRoom.endReason = 'timeout';
      gameRoom.endGame(gameRoom.game.winner);
      return;
    }

    const result = gameRoom.game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    if (!result) return;

    gameRoom.version++;

    publishGame(gameRoom.id);

    // Bot emote triggers based on what just happened
    const triggers = getMoveTriggers(result, gameRoom.game, currentColor);
    for (const trigger of triggers) {
      const emote = shouldEmote(trigger, difficulty, gameRoom.id);
      if (emote) {
        notifyChannel(`game:${gameRoom.id}`, 'emote:show', {
          userId: currentUserId,
          username: 'Bot',
          emote
        });
        break;
      }
    }

    if (gameRoom.game.gameOver) {
      if (!gameRoom.endReason) {
        gameRoom.endReason = gameRoom.game.drawReason || 'no-moves';
      }
      gameRoom.endGame(gameRoom.game.winner);
    } else {
      scheduleBotMoveIfNeeded(gameRoom);
    }
  }, delay);
}

export { createGameDirect, scheduleBotMoveIfNeeded };
