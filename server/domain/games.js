import { randomUUID } from 'node:crypto';
import { settleQueuedGame } from '../services/settlementRecovery.js';
import { commitGameTransition, GameRevisionConflict } from '../services/gameTransitions.js';
import { gameplayOwner, GameplayOwnershipLost, inGameplayTransaction } from '../services/gameplayOwnership.js';
import { encodeCheckpoint, decodeCheckpoint, terminalIntentFor } from './gameCheckpoint.js';
import { createGameRun, abortGameStart } from '../services/gameRuns.js';
import { loadRestorableGames } from '../services/gameRestoration.js';
import { restoreGamePlayers } from '../services/gameMembership.js';
import { RESTART_GRACE_MS, readyRecoveryPlayers, recoveryDecision } from './gameRecovery.js';
import { gameResultCode } from '../../shared/gameResult.js';
import { encodeChatText, chatMessageView } from '../services/chat.js';
import { CHAT_EVENTS } from '../../shared/chat.js';
import { setTimeout as delay } from 'node:timers/promises';
import { reject, CommandRejected } from './sessionCommands.js';
import { CheckersGame } from '../../shared/game.js';
import { quickPlayPool } from '../services/quickPlay.js';
import { createQuickPlayRoom, gameRooms, removeFinishedRoomProjection } from './rooms.js';
import { isBotUser, getBotDifficulty } from '../services/botPlayer.js';
import { chooseBotMove, analyzeMoveQuality } from '../services/searchService.js';
import { shouldEmote, getMoveTriggers, getAnalysisTriggers } from '../services/botEmotes.js';
import { publishUser, publishGame, broadcast, notifyChannel, notifyUser } from './events.js';
import { getSession, getOrCreateSession, setPhase, forceIdle, handleDisconnect, getAllSessions, setMatchmakingDeadline } from './sessions.js';
import { armResultExpiry, expireResult, leaveResult, requestResultRematch, pendingResultRematch, refreshResult } from './resultRuntime.js';
import { listResultRecords, readResultRecord } from '../services/resultRecords.js';
import { getBotDisplayName } from './botRegistry.js';
import { getStats } from '../socket/presenceHandler.js';
import { publicUsername } from '../services/publicName.js';
import { createGameEmoteAction } from './gameEmotes.js';
import {
  DRAW_OFFER_COOLDOWN_MS, REVEAL_TIMEOUT_MS, MATCHMAKING_BOT_FALLBACK_MS
} from '../../shared/constants.js';
import prisma from '../db.js';
import { gameplayActions, runGameplayWork, stopGameplayWork } from '../services/gameplayWork.js';

// Active games: gameId -> GameRoom
export const activeGames = new Map();
// Tunable at runtime so tests can exercise the reveal timeout and the search fallback without waiting.
export const gameConfig = { revealTimeoutMs: REVEAL_TIMEOUT_MS };
export const matchmakingConfig = { botFallbackMs: MATCHMAKING_BOT_FALLBACK_MS };
// Human start reservations close the async gap before installation in this process.
const startingPlayers = new Set();

class GameRoom {
  constructor(id, redUserId, blackUserId, mode, buyIn, turnTime, origin, settlementKey, owner) {
    this.id = id;
    this.settlementKey = settlementKey;
    this.owner = owner;
    this.runtimeStopped = false;
    this.game = new CheckersGame(turnTime);
    this.version = 0;
    this.finalization = null;
    this.terminalIntent = null;
    this.stateRevision = 0;
    this.transitions = Promise.resolve();
    this.clockUpdate = null;
    this.ending = null;
    this.resultData = null;
    this.origin = origin;        // 'bot' | 'quickplay' | 'room' - which door opened this game
    this.endedAt = null;         // ms timestamp once the game is over
    this.replayId = null;        // database Game.id once persisted
    this.persistStatus = 'pending'; // 'pending' | 'saved' | 'failed'
    this.botIds = new Set();
    this.playerNames = {};
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
    this.recovery = null;
    this.recoveryTimer = null;
  }

