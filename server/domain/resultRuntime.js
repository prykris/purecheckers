import { readResultRecord, commitResultCommand, cancelResultRematch } from '../services/resultRecords.js';
import { runGameplayWork } from '../services/gameplayWork.js';
import { inGameplayTransaction } from '../services/gameplayOwnership.js';
import { activeGames, createGameDirect } from './games.js';
import { resultViewers, ResultActionRejected } from './resultState.js';
import { CommandRejected } from './sessionCommands.js';
import { getSession, getAllSessions, getOrCreateSession, setPhase, forceIdle, applySessionNotice } from './sessions.js';
import { publishGame, publishUser } from './events.js';
import { cleanupGame } from '../services/botEmotes.js';

const viewsGame = (session, id) => session?.gameId === id || session?.spectatingGameId === id;
export function pendingResultRematch(game) {
  return game.resultRecord?.status === 'STARTING' || (game.resultRecord?.status === 'REMATCHED' &&
    game.resultChild?.status === 'OPEN' && !game.resultChild.checkpoint?.engine?.gameOver && !activeGames.has(game.resultChild.id));
}

export async function refreshResult(game, work, restore = false) {
  const previous = [...getAllSessions().values()].filter(s => viewsGame(s, game.id));
  const bundle = await readResultRecord(game.id, work.owner, previous.map(s => s.userId));
  work.assertCurrent();
  if (game.runtimeStopped || game.owner !== work.owner) throw Error('Result runtime stopped');
  if (game.resultRecord && bundle.record.revision < game.resultRecord.revision) return bundle;
  game.resultRecord = bundle.record; game.resultChild = bundle.child; game.version++;
  const viewers = resultViewers({ status: bundle.record.status, ...bundle.record.state });
  const pending = pendingResultRematch(game);
  const wanted = new Set(viewers.map(p => p.userId));
  // Until a reserved child is installed, its accepted request remains visible
  // in the old result. The factory or cancellation decides the next game view.
  if (pending) for (const p of bundle.record.state.players) if (!game.botIds.has(p.userId)) wanted.add(p.userId);
  for (const user of bundle.users) {
    if (restore && wanted.has(user.id)) getOrCreateSession(user.id, user.username, user.isGuest);
    applySessionNotice(user.id, user.sessionNotices[0]);
  }
  for (const session of previous) {
    if (!wanted.has(session.userId) && viewsGame(session, game.id)) { forceIdle(session.userId); publishUser(session.userId); }
  }
  for (const userId of wanted) {
    const session = getSession(userId);
    if (!session) continue;
    const spectator = bundle.record.state.spectators.find(p => p.userId === userId);
    if (viewsGame(session, game.id)) continue;
    if (session.phase !== 'idle' && !(spectator && session.phase === 'spectating' && session.spectatingRoomId === spectator.roomId))
      throw Error('Result membership conflicts with the current session');
    setPhase(userId, spectator ? 'spectating' : 'in-game', spectator
      ? { spectatingRoomId: spectator.roomId, spectatingGameId: game.id }
      : { gameId: game.id, gameColor: game.getPlayerColor(userId) });
  }
  return bundle;
}

function retireEmptyResult(game) {
  const record = game.resultRecord;
  if (!record || pendingResultRematch(game) || resultViewers({ status: record.status, ...record.state }).length) return false;
  clearTimeout(game.cleanupTimer); clearTimeout(game.resultRetryTimer);
  game.cleanupTimer = null; game.resultRetryTimer = null;
  game.runtimeStopped = true;
  if (activeGames.get(game.id) === game) activeGames.delete(game.id);
  cleanupGame(game.id); return true;
}

export function armResultExpiry(game, retryDelay = null) {
  clearTimeout(game.cleanupTimer);
  if (game.runtimeStopped || activeGames.get(game.id) !== game || !game.resultRecord || retireEmptyResult(game)) return;
  const state = game.resultRecord.state;
  const deadlines = [...(state.players.some(p => p.viewing) || pendingResultRematch(game) ? [state.deadline] : []), ...state.spectators.map(p => p.deadline)];
  if (!deadlines.length) return;
  game.cleanupTimer = setTimeout(() => {
    void expireResult(game).catch(error => { console.error('Result expiry failed:', error.message); armResultExpiry(game, 1000); });
  }, retryDelay ?? Math.max(0, Math.min(...deadlines) - Date.now()));
  game.cleanupTimer.unref?.();
}

function queueResult(game, operation) {
  const previous = game.resultChanges || Promise.resolve();
  const task = runGameplayWork(async work => {
    await previous.catch(() => {}); work.assertCurrent();
    if (game.runtimeStopped || game.owner !== work.owner) throw Error('Result runtime stopped');
    await refreshResult(game, work);
    try { return await operation(work); }
    catch (error) { throw error instanceof ResultActionRejected ? new CommandRejected(error.message) : error; }
    finally { if (work.isCurrent() && !game.runtimeStopped) { publishGame(game.id); armResultExpiry(game); } }
  });
  game.resultChanges = task.catch(() => {});
  return task;
}

