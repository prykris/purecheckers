// Privacy is an absolute, revision-conditional setting. Never queue/replay a
// stale choice; confirm the current profile through its existing account owner.
export class ProfileSettingsClient {
  constructor({ readProfile, capture, isCurrent, write, refresh, publish }) {
    Object.assign(this, { readProfile, capture, isCurrent, write, read: refresh, publish });
    this.generation = 0; this.disposed = false;
    this.state = { busy: false, needsRefresh: false, error: '', success: '' }; this.emit({});
  }
  emit(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  reset() { this.generation++; if (!this.disposed) this.emit({ busy: false, needsRefresh: false, error: '', success: '' }); }
  dispose() { this.disposed = true; this.generation++; }
  current(scope, generation) { return !this.disposed && generation === this.generation && this.isCurrent(scope); }
  async reconcile(scope, generation) {
    if (!this.current(scope, generation)) return false;
    const profile = await this.read();
    if (!this.current(scope, generation)) return false;
    if (!profile || typeof profile.profilePublic !== 'boolean' || !Number.isSafeInteger(profile.profileVersion)) throw Error('Could not refresh your account.');
    this.emit({ needsRefresh: false }); return true;
  }
  async refresh() {
    if (this.disposed || this.state.busy) return false;
    const scope = this.capture(), generation = this.generation;
    this.emit({ busy: true, error: '', success: '' });
    try { return await this.reconcile(scope, generation); }
    catch (error) { if (this.current(scope, generation)) this.emit({ needsRefresh: true, error: 'Could not refresh your account. Please retry.' }); return false; }
    finally { if (this.current(scope, generation)) this.emit({ busy: false }); }
  }
  async change(profilePublic) {
    if (this.disposed || this.state.busy || this.state.needsRefresh || typeof profilePublic !== 'boolean') return false;
    const profile = this.readProfile();
    if (!profile || !Number.isSafeInteger(profile.profileVersion)) return false;
    const scope = this.capture(), generation = this.generation;
    this.emit({ busy: true, error: '', success: '' });
    let confirmed = false;
    try {
      const receipt = await this.write({ profilePublic, expectedProfileVersion: profile.profileVersion }, scope);
      if (!this.current(scope, generation)) return false;
      if (receipt?.profilePublic !== profilePublic || !Number.isSafeInteger(receipt.profileVersion) || receipt.profileVersion <= profile.profileVersion) throw Error('The privacy change could not be confirmed.');
      confirmed = true;
    } catch (error) {
      if (!this.current(scope, generation)) return false;
      this.emit({ error: error.message || 'The privacy change could not be confirmed.' });
    }
    try {
      if (!await this.reconcile(scope, generation)) return false;
      if (confirmed) this.emit({ success: 'Privacy change saved. Showing your current setting.' });
    } catch {
      if (this.current(scope, generation)) this.emit({ needsRefresh: true, error: `${confirmed ? 'Privacy change saved.' : 'Privacy change could not be confirmed.'} Refresh your account to see the current setting.` });
    } finally { if (this.current(scope, generation)) this.emit({ busy: false }); }
    return confirmed && this.current(scope, generation);
  }
}
