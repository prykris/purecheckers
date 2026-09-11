import { randomUUID } from 'node:crypto';
import prisma from '../db.js';
import { inEconomyTransaction } from './economy.js';

export class GameplayOwnershipLost extends Error {}
let current = null, lost = false;
const listeners = new Set();
const same = (a, b) => a && b && a.generation === b.generation && a.instanceId === b.instanceId;

export async function claimGameplayOwnership(instanceId = randomUUID()) {
  if (typeof instanceId !== 'string' || !instanceId || instanceId.length > 100) throw new Error('Invalid gameplay instance identity');
  // UPDATE waits for in-flight writers' shared row locks. After it commits, an
  // older generation cannot commit another gameplay transaction.
  const owner = await prisma.gameplayOwner.upsert({ where: { id: 1 },
    create: { id: 1, generation: 1, instanceId }, update: { generation: { increment: 1 }, instanceId } });
  return Object.freeze({ generation: owner.generation, instanceId: owner.instanceId });
}

export async function startGameplayOwnership() {
  current = await claimGameplayOwnership(); lost = false;
  return current;
}

export function gameplayOwner() {
  if (!current || lost) throw new GameplayOwnershipLost('This server does not own gameplay');
  return current;
}

export function onGameplayOwnershipLost(listener) {
  listeners.add(listener); return () => listeners.delete(listener);
}

function reportLost(owner) {
  if (!same(current, owner) || lost) return;
  lost = true;
  for (const listener of listeners) {
    try { listener(); } catch (error) { console.error('Gameplay shutdown notification failed:', error.message); }
  }
}

export async function assertGameplayOwnership(tx, owner) {
  if (!owner || !Number.isSafeInteger(owner.generation) || !owner.instanceId) throw new GameplayOwnershipLost('Missing gameplay ownership');
  // This lock stays held through commit/rollback. Merely reading the generation
  // without a lock would allow takeover between the check and a later write.
  const rows = await tx.$queryRaw`SELECT "generation", "instanceId" FROM "GameplayOwner" WHERE id = 1 FOR SHARE`;
  if (!same(rows[0], owner)) throw new GameplayOwnershipLost('A newer server owns gameplay');
}

export async function inGameplayTransaction(owner, transaction, work) {
  try {
    return await inEconomyTransaction(transaction, async tx => {
      await assertGameplayOwnership(tx, owner);
      return work(tx);
    });
  } catch (error) {
    if (error instanceof GameplayOwnershipLost) reportLost(owner);
    throw error;
  }
}

// Idle/unlimited-clock servers also discover takeover and close their transports.
// Failure to read the DB never permits writes: each write still checks its fence.
export function watchGameplayOwnership({ intervalMs = 1000 } = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 10) throw new Error('Invalid ownership watch interval');
  const owner = gameplayOwner();
  let pending = false, stopped = false;
  const tick = async () => {
    if (pending || stopped || lost) return;
    pending = true;
    try {
      const latest = await prisma.gameplayOwner.findUnique({ where: { id: 1 } });
      if (!stopped && !same(latest, owner)) reportLost(owner);
    } catch (error) { console.error('Gameplay ownership check unavailable:', error.message); }
    finally { pending = false; }
  };
  const timer = setInterval(() => { void tick(); }, intervalMs); timer.unref?.();
  return () => { stopped = true; clearInterval(timer); };
}