async function changeResult(game, work, action, { request = null, guard = () => true, now = null } = {}) {
  const input = { gameRunId: game.id, expectedRevision: game.resultRecord.revision, action, now,
    command: request ? { userId: action.userId, key: request.id } : null,
    guard: () => work.isCurrent() && !game.runtimeStopped && guard() };
  try { await commitResultCommand(input, null, work.owner); }
  catch (error) {
    if (input.command) {
      try { await commitResultCommand({ ...input, guard: () => false }, null, work.owner); }
      catch { await refreshResult(game, work); throw error; }
    } else {
      await refreshResult(game, work);
      if (game.resultRecord.status !== 'CLOSED') throw error;
    }
  }
  await refreshResult(game, work);
}

async function cancelPending(game, work, now = Date.now(), guard = () => true) {
  const cancel = () => cancelResultRematch(game.id, null, work.owner, { now, guard: () => work.isCurrent() && !game.runtimeStopped && guard() });
  try { await cancel(); } catch (error) { try { await cancel(); } catch { throw error; } }
  await refreshResult(game, work);
}

export function leaveResult(game, userId, request = null, guard = () => true) {
  return queueResult(game, async work => {
    if (!guard()) throw Error('Result context changed');
    if (pendingResultRematch(game) && game.getPlayerColor(userId)) await cancelPending(game, work, Date.now(), guard);
    if (!guard()) throw Error('Result context changed');
    if (!resultViewers({ status: game.resultRecord.status, ...game.resultRecord.state }).some(p => p.userId === userId)) return;
    await changeResult(game, work, { type: 'dismiss', userId }, { request, guard });
  });
}

export function expireResult(game, now = Date.now()) {
  return queueResult(game, async work => {
    if (pendingResultRematch(game) && now >= game.resultRecord.state.deadline) await cancelPending(game, work, now);
    if (game.resultRecord.status !== 'CLOSED') await changeResult(game, work, { type: 'expire' }, { now });
    retireEmptyResult(game);
  });
}

export async function requestResultRematch(game, userId, request, guard) {
  await queueResult(game, work => changeResult(game, work, { type: 'request-rematch', userId }, { request, guard }));
  return resumeResultRematch(game);
}

export function resumeResultRematch(game) {
  if (game.resultStarting) return game.resultStarting;
  const task = queueResult(game, async work => {
    await game.finalization;
    work.assertCurrent();
    if (!pendingResultRematch(game)) return;
    if (Date.now() >= game.resultRecord.state.deadline) { await cancelPending(game, work); return; }
    const state = game.resultRecord.state;
    if (!state.players.every(p => game.botIds.has(p.userId) || (getSession(p.userId)?.gameId === game.id && getSession(p.userId)?.connectionId))) return;
    let failure;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await createGameDirect(...state.rematch.players, game.mode, 0, game.game.turnTime, game.id, game.origin, state.rematch.key, { resultSourceId: game.id });
        await refreshResult(game, work);
        await changeResult(game, work, { type: 'expire' });
        return;
      } catch (error) {
        failure = error; work.assertCurrent(); await refreshResult(game, work);
        if (!pendingResultRematch(game)) return;
      }
    }
    throw failure;
  });
  game.resultStarting = task;
  task.then(() => { game.resultStarting = null; }, () => {
    game.resultStarting = null;
    if (game.runtimeStopped || activeGames.get(game.id) !== game) return;
    clearTimeout(game.resultRetryTimer);
    game.resultRetryTimer = setTimeout(() => { void resumeResultRematch(game).catch(error => console.error('Rematch recovery failed:', error.message)); }, 1000);
    game.resultRetryTimer.unref?.();
  });
  return task;
}

export function reconcileResultUser(userId) {
  return runGameplayWork(async work => {
    const sourceId = await inGameplayTransaction(work.owner, null, async tx => {
      const claim = await tx.activeResultViewer.findUnique({ where: { userId } });
      if (claim) return claim.gameRunId;
      const game = await tx.activeGamePlayer.findUnique({ where: { userId }, include: { run: true } });
      return game?.run.resultSourceId ?? null;
    });
    work.assertCurrent();
    const session = getSession(userId);
    const game = activeGames.get(sourceId ?? session?.gameId ?? session?.spectatingGameId);
    // A reconnect can see committed claims before terminal installation, or no
    // claim after dismissal but before its projection. Wait for that owning work
    // and read the result again before releasing the first snapshot.
    if (game) { await game.transitions; await game.resultChanges; work.assertCurrent(); }
    if (game?.game.gameOver) {
      if (game.runtimeStopped && !viewsGame(getSession(userId), game.id)) return;
      try { await queueResult(game, async inner => { await refreshResult(game, inner, true); }); }
      catch (error) {
        work.assertCurrent();
        if (game.runtimeStopped && !viewsGame(getSession(userId), game.id)) return;
        throw error;
      }
      void resumeResultRematch(game).catch(error => console.error('Rematch reconnect failed:', error.message));
    } else if (sourceId && await inGameplayTransaction(work.owner, null, tx => tx.activeResultViewer.findUnique({ where: { userId } }))) {
      throw Error('Result runtime is missing');
    }
  });
}