  // Every mutation works on an isolated draft. Database commit precedes both
  // installation and publication, so sync requests cannot see speculative play.
  commit(mutate, command = null) {
    const task = this.transitions.then(async () => {
      if (this.runtimeStopped) throw new GameplayOwnershipLost('Gameplay runtime stopped');
      let value;
      try {
        const saved = await commitGameTransition({ key: this.settlementKey, expectedRevision: this.stateRevision, command }, () => {
          if (command && (getSession(command.userId)?.connectionId !== command.connectionId || getSession(command.userId)?.gameId !== this.id)) reject('Session changed');
          const draft = decodeCheckpoint(encodeCheckpoint(this));
          value = mutate(draft);
          if (value === false) return null;
          if (draft.game.gameOver) {
            draft.endedAt ||= Date.now();
            draft.pendingDrawOffer = null;
            draft.endReason ||= draft.game.drawReason || 'no-moves';
          }
          return encodeCheckpoint(draft);
        }, null, this.owner);
        this.installCommitted(saved);
        return saved.duplicate ? false : value;
      } catch (error) {
        if (error instanceof GameplayOwnershipLost) throw error;
        // A lost commit response is uncertain. Re-read the authoritative revision
        // before returning feedback, never roll it back with an older local copy.
        if (command) {
          try {
            const confirmed = await commitGameTransition({ key: this.settlementKey, expectedRevision: this.stateRevision, command }, () => { throw error; }, null, this.owner);
            this.installCommitted(confirmed);
            return false; // a durable receipt proves this command committed
          } catch (confirmationError) {
            if (confirmationError instanceof GameplayOwnershipLost) throw confirmationError;
          }
        }
        try {
          const run = await inGameplayTransaction(this.owner, null, tx => tx.gameRun.findUnique({ where: { key: this.settlementKey }, include: { resultRecord: true, sourceRoom: true } }));
          if (run?.checkpoint && run.revision > this.stateRevision) this.installCommitted({ checkpoint: run.checkpoint, revision: run.revision, terminalIntent: terminalIntentFor(run, run.checkpoint), resultRecord: run.resultRecord, sourceRoomRecord: run.sourceRoom });
        } catch (readError) {
          if (readError instanceof GameplayOwnershipLost) throw readError;
          // Preserve the last confirmed state until storage returns.
        }
        if (!(error instanceof CommandRejected) && !(error instanceof GameRevisionConflict)) this.lastClockAt = performance.now();
        throw error;
      }
    });
    this.transitions = task.catch(() => {});
    return task;
  }

  installCommitted(saved) {
    if (this.runtimeStopped) return;
    if (!saved.checkpoint || saved.revision <= this.stateRevision) return;
    Object.assign(this, decodeCheckpoint(saved.checkpoint));
    this.stateRevision = saved.revision;
    this.lastClockAt = performance.now();
    this.version++;
    if (saved.terminalIntent) {
      this.terminalIntent = saved.terminalIntent;
      this.resultRecord = saved.resultRecord;
      removeFinishedRoomProjection(saved.sourceRoomRecord);
      this.stopTimer(); clearTimeout(this.revealTimer); this.revealTimer = null;
      clearTimeout(this.recoveryTimer); this.recoveryTimer = null;
      this.botWork?.abort(); this.analysisWork?.abort();
      this.finalization ||= Promise.resolve().then(() => this.persistResult());
      armResultExpiry(this);
    } else if (this.recovery) {
      this.stopTimer(); clearTimeout(this.revealTimer); this.revealTimer = null;
      this.botWork?.abort(); this.analysisWork?.abort();
    } else if (this.started && !this.timerInterval) {
      clearTimeout(this.revealTimer); this.revealTimer = null;
      this.startTimer();
      setTimeout(() => scheduleBotMoveIfNeeded(this), 500);
    }
    publishGame(this.id);
  }

  async openReveal(botIds, timeoutMs = gameConfig.revealTimeoutMs) {
    if (this.revealDeadline === null) await this.commit(draft => {
      for (const id of botIds) draft.revealAcks.add(id);
      draft.revealDeadline = Date.now() + timeoutMs;
    });
  }

  recoveryHumans() { return [this.redUserId, this.blackUserId].filter(id => !this.botIds.has(id)); }

  recoveryView() {
    if (!this.recovery || this.game.gameOver) return null;
    return { generation: this.recovery.generation, deadline: this.recovery.deadline,
      readyUserIds: readyRecoveryPlayers(this.recovery, this.recoveryHumans(), id => getSession(id)?.connectionId) };
  }

  evaluateRecovery(draft, now = Date.now()) {
    if (!draft.recovery || draft.game.gameOver) return false;
    const decision = recoveryDecision(draft.recovery, this.recoveryHumans(), id => getSession(id)?.connectionId, now);
    if (decision.type === 'wait') return false;
    draft.recovery = null;
    if (decision.type === 'resume') {
      // An interrupted reveal has already assigned colours. Explicit readiness
      // replaces its remaining animation, while an existing game keeps its start.
      if (!draft.started) { draft.started = true; draft.startedAt = new Date(now); }
    } else {
      draft.game.gameOver = true;
      draft.game.winner = decision.type === 'forfeit' ? this.getPlayerColor(decision.winnerId) : null;
      draft.endReason = decision.type === 'forfeit' ? 'restart-disconnect' : 'restart-abandoned';
    }
  }

