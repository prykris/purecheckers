import { calculateElo } from '../server/services/elo.js';

describe('ELO calculation', () => {
  it('gives positive delta to winner, negative to loser', () => {
    const { winnerDelta, loserDelta } = calculateElo(1000, 1000, 0, 0);
    expect(winnerDelta).toBeGreaterThan(0);
    expect(loserDelta).toBeLessThan(0);
  });

  it('gives equal change for equal-rated new players', () => {
    const { winnerDelta, loserDelta } = calculateElo(1000, 1000, 0, 0);
    // K=32, expected=0.5, so delta = 32*(1-0.5) = 16
    expect(winnerDelta).toBe(16);
    expect(loserDelta).toBe(-16);
  });

  it('gives larger reward for beating a higher-rated player', () => {
    const upset = calculateElo(1000, 1400, 10, 10);
    const expected = calculateElo(1000, 1000, 10, 10);
    expect(upset.winnerDelta).toBeGreaterThan(expected.winnerDelta);
  });

  it('gives smaller reward for beating a lower-rated player', () => {
    const easy = calculateElo(1400, 1000, 10, 10);
    const expected = calculateElo(1000, 1000, 10, 10);
    expect(easy.winnerDelta).toBeLessThan(expected.winnerDelta);
  });

  it('uses K=32 for new players (< 30 games)', () => {
    const newPlayer = calculateElo(1000, 1000, 5, 5);
    expect(newPlayer.winnerDelta).toBe(16); // K=32 * 0.5
  });

  it('uses K=16 for experienced players (>= 30 games)', () => {
    const experienced = calculateElo(1000, 1000, 50, 50);
    expect(experienced.winnerDelta).toBe(8); // K=16 * 0.5
  });

  it('handles large rating differences', () => {
    const { winnerDelta, loserDelta } = calculateElo(800, 1600, 10, 10);
    // Huge upset — winner gets nearly full K
    expect(winnerDelta).toBeGreaterThan(28);
    expect(loserDelta).toBeLessThan(-3);
  });

  it('deltas are integers', () => {
    const { winnerDelta, loserDelta } = calculateElo(1023, 1177, 15, 42);
    expect(Number.isInteger(winnerDelta)).toBe(true);
    expect(Number.isInteger(loserDelta)).toBe(true);
  });
});
