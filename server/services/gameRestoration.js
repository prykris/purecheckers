import { gameplayOwner, inGameplayTransaction } from './gameplayOwnership.js';
import { decodeCheckpoint } from '../domain/gameCheckpoint.js';
import { assertActiveAccount } from './accounts.js';

// Load only after taking ownership: takeover waits for old committed writes.
// Validate the complete set before starting timers, refunding or installing any
// session. Ambiguous history must never silently become a fresh opening board.
export function loadRestorableGames(owner = gameplayOwner()) {
  return inGameplayTransaction(owner, null, async tx => {
    const runs = await tx.gameRun.findMany({ where: { status: 'OPEN' },
      include: { redPlayer: true, blackPlayer: true }, orderBy: { id: 'asc' } });
    const terminalKeys = new Set((await tx.gameSettlementJob.findMany({
      where: { key: { in: runs.map(run => run.key) } }, select: { key: true }
    })).map(job => job.key));
    const live = [], uninstalled = [], membership = new Map();
    for (const run of runs) {
      if (terminalKeys.has(run.key)) continue;
      if (run.checkpoint?.engine?.gameOver) throw Error(`Game ${run.id} has a terminal checkpoint without its settlement job; recovery review required`);
      if (!run.checkpoint) {
        if (run.recoveryVersion !== 1 || run.revision !== 0) throw Error(`Game ${run.id} has no trustworthy checkpoint; recovery review required`);
        uninstalled.push(run); continue;
      }
      decodeCheckpoint(run.checkpoint); // reject unsupported state before side effects
      [run.redPlayer, run.blackPlayer].forEach(assertActiveAccount);
      for (const player of [run.redPlayer, run.blackPlayer]) {
        if (player.isBot) continue;
        if (membership.has(player.id)) throw Error(`Player ${player.id} has overlapping unfinished games ${membership.get(player.id)} and ${run.id}; recovery review required`);
        membership.set(player.id, run.id);
      }
      if (run.redPlayer.isBot && run.blackPlayer.isBot) throw Error(`Game ${run.id} has no human participant; recovery review required`);
      live.push(run);
    }
    return { live, uninstalled };
  });
}