  acknowledgeRecovery(userId, generation, command) {
    return this.commit(draft => {
      if (!draft.recovery || draft.game.gameOver) return false;
      if (generation !== draft.recovery.generation) reject('This recovery belongs to an older server');
      const connection = getSession(userId)?.connectionId;
      if (!this.getPlayerColor(userId) || !connection) reject('Session changed');
      // A late acknowledgement cannot rewrite a deadline outcome.
      if (Date.now() >= draft.recovery.deadline) return this.evaluateRecovery(draft);
      draft.recovery.readyConnections[userId] = connection;
      this.evaluateRecovery(draft);
    }, command);
  }

  armRecovery(delayMs = Math.max(0, (this.recovery?.deadline || 0) - Date.now())) {
    clearTimeout(this.recoveryTimer); this.recoveryTimer = null;
    if (this.runtimeStopped || !this.recovery || this.game.gameOver) return;
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      void this.commit(draft => this.evaluateRecovery(draft)).catch(error => {
        console.error('Restart recovery transition failed:', error.message);
      }).finally(() => this.armRecovery(1000));
    }, delayMs);
    this.recoveryTimer.unref?.();
  }

  armReveal(delayMs = Math.max(0, this.revealDeadline - Date.now())) {
    if (this.runtimeStopped || this.recovery) return;
    clearTimeout(this.revealTimer);
    this.revealTimer = setTimeout(() => {
      void this.begin().catch(error => {
        console.error('Reveal transition failed:', error.message);
        if (!this.started && !this.game.gameOver) this.armReveal(1000);
      });
    }, delayMs);
    this.revealTimer.unref?.();
  }

  acknowledgeReveal(userId, command = null) {
    if (!this.getPlayerColor(userId)) return Promise.resolve();
    return this.commit(draft => {
      if (draft.recovery || draft.started || draft.game.gameOver || draft.revealAcks.has(userId)) return false;
      draft.revealAcks.add(userId);
      if ([this.redUserId, this.blackUserId].every(id => draft.revealAcks.has(id))) {
        draft.started = true; draft.startedAt = new Date();
      }
    }, command);
  }

  begin() {
    if (this.started || this.game.gameOver) return Promise.resolve();
    return this.commit(draft => {
      if (draft.recovery || draft.started || draft.game.gameOver) return false;
      draft.started = true; draft.startedAt = new Date();
    });
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
    if (this.runtimeStopped || this.recovery) return;
    this.stopTimer();
    this.lastClockAt = performance.now();
    this.timerInterval = setInterval(() => {
      if (this.game.gameOver) return this.stopTimer();
      void this.advanceClock().catch(error => console.error('Clock transition failed:', error.message));
    }, 1000);
    this.timerInterval.unref?.();
  }

  stopTimer() {
    clearInterval(this.timerInterval); this.timerInterval = null;
  }

  advanceDraftClock(draft) {
    if (!draft.started || draft.recovery || this.lastClockAt === null || draft.game.gameOver) return;
    draft.game.tickTime(Math.max(0, performance.now() - this.lastClockAt) / 1000);
    if (draft.game.gameOver) draft.endReason = 'timeout';
  }

  advanceClock() {
    if (!this.started || this.recovery || this.game.gameOver || !this.game.turnTime) return Promise.resolve();
    if (!this.clockUpdate) this.clockUpdate = this.commit(draft => {
      if (draft.game.gameOver) return false;
      this.advanceDraftClock(draft);
    }).finally(() => { this.clockUpdate = null; });
    return this.clockUpdate;
  }

  endGame(winner, reason = this.endReason, command = null, guard = () => true) {
    if (this.finalization) return this.finalization;
    if (!this.ending) this.ending = this.commit(draft => {
      if (!guard()) return false;
      this.advanceDraftClock(draft);
      if (draft.game.gameOver) return;
      draft.game.gameOver = true; draft.game.winner = winner;
      draft.endReason = reason || draft.game.drawReason || 'no-moves';
    }, command).then(() => {
      const result = this.finalization;
      if (!result) this.ending = null;
      return result;
    }).catch(error => { this.ending = null; throw error; });
    return this.ending;
  }

  persistResult() {
    return runGameplayWork(async work => {
      if (this.persistStatus === 'saved' || this.runtimeStopped || this.owner !== work.owner) return;
      let receipt = null;
      try { receipt = await settleQueuedGame(this.settlementKey); }
      catch (error) { console.error('Failed to settle game result:', error); }
      if (work.isCurrent() && !this.runtimeStopped) await this.acceptSettlement(receipt);
    });
  }

  async acceptSettlement(receipt) {
    if (this.persistStatus === 'saved' || this.runtimeStopped) return;
    this.stopTimer();
    const winner = this.terminalIntent.winner;
    const result = gameResultCode(winner, this.endReason);
    const winnerId = winner === 'red' ? this.redUserId : winner === 'black' ? this.blackUserId : null;
    this.recordSaved(receipt ? { id: receipt.replayId } : null);
    this.resultData = {
      winner, result, winnerId, gameId: this.id, replayId: this.replayId,
      persistStatus: this.persistStatus, endedAt: this.endedAt,
      moveHistory: this.game.moveHistory,
      eloChanges: receipt?.eloChanges ?? { red: 0, black: 0 },
      eloDetail: receipt?.eloDetail ?? {},
      coinRewards: receipt?.coinRewards ?? { red: 0, black: 0 },
      coinBreakdown: receipt?.coinBreakdown ?? { red: [], black: [] },
      milestones: receipt?.milestones ?? { red: [], black: [] },
      endReason: this.endReason || this.game.drawReason || 'no-moves',
      drawReason: this.game.drawReason || null
    };
    this.version++;

    publishGame(this.id);

    // Broadcast to all connected clients for the global game log. The payload carries the
    // database id so the log can open the right replay; without a row there is nothing to open.
    if (this.replayId !== null) {
      // Optional previews use their own bounded worker; they never delay results.
      if (this.mode === 'RANKED') void import('../og/service.js').then(({ cardService }) => {
        if (!this.runtimeStopped) return cardService.get('game', String(this.replayId));
      }).catch(() => {});
      let redName = this.playerNames[this.redUserId];
      let blackName = this.playerNames[this.blackUserId];
      if (!redName || !blackName) {
        try {
          if (!redName) { const u = await prisma.user.findUnique({ where: { id: this.redUserId }, select: { username: true } }); redName = u?.username || 'Unknown'; }
          if (!blackName) { const u = await prisma.user.findUnique({ where: { id: this.blackUserId }, select: { username: true } }); blackName = u?.username || 'Unknown'; }
        } catch {}
      }
      if (this.runtimeStopped) return;
      broadcast('global:game-ended', {
        id: this.replayId,
        redPlayer: publicUsername(redName),
        blackPlayer: publicUsername(blackName),
        result,
        mode: this.mode,
        isBotGame: this.botIds.size > 0,
        date: new Date(this.endedAt).toISOString(),
        endedAt: new Date(this.endedAt).toISOString(),
      });
    }

    if (!this.runtimeStopped) armResultExpiry(this);
  }

  expireResultViews(now = Date.now()) { return expireResult(this, now); }

  recordSaved(saved) {
    if (saved?.id) { this.replayId = saved.id; this.persistStatus = 'saved'; }
    else if (this.replayId === null) this.persistStatus = 'failed';
  }

  getState() {
    return {
      gameId: this.id,
      version: this.version,
      mode: this.mode,
      origin: this.origin,
      botDifficulty: this.botDifficulty ?? null,
      endedAt: this.endedAt,
      replayId: this.replayId,
      persistStatus: this.persistStatus,
      started: this.started,
      recovery: this.recoveryView(),
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
      rematchRequests: this.resultRecord?.state.players.filter(p => p.requested).map(p => p.userId) || [],
      rematchPending: pendingResultRematch(this)
    };
  }
}

