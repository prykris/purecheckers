import { isDeepStrictEqual } from 'node:util';
import { inGameplayTransaction } from '../services/gameplayOwnership.js';
import { runGameplayWork } from '../services/gameplayWork.js';
import { commitRoomRecord } from '../services/roomRecords.js';
import { normalizeRoomState, assertRoomTransition, ROOM_STATE_VERSION } from './roomState.js';
import { activeGames } from './games.js';
import { gameRooms, installRoom } from './rooms.js';
import { projectRoomRecord } from './roomRuntime.js';

// Run after game restoration and before accepting connections. Persist offline
// deadlines before installing projections, so repeated restarts never renew them.
export function restoreRooms({ graceMs = 120000 } = {}) {
  if (!Number.isSafeInteger(graceMs) || graceMs <= 0) throw Error('Invalid room recovery grace');
  if (gameRooms.size) throw Error('Room restoration requires an empty runtime');
  return runGameplayWork(async work => {
    const records = await inGameplayTransaction(work.owner, null, tx => tx.roomRecord.findMany({
      where: { status: { not: 'CLOSED' } }, orderBy: { id: 'asc' }
    }));
    const prepared = [];
    const deadline = Date.now() + graceMs;
    for (const record of records) {
      if (record.stateVersion !== ROOM_STATE_VERSION) throw Error('Unsupported room recovery version');
      const users = await inGameplayTransaction(work.owner, null, tx => tx.user.findMany({
        where: { id: { in: [...record.state.players, ...record.state.spectators].map(p => p.userId) } }
      }));
      const byId = new Map(users.map(p => [p.id, p]));
      const before = { status: record.status, ...record.state };
      if (!isDeepStrictEqual(normalizeRoomState(before, byId), before)) throw Error('Noncanonical room state requires review');
      const run = record.state.startAttempt ? await inGameplayTransaction(work.owner, null,
        tx => tx.gameRun.findUnique({ where: { key: record.state.startAttempt.key } })) : null;
      assertRoomTransition(before, before, { users: byId, run, roomId: record.id });
      if (record.status === 'STARTING' && run && run.status !== 'ABORTED') throw Error('Unresolved room start requires recovery');
      const terminal = record.status === 'PLAYING' && run && (run.status !== 'OPEN' || run.checkpoint?.engine?.gameOver);
      if (record.status === 'PLAYING' && !terminal && !activeGames.has(record.state.gameId)) throw Error('Room game was not restored');
      prepared.push({ record, byId, terminal });
    }
    const projections = [];
    for (const { record, byId, terminal } of prepared) {
      const saved = await commitRoomRecord({ roomId: record.id, expectedRevision: record.revision }, draft => {
        work.assertCurrent();
        if (terminal) { draft.status = 'CLOSED'; return; }
        if (draft.status === 'STARTING') { draft.status = 'WAITING'; draft.startAttempt = null; draft.gameId = null; }
        for (const p of [...draft.players, ...draft.spectators]) {
          if (byId.get(p.userId).isBot) continue;
          if (p.online) { p.online = false; p.disconnectDeadline = deadline; }
          if ('ready' in p) p.ready = false;
        }
      }, null, work.owner);
      if (saved.room.status !== 'CLOSED') projections.push(await projectRoomRecord(saved.room, null, work.owner));
    }
    work.assertCurrent();
    for (const room of projections) installRoom(room, work);
    return { restored: projections.length, closed: records.length - projections.length };
  });
}
