import { quickPlayPool } from '../server/services/quickPlay.js';
import { MATCHMAKING_BASE_WINDOW, MATCHMAKING_WINDOW_GROWTH, MATCHMAKING_MAX_WINDOW } from '../shared/constants.js';

// The live pool behind matchmaking:join. Registered players pair RANKED, guests pair
// FRIENDLY, and a registered player who has waited 10 s accepts a guest (FRIENDLY).
describe('QuickPlayPool', () => {
  beforeEach(() => { quickPlayPool.reset(); });
  const waited = (userId, seconds) => { quickPlayPool.players.find(p => p.userId === userId).joinedAt = Date.now() - seconds * 1000; };

  it('adds players once and removes them by user id', () => {
    quickPlayPool.add(1, 1000, false);
    quickPlayPool.add(1, 1000, false);
    quickPlayPool.add(2, 1050, true);
    expect(quickPlayPool.size()).toBe(2);
    expect(quickPlayPool.players[1]).toMatchObject({ userId: 2, elo: 1050, isGuest: true });
    quickPlayPool.remove(1);
    expect(quickPlayPool.has(1)).toBe(false);
    expect(quickPlayPool.has(2)).toBe(true);
    quickPlayPool.remove(999); // unknown ids are ignored
    expect(quickPlayPool.size()).toBe(1);
  });

  it('retains exclusive claims while a pair is being admitted', () => {
    quickPlayPool.add(1, 1000, false); quickPlayPool.add(2, 1000, false);
    const [{ a, b }] = quickPlayPool.tryMatch();
    expect(quickPlayPool.ownsClaim(a)).toBe(true);
    expect(quickPlayPool.ownsClaim(b)).toBe(true);
    quickPlayPool.add(1, 2000, false);
    expect(quickPlayPool.tryMatch()).toEqual([]);
    expect(quickPlayPool.size()).toBe(0);
    quickPlayPool.finishClaim(a); quickPlayPool.finishClaim(b);
    expect(quickPlayPool.claims.size).toBe(0);
  });

  it('restores original wait times and FIFO position even when claims return in reverse order', () => {
    quickPlayPool.add(1, 1000, false); quickPlayPool.add(2, 1000, false);
    waited(1, 30); waited(2, 20);
    const [{ a, b }] = quickPlayPool.tryMatch();
    quickPlayPool.add(3, 1800, false);
    const joinedAt = a.joinedAt;
    expect(quickPlayPool.restoreClaim(b)).toBe(true);
    expect(quickPlayPool.restoreClaim(a)).toBe(true);
    expect(quickPlayPool.restoreClaim(a)).toBe(false);
    expect(quickPlayPool.players.map(p => p.userId)).toEqual([1, 2, 3]);
    expect(quickPlayPool.players[0].joinedAt).toBe(joinedAt);
  });

  it('cannot restore or finish a cancelled search through an old claim after rejoining', () => {
    quickPlayPool.add(1, 1000, false); quickPlayPool.add(2, 1000, false);
    const [{ a }] = quickPlayPool.tryMatch();
    quickPlayPool.remove(1); quickPlayPool.add(1, 1100, false); quickPlayPool.add(3, 1100, false);
    const [{ a: current }] = quickPlayPool.tryMatch();
    expect(quickPlayPool.restoreClaim(a)).toBe(false);
    expect(quickPlayPool.finishClaim(a)).toBe(false);
    expect(quickPlayPool.ownsClaim(current)).toBe(true);
  });

  it('pairs registered players within the base window as a ranked match and empties the pool', () => {
    quickPlayPool.add(1, 1000, false);
    quickPlayPool.add(2, 1000 + MATCHMAKING_BASE_WINDOW, false);
    const pairs = quickPlayPool.tryMatch();
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: { userId: 1 }, b: { userId: 2 }, mode: 'RANKED' });
    expect(quickPlayPool.size()).toBe(0);
  });

  it('does not pair players outside the ELO window', () => {
    quickPlayPool.add(1, 800, false);
    quickPlayPool.add(2, 800 + MATCHMAKING_BASE_WINDOW + 1, false);
    expect(quickPlayPool.tryMatch()).toEqual([]);
    expect(quickPlayPool.size()).toBe(2);
  });

  it('widens the window by the growth step every ten seconds, up to the maximum', () => {
    quickPlayPool.add(1, 800, false);
    quickPlayPool.add(2, 800 + MATCHMAKING_BASE_WINDOW + MATCHMAKING_WINDOW_GROWTH * 3, false);
    waited(1, 29); waited(2, 29);
    expect(quickPlayPool.tryMatch()).toEqual([]);
    waited(1, 30); waited(2, 30);
    expect(quickPlayPool.tryMatch()).toHaveLength(1);
    quickPlayPool.add(3, 1000, false);
    quickPlayPool.add(4, 1000 + MATCHMAKING_MAX_WINDOW + 1, false);
    waited(3, 3600); waited(4, 3600);
    expect(quickPlayPool.tryMatch()).toEqual([]);
    expect(quickPlayPool._eloWindow(3600)).toBe(MATCHMAKING_MAX_WINDOW);
  });

  it('pairs guests with guests as a friendly match', () => {
    quickPlayPool.add(1, 1000, true);
    quickPlayPool.add(2, 1010, true);
    const pairs = quickPlayPool.tryMatch();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].mode).toBe('FRIENDLY');
  });

  it('lets a registered player accept a guest only after waiting ten seconds', () => {
    quickPlayPool.add(1, 1000, false);
    quickPlayPool.add(2, 1010, true);
    expect(quickPlayPool.tryMatch()).toEqual([]);
    waited(1, 10);
    const pairs = quickPlayPool.tryMatch();
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: { userId: 1 }, b: { userId: 2 }, mode: 'FRIENDLY' });
  });

  it('prefers ranked pairs, matches several pairs at once and leaves the unmatched in the pool', () => {
    quickPlayPool.add(1, 1000, false);
    quickPlayPool.add(2, 1010, true);
    quickPlayPool.add(3, 1020, false);
    quickPlayPool.add(4, 1500, false);
    quickPlayPool.add(5, 1520, false);
    quickPlayPool.add(6, 2500, false);
    waited(1, 30);
    const pairs = quickPlayPool.tryMatch();
    expect(pairs.map(p => [p.a.userId, p.b.userId, p.mode])).toEqual([[1, 3, 'RANKED'], [4, 5, 'RANKED']]);
    expect(quickPlayPool.players.map(p => p.userId)).toEqual([2, 6]);
  });
});