export function stopGameRuntime() {
  const pending = [stopGameplayWork()];
  for (const room of activeGames.values()) {
    room.runtimeStopped = true;
    room.stopTimer();
    clearTimeout(room.revealTimer); clearTimeout(room.cleanupTimer); clearTimeout(room.botRetryTimer); clearTimeout(room.recoveryTimer); clearTimeout(room.resultRetryTimer);
    room.cleanupTimer = null; room.resultRetryTimer = null;
    room.botWork?.abort(); room.analysisWork?.abort();
    pending.push(room.transitions);
    if (room.resultChanges) pending.push(room.resultChanges);
    if (room.finalization) pending.push(room.finalization);
  }
  return Promise.allSettled(pending);
}

export async function publishRecoveredSettlement(key, receipt) {
  const room = [...activeGames.values()].find(game => game.settlementKey === key);
  if (room) await room.acceptSettlement(receipt);
}

export function findActiveGameForUser(userId) {
  for (const [gameId, room] of activeGames) {
    if (room.game.gameOver) continue;
    const color = room.getPlayerColor(userId);
    if (color) return { gameId, room, color };
  }
  return null;
}

function roomFromRun(run, players, owner) {
  const room = new GameRoom(run.id, run.redPlayerId, run.blackPlayerId, run.mode, run.buyIn, run.turnTime, run.origin, run.key, owner);
  room.game = Object.assign(new CheckersGame(run.turnTime), structuredClone(run.initialState));
  if (run.checkpoint) Object.assign(room, decodeCheckpoint(run.checkpoint));
  room.stateRevision = run.revision;
  room.botIds = new Set(players.filter(p => p.isBot).map(p => p.id));
  room.botDifficulty = players.find(p => p.isBot)?.botKey ?? null;
  room.invitedPlayerIds = new Set(run.invitedPlayerIds || []);
  room.playerNames = Object.fromEntries(players.map(p => [p.id, p.username]));
  return room;
}

