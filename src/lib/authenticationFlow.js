import { withDeadline } from './actions/deadline.js';

// Owns requests for one mounted authentication form. AccountSession remains the
// only owner allowed to establish identity; navigation still owns game entry.
export class AuthenticationFlow {
  constructor({ initialView = 'guest', api, beginAuthentication, establishSession, isCurrentSession, publish, onGuestCreated = () => {} }) {
    Object.assign(this, { api, beginAuthentication, establishSession, isCurrentSession, publish, onGuestCreated });
    this.state = { view: ['guest', 'login', 'register'].includes(initialView) ? initialView : 'guest', loading: false, error: '' };
    this.sequence = 0; this.disposed = false; this.request = null; this.suggestion = null;
    this.emit({});
  }
  emit(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  cancel() { this.sequence++; this.request?.abort(); this.suggestion?.abort(); this.request = null; this.suggestion = null; }
  switchView(view) {
    if (this.disposed || !['guest', 'login', 'register'].includes(view)) return;
    this.cancel(); this.emit({ view, loading: false, error: '' });
  }
  dispose() { this.disposed = true; this.cancel(); }

  async suggestName({ untouched, apply }) {
    if (this.disposed || this.state.view !== 'guest') return;
    this.suggestion?.abort();
    const controller = new AbortController(); this.suggestion = controller;
    try {
      const data = await withDeadline(signal => this.api.get('/guest/name', { signal, authToken: null }), undefined, { signal: controller.signal });
      if (!this.disposed && this.suggestion === controller && !controller.signal.aborted
        && this.state.view === 'guest' && !this.state.loading && untouched()
        && typeof data?.name === 'string' && data.name.length <= 20) apply(data.name);
    } catch { /* Optional suggestion; the player can type a name or let the server choose. */ }
    finally { if (this.suggestion === controller) this.suggestion = null; }
  }

  async submit(fields, source = 'auth') {
    if (this.disposed || this.state.loading) return false;
    this.cancel();
    const sequence = this.sequence, view = this.state.view, scope = this.beginAuthentication();
    const controller = new AbortController(); this.request = controller;
    const current = () => !this.disposed && sequence === this.sequence && this.isCurrentSession(scope);
    const path = view === 'guest' ? '/guest' : `/auth/${view}`;
    const body = view === 'guest' ? { username: fields.guestName }
      : view === 'register' ? { username: fields.username, email: fields.email, password: fields.password }
        : { email: fields.email, password: fields.password };
    const timeoutMessage = view === 'register'
      ? 'Could not confirm account creation. Try signing in with the same email and password.'
      : 'The request timed out. Check your connection and try again.';
    this.emit({ loading: true, error: '' });
    try {
      const data = await withDeadline(signal => this.api.post(path, body, { signal, authToken: null }), timeoutMessage, { signal: controller.signal });
      if (!current() || !this.establishSession(data, scope)) return false;
      if (view === 'guest') this.onGuestCreated(source);
      return true;
    } catch (error) {
      if (current()) this.emit({ error: error.message || 'Could not sign in. Please try again.' });
      return false;
    } finally {
      if (!this.disposed && sequence === this.sequence) this.emit({ loading: false });
      if (this.request === controller) this.request = null;
    }
  }
}
