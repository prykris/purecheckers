import { withDeadline } from './actions/deadline.js';

// Authentication bootstrap belongs to the site runtime. Navigation alone joins rooms;
// this prepares an identity and never sends gameplay commands.
export class AppBootstrap {
  constructor({ readToken, readSessionGeneration = () => 0, readInvite, restoreSession, clearSession, checkInvite, createGuest, acceptGuest, abandonInvite, showNotice, publish }) {
    Object.assign(this, { readToken, readSessionGeneration, readInvite, restoreSession, clearSession, checkInvite, createGuest, acceptGuest, abandonInvite, showNotice, publish });
    this.generation = 0;
    this.disposed = false;
    this.controller = null;
  }
  async start() {
    if (this.disposed) return;
    const generation = ++this.generation;
    this.controller?.abort();
    const controller = new AbortController(); this.controller = controller;
    const request = work => withDeadline(signal => work({ signal }), 'Opening the app timed out. Check your connection and retry.', { signal: controller.signal });
    const token = this.readToken(), code = this.readInvite();
    const accountGeneration = this.readSessionGeneration();
    const current = () => !this.disposed && generation === this.generation;
    const unchanged = () => current() && this.readSessionGeneration() === accountGeneration && this.readToken() === token && this.readInvite() === code;
    this.publish({ loading: true, joiningInvite: !token && !!code, hostName: null, error: null });
    try {
      if (token) {
        try { await request(options => this.restoreSession(options)); }
        catch (error) {
          if (!unchanged()) return;
          if (error?.status === 401) {
            this.clearSession();
            return this.start(); // Expired guests can still enter a valid invitation.
          }
          this.publish({ error: 'Could not restore your session. Check your connection and retry.' });
        }
        return;
      }
      if (!code) return;
      const info = await request(options => this.checkInvite(code, options));
      if (!unchanged()) return;
      if (!info) { this.abandonInvite(code); return; }
      this.publish({ hostName: info.hostName || null });
      const credentials = await request(options => this.createGuest(options));
      if (!unchanged()) return;
      this.acceptGuest(credentials);
    } catch {
      if (unchanged()) this.showNotice('Could not open the invitation automatically. Pick a name and try again.');
    } finally {
      if (current()) this.publish({ loading: false, joiningInvite: false });
      if (this.controller === controller) this.controller = null;
    }
  }
  dispose() { this.disposed = true; this.generation++; this.controller?.abort(); this.controller = null; }
}
