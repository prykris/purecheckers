function validProfile(profile) {
  return profile && Number.isSafeInteger(profile.id) && profile.id > 0 &&
    Number.isSafeInteger(profile.profileVersion) && profile.profileVersion >= 0;
}

// Account identity and profile publication have one owner. Gameplay snapshots
// have their own session protocol; this projection contains only User row data.
export class AccountSession {
  constructor({ token = null, publish }) {
    this.token = token; this.user = null; this.generation = 0; this.publish = publish;
    this.emit();
  }
  emit() { this.publish({ token: this.token, user: this.user, generation: this.generation }); }
  capture() { return { generation: this.generation, token: this.token }; }
  current(scope) { return scope?.generation === this.generation; }
  beginAuthentication() { this.generation++; this.emit(); return this.capture(); }
  clear() { this.generation++; this.user = null; this.token = null; this.emit(); }
  establish(data, scope = this.capture()) {
    if (!this.current(scope)) return false;
    if (!validProfile(data?.user) || typeof data.token !== 'string' || !data.token) throw Error('Invalid account response; reload and try again');
    this.generation++; this.token = data.token; this.user = Object.freeze({ ...data.user }); this.emit();
    return true;
  }
  accept(data, scope) {
    if (!this.current(scope) || !scope.token || !this.token) return null;
    if (!validProfile(data?.user) || (this.user && this.user.id !== data.user.id)) throw Error('Invalid account profile response');
    if (data.token !== undefined && (typeof data.token !== 'string' || !data.token)) throw Error('Invalid account token');
    if (this.user && data.user.profileVersion < this.user.profileVersion) return this.user;
    if (!this.user || data.user.profileVersion > this.user.profileVersion) this.user = Object.freeze({ ...data.user });
    // A late response may carry an older renewal. It can update a newer profile
    // revision, but only the request using the current token may replace it.
    if (data.token && scope.token === this.token) this.token = data.token;
    this.emit();
    return this.user;
  }
}
