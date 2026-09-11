import { ReadResource } from './readResource.js';
import { withDeadline } from './actions/deadline.js';

export class TreasuryClient {
  constructor({ load, claimReward, refreshProfile, readScope, isCurrent, publish }) {
    Object.assign(this, { claimReward, refreshProfile, readScope, publish });
    this.state = { data: null, status: 'idle', readError: null, error: null, claiming: null };
    this.resource = new ReadResource({ load, readScope, isCurrent, publish: value => {
      this.emit({ data: value.data, status: value.status, readError: value.error });
    } });
  }
  emit(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  reset() { this.emit({ error: null, claiming: null }); this.resource.reset(); }
  dispose() { this.resource.dispose(); }

  reconcile() {
    // These resources have separate authorities. A failed profile request must
    // not discard a successfully read treasury snapshot (or vice versa).
    return Promise.allSettled([this.resource.refresh(), this.refreshProfile()]);
  }

  async refresh() {
    if (this.resource.disposed || this.state.claiming !== null) return;
    this.emit({ error: null });
    await this.reconcile();
  }

  async claim(id) {
    if (this.resource.disposed || this.state.claiming !== null || this.state.status === 'loading') return false;
    const payout = this.state.data?.pending?.find(p => p.id === id);
    if (!payout?.canClaim) return false;
    const scope = this.readScope();
    this.emit({ claiming: id, error: null });
    try {
      const receipt = await withDeadline(signal => this.claimReward(id, { scope, signal }));
      if (!this.resource.current(scope)) return false;
      if (receipt?.claimed !== payout.amount) throw new Error('Could not confirm the claim response. Refresh or retry the same reward.');
      const [view, profile] = await this.reconcile();
      if (!this.resource.current(scope)) return false;
      if (view.status !== 'fulfilled' || !view.value || profile.status === 'rejected') {
        this.emit({ error: 'Claim confirmed. Refresh to load the latest balance and treasury.' });
      }
      return true;
    } catch (error) {
      if (this.resource.current(scope)) {
        this.emit({ error: error.message });
        // An error can mean contention or an unknown commit. Refresh both
        // resources, but never automatically retry the mutation or add coins.
        await this.reconcile();
      }
      return false;
    } finally { if (this.resource.current(scope)) this.emit({ claiming: null }); }
  }
}