// Startup calls this before accepting any connections or starting matchmaking.
// Terminal jobs are handled separately by settlement recovery; old result-sheet
// membership cannot be inferred from a historical replay.
export async function restoreActiveGames({ graceMs = RESTART_GRACE_MS } = {}) {
  if (!Number.isSafeInteger(graceMs) || graceMs <= 0) throw Error('Invalid restart grace period');
  if (activeGames.size || [...getAllSessions().values()].some(s => s.phase !== 'idle')) throw Error('Game restoration requires an empty runtime');
  const owner = gameplayOwner();
  const { live, uninstalled } = await loadRestorableGames(owner);
  for (const run of uninstalled) await abortGameStart(run.key, null, owner);
  await restoreGamePlayers(live, owner);
  const deadline = Date.now() + graceMs;
  for (const run of live) {
    const saved = await commitGameTransition({ key: run.key, expectedRevision: run.revision }, () => {
      const draft = decodeCheckpoint(run.checkpoint);
      draft.recovery = { generation: owner.generation, deadline, readyConnections: {} };
      return encodeCheckpoint(draft);
    }, null, owner);
    const players = [run.redPlayer, run.blackPlayer];
    const room = roomFromRun({ ...run, checkpoint: saved.checkpoint, revision: saved.revision }, players, owner);
    activeGames.set(room.id, room);
    for (const player of players) {
      if (player.isBot) continue;
      getOrCreateSession(player.id, player.username, player.isGuest);
      setPhase(player.id, 'in-game', { gameId: room.id, gameColor: room.getPlayerColor(player.id) });
    }
  }
  for (const room of activeGames.values()) room.armRecovery();
  return { restored: live.length, cancelledStarts: uninstalled.length };
}

