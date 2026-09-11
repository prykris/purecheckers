import { AccountSession } from '../src/lib/accountSession.js';
const profile = (profileVersion, extra = {}) => ({ id: 7, profileVersion, coins: 100, isGuest: false, ...extra });
function setup() {
  const publish = vi.fn();
  const session = new AccountSession({ publish });
  session.establish({ user: profile(1), token: 'token-a' });
  return { session, publish };
}

it('rejects older database revisions regardless of request or response order', () => {
  const { session } = setup(); const first = session.capture(), second = session.capture();
  session.accept({ user: profile(3, { coins: 60 }) }, first);
  session.accept({ user: profile(2, { coins: 120 }) }, second);
  expect(session.user.coins).toBe(60);
  session.accept({ user: profile(4, { coins: 80 }) }, first);
  expect(session.user.coins).toBe(80);
});

it('rejects old account responses after logout and login even with the same token', () => {
  const { session } = setup(); const previous = session.capture();
  session.clear(); session.establish({ user: profile(2), token: 'token-a' });
  expect(session.accept({ user: profile(9, { coins: 999 }) }, previous)).toBeNull();
  expect(session.user.coins).toBe(100);
});

it('keeps the account generation during renewal and ignores a late older token', () => {
  const { session } = setup(); const scope = session.capture();
  session.accept({ user: profile(2), token: 'renewed' }, scope);
  session.accept({ user: profile(3, { coins: 50 }), token: 'older-renewal' }, scope);
  expect(session.token).toBe('renewed'); expect(session.current(scope)).toBe(true);
  expect(session.user.coins).toBe(50);
});

it('does not downgrade registration or accept unversioned and wrong-account profiles', () => {
  const { session } = setup(); const scope = session.capture();
  session.accept({ user: profile(0, { isGuest: true }) }, scope);
  expect(session.user.isGuest).toBe(false);
  expect(() => session.accept({ user: { id: 7, coins: 2 } }, scope)).toThrow('Invalid');
  expect(() => session.accept({ user: profile(2, { id: 8 }) }, scope)).toThrow('Invalid');
});

it('lets only the latest authentication attempt establish a session', () => {
  const { session } = setup(); const first = session.beginAuthentication();
  const second = session.beginAuthentication();
  expect(session.establish({ user: profile(1, { id: 8 }), token: 'b' }, first)).toBe(false);
  expect(session.establish({ user: profile(1, { id: 9 }), token: 'c' }, second)).toBe(true);
  expect(session.user.id).toBe(9);
});

it('bootstraps a saved token and does not publish an invalid renewal', () => {
  const session = new AccountSession({ token: 'saved', publish: vi.fn() });
  const scope = session.capture();
  expect(() => session.accept({ user: profile(2), token: '' }, scope)).toThrow('Invalid');
  expect(session.user).toBeNull();
  session.accept({ user: profile(2) }, scope);
  expect(session.user.profileVersion).toBe(2);
});

it('keeps accepted profile objects immutable and does not replace equal revisions', () => {
  const { session } = setup(); const scope = session.capture(); const accepted = session.user;
  expect(() => { session.user.coins = 999; }).toThrow();
  session.accept({ user: profile(1, { coins: 999 }), token: 'renewed' }, scope);
  expect(session.user).toBe(accepted); expect(session.token).toBe('renewed');
});
