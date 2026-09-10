import { wheelRotation, landedColor, revealView, revealDuration, REVEAL_TIMING } from '../src/lib/colorReveal.js';

describe('colour reveal', () => {
  it('always lands the wheel on the colour the server assigned', () => {
    let seed = 1;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 500; i++) {
      for (const color of ['red', 'black']) {
        const rotation = wheelRotation(color, random);
        expect(landedColor(rotation)).toBe(color);
        expect(rotation).toBeGreaterThanOrEqual(3 * 360);
        expect(rotation).toBeLessThan(5 * 360);
      }
    }
    expect(landedColor(wheelRotation('red', () => 0))).toBe('red');
    expect(landedColor(wheelRotation('black', () => 0.999999))).toBe('black');
  });
  it('derives the overlay state from the snapshot rather than local memory', () => {
    const base = { started: false, gameOver: false, revealAcks: [] };
    expect(revealView(base, 7)).toEqual({ active: true, acked: false, waiting: false });
    expect(revealView({ ...base, revealAcks: [7] }, 7)).toEqual({ active: true, acked: true, waiting: true });
    expect(revealView({ ...base, revealAcks: [8] }, 7)).toEqual({ active: true, acked: false, waiting: false });
    expect(revealView({ ...base, started: true }, 7).active).toBe(false);
    expect(revealView({ ...base, gameOver: true }, 7).active).toBe(false);
    expect(revealView(null, 7).active).toBe(false);
    expect(revealView({ started: false, gameOver: false }, 7)).toEqual({ active: true, acked: false, waiting: false });
  });
  it('shortens the reveal for reduced motion', () => {
    expect(revealDuration(true)).toBe(REVEAL_TIMING.reducedMotion);
    expect(revealDuration(false)).toBe(REVEAL_TIMING.spin + REVEAL_TIMING.settle + REVEAL_TIMING.read);
    expect(revealDuration(true)).toBeLessThan(revealDuration(false));
  });
});