// Result membership is restored only from accepted viewer records, never inferred
// from replays. Startup has already restored (or cancelled) any rematch children.
export function restoreFinishedGames() {
  return runGameplayWork(async work => {
    const records = await listResultRecords(work.owner);
    const bundles = [];
    for (const { gameRunId } of records) {
      const bundle = await readResultRecord(gameRunId, work.owner);
      decodeCheckpoint(bundle.run.checkpoint);
      bundles.push(bundle);
    }
    work.assertCurrent();
    let restored = 0;
    for (const bundle of bundles) {
      const room = roomFromRun(bundle.run, bundle.users, work.owner);
      room.terminalIntent = terminalIntentFor(bundle.run, bundle.run.checkpoint);
      room.resultRecord = bundle.record; room.resultChild = bundle.child;
      activeGames.set(room.id, room);
      // Expire before creating sessions so a late restart cannot revive a view.
      await expireResult(room);
      work.assertCurrent();
      if (!activeGames.has(room.id)) continue;
      await refreshResult(room, work, true);
      room.finalization = room.persistResult();
      await room.finalization;
      work.assertCurrent();
      restored++;
    }
    return { restored };
  });
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
  const durable = request => request ? { userId: actor.userId, connectionId: actor.connectionId,
    key: request.id, payload: { type: request.type, data: request.data || {} } } : null;
  // --- Quick Play Matchmaking ---
  actions["matchmaking:join"] = async (_data, _request, work) => {
    const mmSession = getSession(actor.userId);
    if (!mmSession || mmSession.phase !== 'idle') {
      return reject({ error: 'Cannot search while in a room or game' });
    }
    const player = await prisma.user.findUnique({ where: { id: actor.userId } });
    work.assertCurrent();
    if (!player || mmSession.phase !== 'idle' || mmSession.connectionId !== actor.connectionId) return reject('Session changed');
    const elo = player.elo;
    setPhase(actor.userId, 'matchmaking');
    // Server-owned fallback deadline: 20 s with company, immediately when nobody else is online.
    // The session timer republishes at the deadline so `fallbackOpen` flips without a tick.
    const joinedAt = Date.now();
    const alone = getStats().humansOnline <= 1;
    const fallbackAt = alone ? joinedAt : joinedAt + matchmakingConfig.botFallbackMs;
    setMatchmakingDeadline(actor.userId, joinedAt, fallbackAt, () => publishUser(actor.userId));
    quickPlayPool.add(actor.userId, elo, !!player.isGuest);

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
  actions['emote:send'] = createGameEmoteAction(actor, { getGame: id => activeGames.get(id), getSession,
    publish: (gameId, value) => notifyChannel(`game:${gameId}`, 'emote:show', value) });

  // --- Game moves ---
  actions["game:move"] = async ({ gameId, fromRow, fromCol, toRow, toCol, expectedPly }, request, work) => {
    const room = activeGames.get(gameId);
    if (!room) return reject('Game not found');

    const color = room.getPlayerColor(actor.userId);
    if (!color || getSession(actor.userId)?.gameId !== gameId) return reject('Not in this game');
    if (!room.started) return reject('The game has not started yet');
    const committed = await room.commit(draft => {
      room.advanceDraftClock(draft);
      if (draft.recovery) reject('Waiting for players to resume after server restart');
      if (draft.game.gameOver) return { timedOut: true };
      if (!Number.isSafeInteger(expectedPly) || expectedPly !== draft.game.moveHistory.length) reject('Stale move; state refreshed');
      if (draft.game.currentPlayer !== color) reject('Not your turn');
      const preMoveClone = draft.game.clone();
      const result = draft.game.makeMove(fromRow, fromCol, toRow, toCol);
      if (!result) reject('Invalid move');
      return { preMoveClone, result };
    }, durable(request));
    work.assertCurrent();
    if (!committed) return; // a durable duplicate has already been applied
    if (committed.timedOut) return reject('Game is over');
    const { preMoveClone } = committed;

    // Async move analysis — don't block the move response
    room.analysisWork?.abort();
    const analysisWork = new AbortController();
    room.analysisWork = analysisWork;
    const analysisPly = room.game.moveHistory.length;
    const currentAnalysis = () => work.isCurrent() && !room.runtimeStopped && !analysisWork.signal.aborted &&
      room.analysisWork === analysisWork && activeGames.get(gameId) === room && room.game.moveHistory.length === analysisPly;
    void runGameplayWork(async () => {
      try {
        if (!currentAnalysis()) return;
        const analysis = await analyzeMoveQuality(preMoveClone, { fromRow, fromCol, toRow, toCol }, color, { signal: analysisWork.signal });
        if (!analysis || !currentAnalysis()) return;
        notifyUser(actor.userId, 'game:move-analysis', { gameId, ply: analysisPly, rating: analysis.rating, scoreDiff: analysis.scoreDiff });

        // Check if opponent is a bot — trigger emote reaction to player's move
        const opponentId = room.getOpponentId(actor.userId);
        return isBotUser(opponentId).then(isBot => {
          if (!isBot || !currentAnalysis()) return;
          return getBotDifficulty(opponentId).then(diff => {
            if (!diff || !currentAnalysis()) return;
            const moveNum = room.game.moveHistory?.length || 0;
            const triggers = getAnalysisTriggers(analysis, moveNum);
            for (const trigger of triggers) {
              const emote = shouldEmote(trigger, diff, gameId);
              if (emote) {
                notifyChannel(`game:${gameId}`, 'emote:show', {
                  gameId,
                  userId: opponentId,
                  username: getBotDisplayName(diff),
                  emote
                });
                break; // one emote per move
              }
            }
          });
        }).catch(() => {});
      } catch {}
    }).catch(() => {}); // Optional analysis may be cancelled before admission.

    if (!room.game.gameOver) scheduleBotMoveIfNeeded(room);
  };

  // --- Colour reveal finished or skipped ---
  actions['game:recovery-ready'] = ({ gameId, generation }, request) => {
    const room = activeGames.get(gameId);
    if (!room || !room.getPlayerColor(actor.userId) || getSession(actor.userId)?.gameId !== gameId) return reject('Not in this game');
    return room.acknowledgeRecovery(actor.userId, generation, durable(request));
  };

  actions["game:reveal-done"] = ({ gameId }, request) => {
    const room = activeGames.get(gameId);
    if (!room || !room.getPlayerColor(actor.userId) || getSession(actor.userId)?.gameId !== gameId) return reject('Not in this game');
    return room.acknowledgeReveal(actor.userId, durable(request));
  };

  // --- Resign ---
  actions["game:resign"] = ({ gameId }, request) => {
    const room = activeGames.get(gameId);
    if (!room || room.game.gameOver || getSession(actor.userId)?.gameId !== gameId) return;

    const color = room.getPlayerColor(actor.userId);
    if (!color) return;

    const winner = color === 'red' ? 'black' : 'red';
    return room.endGame(winner, 'resign', durable(request));
  };

  // --- Draw offer ---
  actions["game:draw-offer"] = ({ gameId }, request) => {
    const room = activeGames.get(gameId);
    if (!room || !room.getPlayerColor(actor.userId) || room.game.gameOver) return;
    if (room.botIds.has(room.getOpponentId(actor.userId))) reject('Bots do not accept draw offers');
    return room.commit(draft => {
      if (draft.recovery) reject('Resume the game before offering a draw');
      if (draft.pendingDrawOffer) return false;
      const now = Date.now();
      if (now - (draft.lastDrawOffer[actor.userId] || 0) < DRAW_OFFER_COOLDOWN_MS) reject('Wait before offering again');
      room.advanceDraftClock(draft);
      if (draft.game.gameOver) return;
      draft.pendingDrawOffer = actor.userId;
      draft.lastDrawOffer[actor.userId] = now;
    }, durable(request));
  };

  actions["game:draw-response"] = ({ gameId, accepted }, request) => {
    const room = activeGames.get(gameId);
    if (!room || room.game.gameOver || typeof accepted !== 'boolean' || !room.getPlayerColor(actor.userId)) return;
    return room.commit(draft => {
      if (draft.recovery) reject('Resume the game before answering a draw');
      if (!draft.pendingDrawOffer || draft.pendingDrawOffer === actor.userId) return false;
      room.advanceDraftClock(draft);
      draft.pendingDrawOffer = null;
      if (accepted && !draft.game.gameOver) {
        draft.game.drawReason = 'agreement'; draft.endReason = 'draw-agreement';
        draft.game.gameOver = true; draft.game.winner = null;
      }
    }, durable(request));
  };

  // Result commands commit membership/consent before publishing session changes.
  actions["game:leave"] = ({ gameId }, request) => {
    const session = getSession(actor.userId);
    if (session?.phase !== 'in-game' || session.gameId !== gameId) return publishUser(actor.userId);
    const room = activeGames.get(gameId);
    if (!room?.game.gameOver) return reject('Finish or resign the game before leaving');
    return leaveResult(room, actor.userId, request, () => getSession(actor.userId) === session &&
      session.connectionId === actor.connectionId && session.gameId === gameId);
  };

  actions["game:rematch-request"] = ({ gameId }, request) => {
    const room = activeGames.get(gameId), session = getSession(actor.userId);
    if (!room?.game.gameOver || !room.getPlayerColor(actor.userId) || session?.gameId !== gameId) return reject('Not viewing this result');
    return requestResultRematch(room, actor.userId, request, () => getSession(actor.userId) === session &&
      session.connectionId === actor.connectionId && session.gameId === gameId);
  };

  // --- Handle disconnect during game ---
  // Disconnect timers are handled centrally by userState.
  // Here we only handle matchmaking cleanup and opponent notification.
  actions["disconnect"] = () => {
    quickPlayPool.remove(actor.userId);

    // Notify opponent if in an active game
    for (const [gameId, room] of activeGames) {
      if (room.runtimeStopped || room.game.gameOver) continue;
      const color = room.getPlayerColor(actor.userId);
      if (!color) continue;

      const opponentId = room.getOpponentId(actor.userId);

      const channelId = `game:${gameId}`;
      prisma.chatMessage.create({
        data: { channelId, senderId: 0, username: 'System', content: encodeChatText(`${actor.username} disconnected.`) }
      }).then(msg => {
        notifyChannel(`chat:${channelId}`, CHAT_EVENTS.message, { ...chatMessageView(msg), system: true });
      }).catch(() => {});
    }
  };
  return gameplayActions(actions, ['disconnect']);
}

// origin: 'bot' | 'quickplay' | 'room'. Any game with a bot at the board is a bot game,
// whichever door opened it, because "play again" for it is `bot:play`, not a rematch.
function createGameDirect(...args) {
  return runGameplayWork(work => createGameInRuntime(work, ...args));
}

async function createGameInRuntime(work, redUserId, blackUserId, mode, buyIn = 0, turnTime = 60, previousGameId = null, origin = 'room', creationKey = randomUUID(), source = {}) {
  const { owner } = work;
  if (redUserId === blackUserId) throw new Error('Players must be different');
  const players = await Promise.all([redUserId, blackUserId].map(id => prisma.user.findUnique({ where: { id } })));
  work.assertCurrent();
  const contexts = new Map();
  for (const player of players) {
    if (!player) throw new Error('Player not found');
    if (player.isBot) continue;
    const session = getSession(player.id);
    const rematching = previousGameId !== null && session?.phase === 'in-game' && session.gameId === previousGameId && activeGames.get(previousGameId)?.game.gameOver;
    if (!session || startingPlayers.has(player.id) || (!rematching && !['idle', 'in-room', 'matchmaking'].includes(session.phase)) || findActiveGameForUser(player.id)) throw new Error('Player is already occupied');
    contexts.set(player.id, { session, phase: session.phase, roomId: session.roomId, gameId: session.gameId });
  }
  for (const id of contexts.keys()) startingPlayers.add(id);
  try {
    // Under this owner, all restored/installed games are in activeGames and all
    // in-flight human starts are guarded above. A missing runtime can therefore
    // only be an uninstalled attempt. The repository still refuses cancellation
    // of any accepted play or terminal intent; absence alone never resets a game.
    const occupied = await inGameplayTransaction(owner, null, tx => tx.activeGamePlayer.findMany({
      where: { userId: { in: [...contexts.keys()] } }, include: { run: { select: { key: true } } }
    }));
    work.assertCurrent();
    for (const seat of occupied) {
      if (seat.run.key !== creationKey && !activeGames.has(seat.gameRunId)) await abortGameStart(seat.run.key, null, owner);
      work.assertCurrent();
    }
    const hasBot = players.some(p => p.isBot);
    const run = await createGameRun({ key: creationKey, redPlayerId: redUserId, blackPlayerId: blackUserId,
      mode, buyIn, turnTime, origin: hasBot ? 'bot' : origin, roomId: source.roomId ?? null, resultSourceId: source.resultSourceId ?? null }, null, owner);
    if (run.status !== 'OPEN') {
      const error = new Error('This game start is already closed');
      error.startAborted = run.status === 'ABORTED'; throw error;
    }
    if (activeGames.has(run.id)) { work.assertCurrent(); return activeGames.get(run.id); }
    const unchanged = () => work.isCurrent() && [...contexts].every(([id, before]) => {
      const current = getSession(id);
      return current === before.session && current.phase === before.phase && current.roomId === before.roomId && current.gameId === before.gameId &&
        (source.resultSourceId == null || !!current.connectionId);
    });
    if (!unchanged()) {
      await abortGameStart(run.key, null, owner);
      const error = new Error('Player context changed while the game was starting');
      error.startAborted = true; throw error;
    }
    const gameId = run.id;
    const room = roomFromRun(run, players, owner);
    await room.openReveal(room.botIds);
    if (!unchanged()) {
      await abortGameStart(run.key, null, owner);
      const error = new Error('Player context changed while the game was starting');
      error.startAborted = true; throw error;
    }
    activeGames.set(gameId, room);
    for (const [index, player] of players.entries()) {
      if (player.isBot) continue;
      if (previousGameId !== null) forceIdle(player.id);
      setPhase(player.id, 'in-game', { gameId, gameColor: index === 0 ? 'red' : 'black' });
      if (!getSession(player.id)?.connectionId) handleDisconnect(player.id);
    }
    if (!room.started) room.armReveal();
    else room.startTimer();
    publishUser(redUserId); publishUser(blackUserId);
    return room;
  } finally {
    for (const id of contexts.keys()) startingPlayers.delete(id);
  }
}

/**
 * If the current player in a game is a bot, schedule a bot move after a natural delay.
 */
async function scheduleBotMoveIfNeeded(gameRoom) {
  if (gameRoom.runtimeStopped || gameRoom.recovery || !gameRoom.started || gameRoom.game.gameOver || gameRoom.botScheduled) return;
  const currentColor = gameRoom.game.currentPlayer;
  const ply = gameRoom.game.moveHistory.length;
  const currentUserId = currentColor === 'red' ? gameRoom.redUserId : gameRoom.blackUserId;
  if (!gameRoom.botIds?.has(currentUserId)) return;
  const work = new AbortController();
  gameRoom.botWork = work;
  gameRoom.botScheduled = true;
  const current = () => !work.signal.aborted && gameRoom.botWork === work
    && !gameRoom.game.gameOver && activeGames.get(gameRoom.id) === gameRoom
    && gameRoom.game.currentPlayer === currentColor && gameRoom.game.moveHistory.length === ply;
  let moved = false;
  try {
    let difficulty;
    try { difficulty = await getBotDifficulty(currentUserId); }
    catch (err) { console.warn('Bot difficulty lookup failed; using medium:', err.message); }
    difficulty ??= 'medium';
    if (!current()) return;
    await delay(gameRoom.game.chainPiece ? 150 : 400 + Math.random() * 600, undefined, { signal: work.signal });
    if (!current()) return;
    const move = await chooseBotMove(gameRoom.game, difficulty, { signal: work.signal });
    if (!current() || !move) return;
    const committed = await gameRoom.commit(draft => {
      if (!current()) return false;
      gameRoom.advanceDraftClock(draft);
      if (draft.game.gameOver) return { timedOut: true };
      const result = draft.game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
      if (!result) throw new Error('Bot worker proposed an illegal move');
      return { result };
    });
    if (!committed || committed.timedOut) return;
    const { result } = committed;
    moved = true;
    for (const trigger of getMoveTriggers(result, gameRoom.game, currentColor)) {
      const emote = shouldEmote(trigger, difficulty, gameRoom.id);
      if (emote) {
        notifyChannel('game:' + gameRoom.id, 'emote:show', { gameId: gameRoom.id, userId: currentUserId, username: getBotDisplayName(difficulty), emote });
        break;
      }
    }
  } catch (err) {
    if (!work.signal.aborted) console.error('Bot turn failed:', err);
  } finally {
    if (gameRoom.botWork === work) {
      gameRoom.botWork = null;
      gameRoom.botScheduled = false;
      if (!gameRoom.runtimeStopped && !gameRoom.game.gameOver && activeGames.get(gameRoom.id) === gameRoom) {
        if (moved) void scheduleBotMoveIfNeeded(gameRoom);
        else {
          clearTimeout(gameRoom.botRetryTimer);
          gameRoom.botRetryTimer = setTimeout(() => scheduleBotMoveIfNeeded(gameRoom), 1000);
          gameRoom.botRetryTimer.unref?.();
        }
      }
    }
  }
}

export { createGameDirect, scheduleBotMoveIfNeeded };
