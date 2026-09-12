// A two-finger tap consumes the whole contact sequence, including rejected gestures.
// It never turns a pinch, cancellation or late second finger into a game move.
export class TwoFingerTap {
  constructor() { this.reset(); }
  reset() { this.points = new Map(); this.started = 0; this.multiple = false; this.valid = true; }
  down(id, x, y, now) {
    if (!this.points.size) { this.reset(); this.started = now; }
    this.points.set(id, {x, y});
    if (this.points.size >= 2) {
      this.multiple = true;
      if (this.points.size !== 2 || now - this.started > 180) this.valid = false;
    }
    return this.multiple;
  }
  move(id, x, y) {
    const start = this.points.get(id);
    if (start && Math.hypot(x-start.x, y-start.y) > 10) this.valid = false;
    return this.multiple;
  }
  up(id, x, y, now, cancelled = false) {
    if (!this.points.has(id)) return {consume:false, toggle:false};
    this.move(id,x,y);
    if (cancelled) this.valid = false;
    this.points.delete(id);
    const consume = this.multiple;
    const toggle = consume && this.valid && !this.points.size && now-this.started <= 450;
    if (!this.points.size) this.reset();
    return {consume, toggle};
  }
}
