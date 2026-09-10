// Colour reveal (the wheel shown before each game). Pure helpers; the component
// only schedules timers around them. The server assigns colours; the wheel
// never chooses, it only lands on the colour the snapshot already carries.

export const REVEAL_TIMING = Object.freeze({
  spin: 2800,          // wheel rotation
  settle: 300,         // pause before the result text appears
  read: 700,           // time the result stays before the client reports done
  reducedMotion: 800,  // no spin: show the result, then report done
});

// Wheel face: red occupies 0-180deg, black 180-360deg; the pointer sits at 0deg.
// Rotating clockwise by R puts wheel angle (360 - R mod 360) under the pointer.
export function wheelRotation(color, random = Math.random) {
  const spins = 3 + Math.floor(random() * 2);
  const landAngle = color === 'red' ? 210 + random() * 120 : 30 + random() * 120;
  return spins * 360 + landAngle;
}

export function landedColor(rotation) {
  const underPointer = (360 - (rotation % 360)) % 360;
  return underPointer < 180 ? 'red' : 'black';
}

export function revealDuration(reducedMotion) {
  const { spin, settle, read, reducedMotion: quick } = REVEAL_TIMING;
  return reducedMotion ? quick : spin + settle + read;
}

// What the reveal overlay should show for this viewer given the accepted snapshot.
export function revealView(game, userId) {
  if (!game || game.started || game.gameOver) return { active: false, acked: false, waiting: false };
  const acked = game.revealAcks?.includes(userId) ?? false;
  return { active: true, acked, waiting: acked };
}
