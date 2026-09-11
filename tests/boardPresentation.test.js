import { CheckersGame } from '../shared/game.js';
import { BoardPresentation } from '../src/lib/boardPresentation.js';
import { planBoardTransition, transitionFrame, transitionDuration } from '../src/lib/gamePresentation.js';

const snapshot = game => structuredClone({ ...game, gameId: 1 });
function sequence() {
  const game = new CheckersGame(); const states = [snapshot(game)];
  for (const args of [[5, 0, 4, 1], [2, 3, 3, 4], [5, 2, 4, 3]]) {
    expect(game.makeMove(...args)).toBeTruthy(); states.push(snapshot(game));
  }
  return states;
}
function captureChain() {
  const game = new CheckersGame(); game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  game.board[6][1] = { color: 'red', queen: false };
  for (const [row, col] of [[5, 2], [3, 4], [1, 4]]) game.board[row][col] = { color: 'black', queen: false };
  const states = [snapshot(game)];
  for (const move of [[6, 1, 4, 3], [4, 3, 2, 5], [2, 5, 0, 3]]) {
    expect(game.makeMove(...move)).toBeTruthy(); states.push(snapshot(game));
  }
  return states;
}
function harness() {
  let time = 0, id = 0;
  const frames = new Map(), timers = new Map(), output = [], onTransition = vi.fn();
  const controller = new BoardPresentation({ publish: state => output.push(state), onTransition, now: () => time,
    requestFrame: fn => { frames.set(++id, fn); return id; }, cancelFrame: id => frames.delete(id),
    schedule: (fn, delay) => { timers.set(++id, { fn, at: time + delay }); return id; }, unschedule: id => timers.delete(id) });
  const step = elapsed => { time += elapsed; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(time)); };
  const timeout = elapsed => { time += elapsed; for (const [id, item] of timers) if (item.at <= time) { timers.delete(id); item.fn(); } };
  return { controller, step, timeout, frames, timers, output, onTransition, view: () => output.at(-1) };
}

