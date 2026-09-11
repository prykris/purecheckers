import { CheckersGame } from '../../shared/game.js';
import { awardCoins, deductCoins } from './coins.js';
import { assertCoinAmount, lockEconomyUsers } from './economy.js';
import { gameplayOwner, inGameplayTransaction } from './gameplayOwnership.js';
import { assertPlayersAvailable, claimGamePlayers, releaseGamePlayers } from './gameMembership.js';
import { assertActiveAccount } from './accounts.js';
import { lockRoomRecord, roomRecordId, assertRoomGameStart, installRoomGame, restoreAbortedRoom } from './roomRecords.js';
import { lockResultRecord, assertResultRematch, installResultRematch, restoreAbortedResult } from './resultRecords.js';

class RoomAssociationChanged extends Error {}

export function createGameRun(input, transaction = null, owner = gameplayOwner()) {
  const { key, redPlayerId, blackPlayerId, mode, buyIn = 0, turnTime = 60, origin = 'room' } = input;
  if (typeof key !== 'string' || !key || key.length > 100 || redPlayerId === blackPlayerId ||
    ![redPlayerId, blackPlayerId].every(id => Number.isSafeInteger(id) && id > 0) ||
    !['RANKED', 'FRIENDLY', 'BOT'].includes(mode) || !['room', 'quickplay', 'bot'].includes(origin) ||
    !Number.isSafeInteger(turnTime) || turnTime < 0 || turnTime > 3600) throw new Error('Invalid game creation');
  assertCoinAmount(buyIn);
  if (mode !== 'RANKED' && buyIn !== 0) throw new Error('Only ranked games can reserve a wager');
  const roomId = input.roomId == null ? null : roomRecordId(input.roomId);
  const resultSourceId = input.resultSourceId ?? null;
  if (resultSourceId !== null && (!Number.isSafeInteger(resultSourceId) || resultSourceId <= 0 || roomId !== null)) throw Error('Invalid rematch source');
  const identity = { redPlayerId, blackPlayerId, mode, buyIn, turnTime, origin, roomId, resultSourceId };
  return inGameplayTransaction(owner, transaction, async tx => {
    const sourceResult = resultSourceId === null ? null : await lockResultRecord(tx, resultSourceId);
    const sourceRoom = roomId === null ? null : await lockRoomRecord(tx, roomId);
    // Same lock namespace as settlement: creation, abort and settlement cannot
    // cross each other for this identity. Accounts always follow in sorted order.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'game-settlement:' + key}, 0))`;
    const existing = await tx.gameRun.findUnique({ where: { key } });
    if (existing) {
      if (Object.entries(identity).some(([field, value]) => existing[field] !== value)) throw new Error('Game creation identity conflict');
      return existing;
    }
    await lockEconomyUsers(tx, [redPlayerId, blackPlayerId, ...(sourceResult?.state.spectators.map(p => p.userId) || [])]);
    const players = await tx.user.findMany({ where: { id: { in: [redPlayerId, blackPlayerId] } } });
    if (players.length !== 2) throw new Error('Player not found');
    players.forEach(assertActiveAccount);
    if (mode === 'RANKED' && players.some(player => player.isBot || player.isGuest)) throw new Error('Ranked games require registered human players');
    const humans = players.filter(player => !player.isBot).map(player => player.id);
    if (!humans.length) throw new Error('A game requires a human player');
    if (sourceRoom) assertRoomGameStart(sourceRoom, { key, ...identity }, players);
    if (sourceResult) assertResultRematch(sourceResult, { key, ...identity }, players);
    await assertPlayersAvailable(tx, humans, roomId, resultSourceId);
    for (const id of [redPlayerId, blackPlayerId]) {
      if (buyIn > 0) await deductCoins(id, buyIn, 'WAGER_STAKE', tx);
    }
    // This record and both stakes either commit together or do not exist.
    const invitedPlayerIds = sourceRoom?.state.players.filter(p => p.joinedViaInvite === true && humans.includes(p.userId)).map(p => p.userId) || [];
    const run = await tx.gameRun.create({ data: { key, ...identity, invitedPlayerIds,
      recoveryVersion: 1, initialState: JSON.parse(JSON.stringify(new CheckersGame(turnTime))) } });
    await claimGamePlayers(tx, run.id, humans);
    if (sourceRoom) await installRoomGame(tx, sourceRoom, run, humans);
    if (sourceResult) await installResultRematch(tx, sourceResult, run);
    return run;
  });
}

// Only for a start that could not be installed into the current runtime. An
// OPEN row found after restart is not, by itself, proof that a game never began.
export function abortGameStart(key, transaction = null, owner = gameplayOwner(), { allowMissing = false, guard = () => true, now = Date.now() } = {}) {
  const perform = () => inGameplayTransaction(owner, transaction, async tx => {
    const source = await tx.gameRun.findUnique({ where: { key }, select: { roomId: true, resultSourceId: true } });
    if (source?.roomId && source?.resultSourceId) throw Error('Ambiguous game source');
    const result = source?.resultSourceId == null ? null : await lockResultRecord(tx, source.resultSourceId);
    const room = source?.roomId == null ? null : await lockRoomRecord(tx, source.roomId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'game-settlement:' + key}, 0))`;
    const run = await tx.gameRun.findUnique({ where: { key } });
    if (!run) {
      if (allowMissing) return { key, status: 'NOT_CREATED' }; // confirmed absence under the creation-key lock
      throw new Error('Game start not found');
    }
    // A room-backed creation may commit while we waited for its game-key lock.
    // Restart the transaction to acquire the now-known room lock first.
    if (run.roomId != null && room?.id !== run.roomId) throw new RoomAssociationChanged('Game acquired a room association; retry cancellation');
    if (run.resultSourceId != null && result?.gameRunId !== run.resultSourceId) throw new RoomAssociationChanged('Game acquired a result association; retry cancellation');
    if (run.status === 'ABORTED') return run;
    if (!guard()) return null;
    if (run.status !== 'OPEN') throw new Error('A settled game cannot be aborted');
    if (run.checkpoint?.started || run.checkpoint?.engine.moveHistory?.length) throw new Error('A started game cannot be aborted');
    const terminal = await tx.gameSettlementJob.findUnique({ where: { key } });
    if (terminal) throw new Error('A terminal game cannot be aborted');
    await lockEconomyUsers(tx, [run.redPlayerId, run.blackPlayerId, ...(result?.state.spectators.map(p => p.userId) || [])]);
    if (!guard()) return null;
    if (run.buyIn > 0) for (const id of [run.redPlayerId, run.blackPlayerId]) await awardCoins(id, run.buyIn, 'WAGER_REFUND', tx);
    await releaseGamePlayers(tx, run.id);
    if (room) await restoreAbortedRoom(tx, room, run);
    if (result) await restoreAbortedResult(tx, result, run, now);
    return tx.gameRun.update({ where: { key }, data: { status: 'ABORTED', closedAt: new Date() } });
  });
  return perform().catch(error => {
    if (!transaction && error instanceof RoomAssociationChanged) return perform();
    throw error;
  });
}
