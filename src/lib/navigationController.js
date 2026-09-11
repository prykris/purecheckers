import { BROWSE_TABS, parseLocation, projectNavigation, sessionContext } from './navigationPolicy.js';

export const INVITE_BUSY = 'Finish what you\'re in first, then scan again.';
export const INVITE_FAILED = 'Could not open the invitation.';

// Coordinates navigation intent, accepted session state and asynchronous route resources.
// Browser/history and network access are injected; components only submit intents.
export class NavigationController {
  constructor({ publish, sendCommand, loadReplay, checkInvite = null }) {
    this.publish = publish; this.sendCommand = sendCommand; this.loadReplay = loadReplay; this.checkInvite = checkInvite;
    this.session = { snapshot: null, status: 'disconnected' };
    this.intent = { kind: 'browse', tab: 'lobby' }; this.lastTab = 'lobby';
    this.generation = 0; this.active = false; this.identity = null;
    this.state = { screen: 'none', tab: 'lobby', url: null, replayId: null, replayData: null, loading: false, error: null, invite: null, notice: null };
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
      this.update({ screen: 'none', tab: 'lobby', replayId: null, replayData: null, loading: false, error: null, invite: null, notice: null });
      if (this.active && id === null) this.write('/auth', 'replace');
    }
    this.reconcile();
  }
  setSession(session) {
    const before = sessionContext(this.session.snapshot), after = sessionContext(session.snapshot);
    this.session = session;
    if (before && after && before !== after) {
      const completingInvite = this.inviteRequest?.stage === 'sending' && this.intent.kind === 'invite';
      this.generation++; this.replayRequest = null;
      if (completingInvite) this.inviteRequest.generation = this.generation;
      this.intent = { kind: 'session' };
      this.update({ replayData: null, loading: false, error: null, invite: null });
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
    this.update({ replayData: null, error: this.intent.invalid ? 'That app location is unavailable.' : null, loading: false,
      invite: this.intent.kind === 'invite' ? { code: this.intent.code, hostName: null } : null });
    this.reconcile();
  }
  browse(tab) {
    if (!BROWSE_TABS.includes(tab)) return;
    this.generation++; this.replayRequest = null; this.lastTab = tab;
    this.intent = { kind: 'browse', tab };
    this.update({ replayData: null, error: null, loading: false, invite: null }); this.reconcile('push');
  }
  openSession() {
    this.generation++; this.replayRequest = null; this.intent = { kind: 'session' };
    this.update({ replayData: null, error: null, loading: false, invite: null }); this.reconcile('push');
  }
  openReplay(id) {
    if (!Number.isSafeInteger(id) || id <= 0) return;
    this.generation++; this.replayRequest = null; this.intent = { kind: 'replay', id };
    this.update({ replayData: null, error: null, loading: false, invite: null }); this.reconcile('push');
  }
  closeReplay() { this.browse(this.lastTab); }
  dismissNotice() { if (this.state.notice) this.update({ notice: null }); }
  // The app shell learned before authentication that the invitation is gone (or should
  // not be attempted): drop the intent so a later login does not retry it.
  abandonInvite(code, notice = { kind: 'invite-gone' }) {
    if (this.intent.kind !== 'invite' || this.intent.code !== code) return;
    this.generation++; this.inviteRequest = null;
    this.intent = { kind: 'browse', tab: 'lobby' }; this.lastTab = 'lobby';
    this.update({ invite: null, loading: false, error: null, notice });
    if (this.active && this.identity === null) this.write('/auth', 'replace');
    this.reconcile();
  }
  reconcile(historyMode = 'replace') {
    if (!this.active) return;
    // Preserve a deep link until authentication and the first snapshot resolve.
    if (this.identity === null) {
      this.update({ screen: 'none', replayData: null });
      return;
    }
    if (!this.session.snapshot) return;
    if (this.intent.kind === 'challenge') {
      if (this.session.status !== 'ready' || this.session.pending) return;
      const target = this.intent.userId;
      this.intent = { kind: 'session' };
      if (this.session.snapshot.phase !== 'idle') this.update({ error: 'Finish your current game or leave your room before sending a challenge.' });
      else {
        // Consume the navigation intent before sending. Snapshots and repeated
        // reconciliation cannot send it twice; accepted membership owns the URL.
        const generation = this.generation;
        void this.sendCommand('challenge:send', { userId: target }).then(result => {
          if (this.active && this.generation === generation && !result.ok) this.update({ error: result.error });
        }).catch(() => {
          if (this.active && this.generation === generation) this.update({ error: 'Could not send the challenge. Check your connection and retry.' });
        });
      }
    }
    if (this.intent.kind === 'invite') {
      if (this.session.status !== 'ready' || this.session.pending || this.inviteRequest) return;
      if (this.session.snapshot.phase !== 'idle') {
        this.intent = { kind: 'session' };
        this.update({ error: INVITE_BUSY, invite: null });
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
    const request = { code: this.intent.code, generation: this.generation, stage: 'checking' };
    this.inviteRequest = request; this.update({ loading: true, error: null, invite: { code: request.code, hostName: null } });
    const current = () => this.active && this.inviteRequest === request;
    const mine = () => this.intent.kind === 'invite' && this.intent.code === request.code;
    try {
      // Pre-check: a dead link explains itself instead of surfacing as a rejected command.
      let info = null;
      if (this.checkInvite) {
        info = await this.checkInvite(request.code);
        if (!current() || !mine() || this.generation !== request.generation) return;
        if (!info) {
          if (mine()) this.intent = { kind: 'browse', tab: this.lastTab };
          if (this.generation === request.generation) this.update({ notice: { kind: 'invite-gone' }, invite: null });
          return;
        }
        this.update({ invite: { code: request.code, hostName: info.hostName || null } });
      }
      if (this.session.status !== 'ready' || this.session.pending || this.session.snapshot?.phase !== 'idle') return;
      const watch = info?.status === 'playing';
      request.stage = 'sending';
      const result = await this.sendCommand(watch ? 'room:spectate' : 'room:join', { code: request.code });
      if (!current()) return;
      // Membership changes are handled by setSession; do not overwrite newer user navigation.
      if (mine()) this.intent = { kind: 'session' };
      if (this.generation !== request.generation) return;
      if (!result.ok) this.update({ error: result.error, invite: null });
      else this.update({ notice: watch ? null : { kind: 'invite-joined', hostName: info?.hostName || null }, invite: null });
    } catch {
      if (current() && this.generation === request.generation) {
        this.intent = { kind: 'session' };
        this.update({ error: INVITE_FAILED, invite: null });
      }
    }
    finally {
      if (this.inviteRequest === request) {
        this.inviteRequest = null;
        if (this.generation === request.generation) this.update({ loading: false });
        this.reconcile();
      }
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
