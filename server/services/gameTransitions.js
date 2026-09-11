import { isDeepStrictEqual } from 'node:util';
import { gameplayOwner, inGameplayTransaction } from './gameplayOwnership.js';
import { enqueueSettlement } from './settlementRecovery.js';
import { terminalIntentFor } from '../domain/gameCheckpoint.js';
import { releaseGamePlayers } from './gameMembership.js';
import { lockRoomRecord } from './roomRecords.js';
import { createResultRecord } from './resultRecords.js';

export class GameRevisionConflict extends Error {}

// The caller supplies a pure transition. It runs only after durable duplicate and
// revision checks, and its checkpoint/command/terminal job commit atomically.
export function commitGameTransition({ key, expectedRevision, command = null }, transition, transaction = null, owner = gameplayOwner()) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('Invalid game revision');
  if (command && (!Number.isSafeInteger(command.userId) || command.userId < 1 || typeof command.key !== 'string' || !command.key || command.key.length > 80)) throw new Error('Invalid game command identity');
  return inGameplayTransaction(owner, transaction, async tx => {
    const source = await tx.gameRun.findUnique({ where: { key }, select: { roomId: true } });
    if (source?.roomId) await lockRoomRecord(tx, source.roomId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'game-settlement:' + key}, 0))`;
    const run = await tx.gameRun.findUniqueOrThrow({ where: { key } });
    if (run.roomId != null && run.roomId !== source?.roomId) throw new GameRevisionConflict('Game source changed; retry the transition');
    if (command) {
      if (![run.redPlayerId, run.blackPlayerId].includes(command.userId)) throw new GameRevisionConflict('Command actor is not a participant');
      const prior = await tx.gameCommandReceipt.findUnique({ where: { gameRunId_userId_key: { gameRunId: run.id, userId: command.userId, key: command.key } } });
      if (prior) {
        if (!isDeepStrictEqual(prior.payload, command.payload)) throw new GameRevisionConflict('Game command identity conflict');
        return { checkpoint: run.checkpoint, revision: run.revision, duplicate: true, terminalIntent: run.checkpoint ? terminalIntentFor(run, run.checkpoint) : null,
          resultRecord: await tx.gameResultRecord.findUnique({ where: { gameRunId: run.id } }),
          sourceRoomRecord: run.checkpoint?.engine.gameOver && run.roomId ? await tx.roomRecord.findUnique({ where: { id: run.roomId } }) : null };
      }
    }
    if (run.revision !== expectedRevision) throw new GameRevisionConflict('Game changed before this transition could commit');
    if (run.status !== 'OPEN' || run.checkpoint?.engine.gameOver) throw new GameRevisionConflict('Game is already closed');
    const checkpoint = transition();
    if (checkpoint && checkpoint.schema !== 1) throw new Error('Unsupported game checkpoint');
    const revision = run.revision + (checkpoint ? 1 : 0);
    const terminalIntent = checkpoint ? terminalIntentFor(run, checkpoint) : null;
    if (checkpoint) await tx.gameRun.update({ where: { key }, data: { checkpoint, revision } });
    let resultRecord = null;
    if (terminalIntent) {
      await enqueueSettlement(terminalIntent, tx);
      await releaseGamePlayers(tx, run.id);
      resultRecord = await createResultRecord(run.id, tx, owner);
    }
    if (command) await tx.gameCommandReceipt.create({ data: { gameRunId: run.id, userId: command.userId, key: command.key,
      payload: command.payload, revision } });
    return { checkpoint: checkpoint || run.checkpoint, revision, duplicate: false, terminalIntent, resultRecord,
      sourceRoomRecord: terminalIntent && run.roomId ? await tx.roomRecord.findUnique({ where: { id: run.roomId } }) : null };
  });
}
