import { BROWSE_TABS, parseLocation, projectNavigation, sessionContext } from './navigationPolicy.js';

// Coordinates navigation intent, accepted session state and asynchronous route resources.
// Browser/history and network access are injected; components only submit intents.
export class NavigationController {
  constructor({ publish, sendCommand, loadReplay }) {
    this.publish = publish; this.sendCommand = sendCommand; this.loadReplay = loadReplay;
    this.session = { snapshot: null, status: 'disconnected' };
    this.intent = { kind: 'browse', tab: 'lobby' }; this.lastTab = 'lobby';
    this.generation = 0; this.active = false; this.identity = null;
    this.state = { screen: 'none', tab: 'lobby', url: null, replayId: null, replayData: null, loading: false, error: null };
  }
  update(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  start(adapter) { this.adapter = adapter; this.active = true; this.locationChanged(adapter.read(), true); }
  stop() { this.active = false; this.adapter = null; this.generation++; this.replayRequest = null; this.inviteRequest = null; }
  setIdentity(id) {
    if (this.identity === id) return;
    const previous = this.identity; this.identity = id;
    if (previous !== null) {
      this.generation++; this.replayRequest = null; this.inviteRequest = null;
      this.session = { snapshot: null, status: 'disconnected' };
      this.intent = { kind: 'browse', tab: 'lobby' }; this.lastTab = 'lobby';
      this.update({ screen: 'none', tab: 'lobby', replayId: null, replayData: null, loading: false, error: null });
      if (this.active && id === null) this.write('/auth', 'replace');
    }
    this.reconcile();
  }
  setSession(session) {
    const before = sessionContext(this.session.snapshot), after = sessionContext(session.snapshot);
    this.session = session;
    if (before && after && before !== after) {
      this.generation++; this.replayRequest = null;
      this.intent = { kind: 'session' };
      this.update({ replayData: null, loading: false, error: null });
    }
    this.reconcile();
  }
  locationChanged(href, initial = false) {
    if (!this.active) return;
    const url = new URL(href, 'http://app.local');
    const path = url.pathname + url.search;
    if (!initial && path === this.state.url) return;
    this.generation++; this.replayRequest = null;
    this.intent = parseLocation(href);
    if (this.intent.kind === 'browse') this.lastTab = this.intent.tab;
    this.update({ replayData: null, error: this.intent.invalid ? 'That app location is unavailable.' : null, loading: false });
    this.reconcile();
  }
  browse(tab) {
    if (!BROWSE_TABS.includes(tab)) return;
    this.generation++; this.replayRequest = null; this.lastTab = tab;
    this.intent = { kind: 'browse', tab };
    this.update({ replayData: null, error: null, loading: false }); this.reconcile('push');
  }
  openSession() {
    this.generation++; this.replayRequest = null; this.intent = { kind: 'session' };
    this.update({ replayData: null, error: null, loading: false }); this.reconcile('push');
  }
  openReplay(id) {
    if (!Number.isSafeInteger(id) || id <= 0) return;
    this.generation++; this.replayRequest = null; this.intent = { kind: 'replay', id };
    this.update({ replayData: null, error: null, loading: false }); this.reconcile('push');
  }
  closeReplay() { this.browse(this.lastTab); }
  reconcile(historyMode = 'replace') {
    if (!this.active) return;
    // Preserve a deep link until authentication and the first snapshot resolve.
    if (this.identity === null) {
      this.update({ screen: 'none', replayData: null });
      return;
    }
    if (!this.session.snapshot) return;
    if (this.intent.kind === 'invite') {
      if (this.session.status !== 'ready' || this.session.pending || this.inviteRequest) return;
      if (this.session.snapshot.phase !== 'idle') {
        this.intent = { kind: 'session' };
        this.update({ error: 'Leave your current session before opening another invitation.' });
      } else { this.joinInvite(); return; }
    }
    const view = projectNavigation(this.session.snapshot, this.intent, this.lastTab);
    this.update({ ...view, url: this.state.url });
    this.write(view.url, historyMode);
    if (view.replayId && this.replayRequest?.id !== view.replayId) this.fetchReplay(view.replayId);
  }
  write(url, mode) {
    this.update({ url });
    const current = new URL(this.adapter.read(), 'http://app.local');
    if (current.pathname + current.search !== url) this.adapter.write(url, mode);
  }
  async joinInvite() {
    const request = { code: this.intent.code, generation: this.generation };
    this.inviteRequest = request; this.update({ loading: true, error: null });
    try {
      const result = await this.sendCommand('room:join', { code: request.code });
      if (!this.active || this.inviteRequest !== request) return;
      // Membership changes are handled by setSession; do not overwrite newer user navigation.
      if (this.intent.kind === 'invite' && this.intent.code === request.code) this.intent = { kind: 'session' };
      if (!result.ok && this.generation === request.generation) this.update({ error: result.error });
    } catch {
      if (this.active && this.inviteRequest === request && this.generation === request.generation) {
        this.intent = { kind: 'session' };
        this.update({ error: 'Could not open the invitation.' });
      }
    }
    finally {
      if (this.inviteRequest === request) { this.inviteRequest = null; this.update({ loading: false }); this.reconcile(); }
    }
  }
  async fetchReplay(id) {
    const request = { id, generation: this.generation }; this.replayRequest = request;
    this.update({ replayData: null, loading: true, error: null });
    try {
      const data = await this.loadReplay(id);
      if (this.active && this.replayRequest === request && this.generation === request.generation) this.update({ replayData: data, loading: false });
    } catch (error) {
      if (this.active && this.replayRequest === request && this.generation === request.generation) this.update({ error: error?.message || 'Replay could not be loaded.', loading: false });
    }
  }
}
