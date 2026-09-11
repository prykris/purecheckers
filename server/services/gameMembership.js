import { lockEconomyUsers } from './economy.js';
import { inGameplayTransaction } from './gameplayOwnership.js';
import { RoomMembershipConflict } from './roomRecords.js';

export class GameMembershipConflict extends Error {
  constructor(userId, gameId) {
    super('Player already belongs to an unfinished game');
    this.userId = userId; this.gameId = gameId;
  }
}

// Caller holds the participants' ordered account locks. The primary key is the
// final concurrent-write invariant; this check provides a useful domain error.
export async function assertPlayersAvailable(tx, humans, roomId = null, resultSourceId = null) {
  const occupied = await tx.activeGamePlayer.findFirst({ where: { userId: { in: humans } }, orderBy: { userId: 'asc' } });
  if (occupied) throw new GameMembershipConflict(occupied.userId, occupied.gameRunId);
  const room = await tx.activeRoomMember.findFirst({ where: { userId: { in: humans },
    ...(roomId === null ? {} : { OR: [{ roomId: { not: roomId } }, { role: { not: 'PLAYER' } }] }) } });
  if (room) throw new RoomMembershipConflict('Player already belongs to a room');
  const result = await tx.activeResultViewer.findFirst({ where: { userId: { in: humans },
    ...(resultSourceId === null ? {} : { OR: [{ gameRunId: { not: resultSourceId } }, { role: { not: 'PLAYER' } }] }) } });
  if (result) throw new RoomMembershipConflict('Player must leave the finished result before starting another game');
}

export async function claimGamePlayers(tx, runId, humans) {
  if (humans.length) await tx.activeGamePlayer.createMany({ data: humans.map(userId => ({ userId, gameRunId: runId })) });
}

// Always scope release to the old game. Its delayed settlement/retry cannot
// erase a newer game's claim for the same user.
export function releaseGamePlayers(tx, runId) {
  return tx.activeGamePlayer.deleteMany({ where: { gameRunId: runId } });
}

// The validated checkpoint roster is the source when rebuilding a fresh runtime.
// This also bridges a previous binary that wrote runs after schema migration.
// It is only called after ownership takeover and before opening the listener.
export function restoreGamePlayers(runs, owner) {
  return inGameplayTransaction(owner, null, async tx => {
    const expected = runs.flatMap(run => [run.redPlayer, run.blackPlayer]
      .filter(player => !player.isBot).map(player => ({ userId: player.id, gameRunId: run.id })));
    await lockEconomyUsers(tx, expected.map(seat => seat.userId));
    // Old terminal/cancelled claims cannot remain as invisible occupied seats.
    await tx.activeGamePlayer.deleteMany({ where: { OR: [
      { gameRunId: { notIn: runs.map(run => run.id) } },
      { userId: { notIn: expected.map(seat => seat.userId) } }
    ] } });
    for (const seat of expected) {
      const prior = await tx.activeGamePlayer.findUnique({ where: { userId: seat.userId } });
      if (prior && prior.gameRunId !== seat.gameRunId) throw new GameMembershipConflict(seat.userId, prior.gameRunId);
      if (!prior) await tx.activeGamePlayer.create({ data: seat });
    }
  });
}
