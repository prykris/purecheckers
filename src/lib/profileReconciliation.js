// Background reads coalesce by the requested database revision. Explicit action
// confirmations still start fresh reads through refreshSession after the write.
export function createProfileReconciliation({ readProfile, refresh, isCurrent = () => true }) {
  let wanted = -1, running = null, disposed = false;
  const active = () => !disposed && isCurrent();

  async function reconcile() {
    while (active()) {
      const target = wanted;
      if (readProfile()?.profileVersion >= target) return;
      try { await refresh(); } catch { return; } // next hint retries; keep the accepted profile
      if (wanted <= target) return; // no immediate retry loop on an unsuccessful/stale read
    }
  }

  return {
    observe(hint) {
      const profile = readProfile();
      if (!active() || !profile || hint?.userId !== profile.id || !Number.isSafeInteger(hint.profileVersion) || hint.profileVersion < 0 || hint.profileVersion <= profile.profileVersion) return Promise.resolve();
      wanted = Math.max(wanted, hint.profileVersion);
      if (!running) running = reconcile().finally(() => { running = null; });
      return running;
    },
    dispose() { disposed = true; }
  };
}
