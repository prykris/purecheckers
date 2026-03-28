import { rankedQueue } from '../server/services/matchmaking.js';

describe('RankedQueue', () => {
  beforeEach(() => {
    // Clear the queue
    while (rankedQueue.size() > 0) {
      rankedQueue.players.pop();
    }
  });

  it('adds players to the queue', () => {
    rankedQueue.add(1, 1000, 'socket1');
    rankedQueue.add(2, 1050, 'socket2');
    expect(rankedQueue.size()).toBe(2);
  });

  it('does not double-add the same user', () => {
    rankedQueue.add(1, 1000, 'socket1');
    rankedQueue.add(1, 1000, 'socket1');
    expect(rankedQueue.size()).toBe(1);
  });

  it('removes by userId', () => {
    rankedQueue.add(1, 1000, 'socket1');
    rankedQueue.add(2, 1050, 'socket2');
    rankedQueue.remove(1);
    expect(rankedQueue.size()).toBe(1);
    expect(rankedQueue.has(1)).toBe(false);
    expect(rankedQueue.has(2)).toBe(true);
  });

  it('removes by socketId', () => {
    rankedQueue.add(1, 1000, 'socket1');
    rankedQueue.removeBySocket('socket1');
    expect(rankedQueue.size()).toBe(0);
  });

  it('matches two players within ELO window', () => {
    rankedQueue.add(1, 1000, 'socket1');
    rankedQueue.add(2, 1050, 'socket2');
    const pairs = rankedQueue.tryMatch();
    expect(pairs.length).toBe(1);
    expect(pairs[0][0].userId).toBe(1);
    expect(pairs[0][1].userId).toBe(2);
    expect(rankedQueue.size()).toBe(0);
  });

  it('does not match players outside ELO window', () => {
    // Base window is 100, these are 200 apart
    rankedQueue.add(1, 800, 'socket1');
    rankedQueue.add(2, 1200, 'socket2');
    // Set joinedAt to now so window hasn't expanded
    rankedQueue.players[0].joinedAt = Date.now();
    rankedQueue.players[1].joinedAt = Date.now();

    const pairs = rankedQueue.tryMatch();
    expect(pairs.length).toBe(0);
    expect(rankedQueue.size()).toBe(2);
  });

  it('widens window over time', () => {
    rankedQueue.add(1, 800, 'socket1');
    rankedQueue.add(2, 1000, 'socket2');
    // 200 apart — won't match at base window (100)
    rankedQueue.players[0].joinedAt = Date.now();
    rankedQueue.players[1].joinedAt = Date.now();
    expect(rankedQueue.tryMatch().length).toBe(0);

    // After 30s: window = 100 + 3*50 = 250 — now matches
    rankedQueue.add(1, 800, 'socket1');
    rankedQueue.add(2, 1000, 'socket2');
    rankedQueue.players[0].joinedAt = Date.now() - 30000;
    rankedQueue.players[1].joinedAt = Date.now() - 30000;

    const pairs = rankedQueue.tryMatch();
    expect(pairs.length).toBe(1);
  });

  it('matches multiple pairs', () => {
    rankedQueue.add(1, 1000, 's1');
    rankedQueue.add(2, 1010, 's2');
    rankedQueue.add(3, 1500, 's3');
    rankedQueue.add(4, 1520, 's4');

    const pairs = rankedQueue.tryMatch();
    expect(pairs.length).toBe(2);
    expect(rankedQueue.size()).toBe(0);
  });

  it('leaves unmatched player in queue', () => {
    rankedQueue.add(1, 1000, 's1');
    rankedQueue.add(2, 1010, 's2');
    rankedQueue.add(3, 2000, 's3'); // way too far

    const pairs = rankedQueue.tryMatch();
    expect(pairs.length).toBe(1);
    expect(rankedQueue.size()).toBe(1);
    expect(rankedQueue.has(3)).toBe(true);
  });
});
