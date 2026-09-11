import { planBoardTransitions, sameBoardPosition, transitionDuration, transitionFrame, PRESENTATION_TIMING } from './gamePresentation.js';

// Only visual state may lag authority. Every target is an accepted snapshot;
// neither frame completion nor cancellation changes gameplay state.
export class BoardPresentation {
  constructor({ publish, onTransition = () => {}, now = () => performance.now(),
    requestFrame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id),
    schedule = (callback, delay) => setTimeout(callback, delay), unschedule = id => clearTimeout(id) }) {
    Object.assign(this, { publish, onTransition, now, requestFrame, cancelFrame, schedule, unschedule });
    this.latest = null; this.active = null; this.queue = []; this.generation = 0; this.disposed = false;
  }
  accept(next, { recovery = 0, enabled = true, orientation = false } = {}) {
    if (this.disposed || !next) return;
    const previous = this.latest;
    const interrupted = this.recovery !== recovery || this.orientation !== orientation || !enabled;
    this.latest = next; this.recovery = recovery; this.orientation = orientation;
    if (interrupted || !previous) { this.snap(); return; }
    if (next.gameOver && !previous.gameOver) this.resultAnimated = true;
    if (sameBoardPosition(previous, next)) {
      if (!this.active) this.settled();
      return; // Clock, presence and persisted result updates never restart a move.
    }
    const steps = planBoardTransitions(previous, next);
    if (!steps) { this.snap(); return; }
    for (const step of steps) {
      if (!this.enqueue({ ...step, duration: transitionDuration(step.plan) })) break;
    }
  }
  enqueue(target) {
    if (!this.active) { this.begin(target); return true; }
    const remaining = Math.max(0, this.active.duration - (this.now() - this.active.startedAt));
    const backlog = remaining + this.queue.reduce((sum, item) => sum + item.duration, 0) + target.duration;
    // Rapid continuations are one capture turn, not stale unrelated gameplay.
    // Bound the full chain by the opponent's maximum piece count. Each individual
    // jump still has the ordinary frame-stall deadline in begin().
    const continuation = target.plan.continuation;
    const maxPending = continuation ? PRESENTATION_TIMING.maxCaptureSteps : PRESENTATION_TIMING.maxPending;
    const maxBacklog = continuation
      ? PRESENTATION_TIMING.maxCaptureSteps * (PRESENTATION_TIMING.move + PRESENTATION_TIMING.capture) + PRESENTATION_TIMING.promotion
      : PRESENTATION_TIMING.maxBacklog;
    if (this.queue.length >= maxPending || backlog > maxBacklog) { this.snap(); return false; }
    this.queue.push(target);
    return true;
  }
  begin(target) {
    this.active = { ...target, startedAt: this.now() };
    const generation = ++this.generation;
    this.onTransition(target.plan);
    this.render(0);
    // A stalled rendering loop must not leave the board permanently input-locked.
    this.deadline = this.schedule(() => { if (generation === this.generation) this.snap(); }, PRESENTATION_TIMING.maxBacklog);
    const frame = now => {
      if (this.disposed || generation !== this.generation) return;
      const elapsed = now - this.active.startedAt;
      if (elapsed >= PRESENTATION_TIMING.maxBacklog) { this.snap(); return; }
      if (elapsed >= this.active.duration) {
        this.unschedule(this.deadline); this.active = null;
        const next = this.queue.shift();
        if (next) this.begin(next); else this.settled();
      } else { this.render(elapsed); this.frameId = this.requestFrame(frame); }
    };
    this.frameId = this.requestFrame(frame);
  }
  render(elapsed) {
    this.publish({ snapshot: this.active.snapshot, animation: transitionFrame(this.active.plan, elapsed), busy: true, resultVisible: false });
  }
  settled() {
    this.publish({ snapshot: this.latest, animation: null, busy: false, resultVisible: !!this.latest?.gameOver, resultAnimated: !!this.resultAnimated });
  }
  snap() {
    this.generation++; this.cancelFrame(this.frameId); this.unschedule(this.deadline);
    this.active = null; this.queue = [];
    this.resultAnimated = false;
    if (!this.disposed) this.settled();
  }
  dispose() { this.disposed = true; this.snap(); }
}
