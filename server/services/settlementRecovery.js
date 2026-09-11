import { isDeepStrictEqual } from 'node:util';
import prisma from '../db.js';
import { inEconomyTransaction } from './economy.js';
import { settleGame } from './gameSettlement.js';

function normalizeIntent(intent) {
  // Persist dates uniformly; retries from JSON and a live aggregate must agree.
  return JSON.parse(JSON.stringify({ ...structuredClone(intent),
    startedAt: new Date(intent.startedAt).toISOString(), endedAt: new Date(intent.endedAt).toISOString() }));
}

export function enqueueSettlement(intent, transaction = null) {
  const payload = normalizeIntent(intent);
  if (typeof payload.key !== 'string' || !payload.key || payload.key.length > 100) throw new Error('Invalid settlement key');
  return inEconomyTransaction(transaction, async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'game-settlement:' + payload.key}, 0))`;
    const existing = await tx.gameSettlementJob.findUnique({ where: { key: payload.key } });
    if (existing) {
      if (!isDeepStrictEqual(existing.intent, payload)) throw new Error('Terminal intent identity conflict');
      return existing;
    }
    return tx.gameSettlementJob.create({ data: { key: payload.key, intent: payload, redUserId: payload.redUserId, blackUserId: payload.blackUserId } });
  });
}

export function settleQueuedGame(key, transaction = null) {
  return inEconomyTransaction(transaction, async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'game-settlement:' + key}, 0))`;
    const job = await tx.gameSettlementJob.findUniqueOrThrow({ where: { key } });
    // settleGame shares this transaction and its durable deduplication receipt.
    const receipt = await settleGame(job.intent, tx);
    if (!job.completedAt) await tx.gameSettlementJob.update({ where: { key }, data: { completedAt: new Date(), replayId: receipt.replayId } });
    return receipt;
  });
}

// Bounded, sequential batches. Multiple processes may discover the same job;
// transaction locks and the receipt make duplicate execution harmless.
export function createSettlementRecovery({ onSettled = async () => {}, intervalMs = 10_000, batchSize = 25, now = () => new Date() } = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100 || !Number.isFinite(intervalMs) || intervalMs < 1) throw new Error('Invalid settlement recovery limits');
  let running = null, timer = null, stopped = false;

  async function batch() {
    const jobs = await prisma.gameSettlementJob.findMany({
      where: { completedAt: null, nextAttemptAt: { lte: now() } },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }, { key: 'asc' }], take: batchSize
    });
    let completed = 0;
    for (const job of jobs) {
      if (stopped) break;
      let receipt;
      try { receipt = await settleQueuedGame(job.key); }
      catch (error) {
        // A bad job cannot starve the rest of the batch. A later transaction is
        // required because the failed settlement transaction has rolled back.
        const delay = Math.min(60_000, 1000 * 2 ** Math.min(job.attempts, 6));
        await prisma.gameSettlementJob.updateMany({ where: { key: job.key, completedAt: null },
          data: { attempts: { increment: 1 }, nextAttemptAt: new Date(now().getTime() + delay) } });
        console.error(`Game settlement retry failed (${job.key}):`, error.message);
        continue;
      }
      completed++;
      // Publication is after commit and cannot turn a successful payment into a
      // failed job. The authoritative receipt remains available after commit.
      try { await onSettled(job.key, receipt); }
      catch (error) { console.error(`Game settlement publication failed (${job.key}):`, error.message); }
    }
    return completed;
  }

  function runOnce() {
    if (stopped) return Promise.resolve(0);
    if (!running) running = batch().finally(() => { running = null; });
    return running;
  }

  return {
    runOnce,
    start() {
      if (timer || stopped) return;
      const tick = () => { void runOnce().catch(error => console.error('Settlement recovery unavailable:', error.message)); };
      tick(); timer = setInterval(tick, intervalMs); timer.unref?.();
    },
    async stop() { stopped = true; clearInterval(timer); timer = null; await running?.catch(() => {}); }
  };
}