describe('board presentation lifecycle', () => {
  it('animates every bot jump arriving 150ms apart, including the final promotion and result', () => {
    const [before, first, second, third] = captureChain(), h = harness();
    h.controller.accept(before); h.controller.accept(first);
    h.step(150); h.controller.accept(second);
    h.step(150); h.controller.accept(third);
    expect(h.view()).toMatchObject({ snapshot: first, busy: true, resultVisible: false });
    h.step(80); expect(h.view()).toMatchObject({ snapshot: second, animation: { movement: 0 }, busy: true });
    h.step(380); expect(h.view()).toMatchObject({ snapshot: third, animation: { movement: 0 }, resultVisible: false });
    h.step(540); expect(h.view()).toMatchObject({ snapshot: third, busy: false, resultVisible: true });
    expect(h.onTransition.mock.calls.map(([move]) => [move.toRow, move.toCol])).toEqual([[4, 3], [2, 5], [0, 3]]);
  });
  it('plays a whole capture chain delivered in one live snapshot without mutating authority', () => {
    const [before, first, second, final] = captureChain(), h = harness(), untouched = structuredClone(final);
    h.controller.accept(before); h.controller.accept(final);
    expect(h.view().snapshot.board).toEqual(first.board);
    h.step(380); expect(h.view().snapshot.board).toEqual(second.board);
    h.step(380); expect(h.view()).toMatchObject({ snapshot: final, busy: true });
    h.step(540); expect(h.view()).toMatchObject({ snapshot: final, busy: false });
    expect(final).toEqual(untouched); expect(h.onTransition).toHaveBeenCalledTimes(3);
  });
  it('still snaps an interrupted capture chain on recovery and ignores its old animation callback', () => {
    const [before, first, , final] = captureChain(), h = harness();
    h.controller.accept(before); h.controller.accept(first);
    const stale = [...h.frames.values()][0];
    h.controller.accept(final, { recovery: 1 }); stale(200);
    expect(h.view()).toMatchObject({ snapshot: final, busy: false, animation: null });
    expect(h.onTransition).toHaveBeenCalledTimes(1);
  });
  it('snaps an inconsistent batched capture history instead of inventing a path', () => {
    const [before, , , final] = captureChain(), h = harness();
    final.board[7][0] = { color: 'black', queen: false };
    h.controller.accept(before); h.controller.accept(final);
    expect(h.view()).toMatchObject({ snapshot: final, busy: false });
    expect(h.onTransition).not.toHaveBeenCalled();
  });
  it('advances real frames while authority is already committed and settles without mutating it', () => {
    const [before, after] = sequence(), h = harness(); const untouched = structuredClone(after);
    h.controller.accept(before); h.controller.accept(after);
    expect(h.view()).toMatchObject({ snapshot: after, busy: true, animation: { stage: 'moving', movement: 0 } });
    h.step(130); expect(h.view().animation.movement).toBeGreaterThan(0.5);
    h.step(130); expect(h.view()).toMatchObject({ snapshot: after, busy: false, animation: null });
    expect(after).toEqual(untouched);
  });
  it('does not restart or cancel a move on clock and persistence updates', () => {
    const [before, after] = sequence(), h = harness(); h.controller.accept(before); h.controller.accept(after); h.step(100);
    const clock = { ...after, redTime: 40 }; h.controller.accept(clock);
    expect(h.view().animation.movement).toBeGreaterThan(0);
    h.step(160); expect(h.view().snapshot).toBe(clock); expect(h.onTransition).toHaveBeenCalledTimes(1);
  });
  it('queues an adjacent bot reply without displaying its board before its own animation', () => {
    const [before, first, second] = sequence(), h = harness(); h.controller.accept(before); h.controller.accept(first);
    h.step(100); h.controller.accept(second);
    expect(h.view().snapshot).toBe(first);
    h.step(160); expect(h.view()).toMatchObject({ snapshot: second, animation: { movement: 0 }, busy: true });
    h.step(260); expect(h.view()).toMatchObject({ snapshot: second, busy: false });
  });
  it('snaps to newest authority when rapid arrivals exceed the bounded backlog', () => {
    const [before, first, second, third] = sequence(), h = harness();
    [before, first, second, third].forEach(state => h.controller.accept(state));
    expect(h.view()).toMatchObject({ snapshot: third, busy: false }); expect(h.frames.size).toBe(0);
  });
  it.each([{ recovery: 1 }, { enabled: false }, { orientation: true }])('cancels immediately on recovery, suspended presentation or orientation change: %j', options => {
    const [before, first, second] = sequence(), h = harness(); h.controller.accept(before); h.controller.accept(first);
    const stale = [...h.frames.values()][0]; h.controller.accept(second, options);
    const latest = h.view(); stale(200);
    expect(h.view()).toBe(latest); expect(latest).toMatchObject({ snapshot: second, busy: false });
  });
  it('snaps skipped moves, game replacement and same-ply corrections', () => {
    const [before, first, second] = sequence(), h = harness(); h.controller.accept(before); h.controller.accept(second);
    expect(h.view().busy).toBe(false);
    h.controller.accept({ ...first, gameId: 2 }); expect(h.view().busy).toBe(false);
    const corrected = structuredClone(first); corrected.gameId = 2; corrected.board[4][1] = null;
    h.controller.accept(corrected); expect(h.view()).toMatchObject({ snapshot: corrected, busy: false });
  });
  it('settles when animation frames stall and ignores late frame callbacks', () => {
    const [before, after] = sequence(), h = harness(); h.controller.accept(before); h.controller.accept(after);
    const stale = [...h.frames.values()][0]; h.timeout(601); const settled = h.view(); stale(602);
    expect(h.view()).toBe(settled); expect(settled.busy).toBe(false); expect(h.frames.size).toBe(0);
  });
  it('snaps rather than replaying a queue after a suspended frame loop resumes', () => {
    const [before, first, second] = sequence(), h = harness();
    [before, first, second].forEach(state => h.controller.accept(state)); h.step(900);
    expect(h.view()).toMatchObject({ snapshot: second, busy: false });
  });
  it('disposes every callback without publishing again', () => {
    const [before, after] = sequence(), h = harness(); h.controller.accept(before); h.controller.accept(after);
    const stale = [...h.frames.values()][0]; const count = h.output.length; h.controller.dispose(); stale(300); h.timeout(1000);
    expect(h.output).toHaveLength(count); expect(h.frames.size).toBe(0); expect(h.timers.size).toBe(0);
  });
  it('sequences a winning capture and promotion before revealing the result', () => {
    const game = new CheckersGame(); game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.board[2][1] = { color: 'red', queen: false }; game.board[1][2] = { color: 'black', queen: false };
    const before = snapshot(game); expect(game.makeMove(2, 1, 0, 3)).toBeTruthy(); const after = snapshot(game);
    expect(after.gameOver).toBe(true);
    const plan = planBoardTransition(before, after);
    expect(plan).toMatchObject({ promoted: true, captured: [{ row: 1, col: 2, color: 'black' }] });
    expect(transitionDuration(plan)).toBe(540);
    expect(transitionFrame(plan, 300)).toMatchObject({ stage: 'capturing', movement: 1 });
    expect(transitionFrame(plan, 450)).toMatchObject({ stage: 'promoting', captureProgress: 1 });
    const h = harness(); h.controller.accept(before); h.controller.accept(after);
    h.step(300); expect(h.view().resultVisible).toBe(false);
    h.controller.accept({ ...after, resultData: { coins: 5 } }); h.step(150);
    expect(h.view().animation.stage).toBe('promoting'); h.step(90);
    expect(h.view()).toMatchObject({ busy: false, resultVisible: true, resultAnimated: true });
    expect(h.view().snapshot.resultData.coins).toBe(5);
    expect(h.onTransition).toHaveBeenCalledTimes(1);
  });
  it('reveals resignation immediately and renders recovered results without entrance animation', () => {
    const [before] = sequence(), h = harness(); h.controller.accept(before);
    const ended = { ...before, gameOver: true }; h.controller.accept(ended);
    expect(h.view()).toMatchObject({ resultVisible: true, resultAnimated: true, busy: false });
    h.controller.accept(ended, { recovery: 1 });
    expect(h.view()).toMatchObject({ resultVisible: true, resultAnimated: false, busy: false });
  });
});
