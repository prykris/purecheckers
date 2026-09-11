// Revision hints repeat so a lost notification or failed browser read recovers
// without an acknowledgement ledger. The User row remains the authority.
export function createProfileReconciliation({ db, connections, intervalMs = 5000, batchSize = 500,
  onError = error => console.error('Profile reconciliation unavailable:', error.message) }) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000 || !Number.isFinite(intervalMs) || intervalMs < 1) throw new Error('Invalid profile reconciliation limits');
  let running = null, timer = null, stopped = false;

  async function reconcile() {
    const audience = [...connections.entries()];
    for (let offset = 0; offset < audience.length && !stopped; offset += batchSize) {
      const batch = new Map(audience.slice(offset, offset + batchSize));
      const profiles = await db.user.findMany({ where: { id: { in: [...batch.keys()] } }, select: { id: true, profileVersion: true } });
      if (stopped) return;
      for (const profile of profiles) {
        const connection = batch.get(profile.id);
        if (connection && connections.get(profile.id) === connection && connection.socket.connected) {
          connection.socket.emit('account:revision', { userId: profile.id, profileVersion: profile.profileVersion });
        }
      }
    }
  }

  function runOnce() {
    if (stopped) return Promise.resolve();
    if (!running) running = reconcile().finally(() => { running = null; });
    return running;
  }

  return {
    runOnce,
    start() {
      if (timer || stopped) return;
      const tick = () => { void runOnce().catch(onError); };
      tick(); timer = setInterval(tick, intervalMs); timer.unref?.();
    },
    async stop() { stopped = true; clearInterval(timer); timer = null; await running?.catch(() => {}); }
  };
}
