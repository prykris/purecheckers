import { puzzleGame, moveHops, sameTurn } from '../../../shared/puzzleProgress.js';

export class PuzzleController {
  constructor(puzzle, { publish = () => {}, progress = () => {}, reducedMotion = () => false, now = Date.now } = {}) {
    this.puzzle = puzzle; this.publish = publish; this.progress = progress;
    this.reducedMotion = reducedMotion; this.now = now; this.started = now();
    this.generation = 0; this.animationId = 0; this.timers = new Map(); this.disposed = false;
    this.attempts = 1; this.hintUsed = false; this.revealed = false;
    this.reset();
  }
  snapshot() {
    return { board: structuredClone(this.game.board), selected: this.selected, status: this.status,
      animation: this.animation, notice: this.notice, attempts: this.attempts, hintUsed: this.hintUsed,
      revealed: this.revealed, solved: this.status === 'solved' && !this.revealed, lineIndex: this.index,
      targets: this.status === 'player' && this.selected ? this.game.getValidMovesFor(this.selected.row, this.selected.col) : [] };
  }
  emit() { if (!this.disposed) this.publish(this.snapshot()); }
  report() {
    this.progress({ solved: this.status === 'solved' && !this.revealed, attempts: this.attempts,
      hintUsed: this.hintUsed, revealed: this.revealed, timeMs: Math.min(86400000, Math.max(0, this.now() - this.started)), turns: structuredClone(this.turns) });
  }
  cancel() {
    this.generation++;
    for (const [timer, resolve] of this.timers) { clearTimeout(timer); resolve(false); }
    this.timers.clear();
  }
  reset() {
    this.cancel(); this.game = puzzleGame(this.puzzle.position); this.index = 0; this.turns = [];
    this.hops = []; this.turnStart = null; this.selected = null; this.animation = null;
    this.status = 'player'; this.notice = ''; this.emit();
  }
  restore(record, scope = this.scope) {
    if (this.scope && this.scope !== 'visitor' && scope !== this.scope) {
      this.attempts = 1; this.hintUsed = false; this.revealed = false; this.started = this.now(); this.reset();
    }
    this.scope = scope;
    if (!record) return;
    this.attempts = Math.max(this.attempts, record.attempts ?? 1);
    this.hintUsed ||= !!record.hintUsed; this.revealed ||= !!record.revealed;
    if (record.revealed && !record.solved && this.status === 'solved') {
      this.status = 'revealed'; this.notice = 'The solution was already revealed for this account. This practice solve earns no reward.';
    }
    this.emit();
  }
  dispose() { this.disposed = true; this.cancel(); }
  pause(ms, generation) {
    if (this.disposed || generation !== this.generation) return Promise.resolve(false);
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.timers.delete(timer); resolve(!this.disposed && generation === this.generation); }, this.reducedMotion() ? 0 : ms);
      this.timers.set(timer, resolve);
    });
  }
  async animate(move, generation) {
    const piece = { ...this.game.board[move.fromRow][move.fromCol] };
    const result = this.game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    if (!result) { this.status = 'error'; this.notice = 'This puzzle could not be played. Please try another date.'; this.emit(); return null; }
    this.animation = { ...move, piece, id: ++this.animationId }; this.emit();
    if (!await this.pause(220, generation)) return null;
    this.animation = null; this.emit(); return result;
  }
  async select(row, col) {
    if (this.disposed || this.status !== 'player') return;
    const move = this.selected && this.game.getValidMovesFor(this.selected.row, this.selected.col).find(m => m.toRow === row && m.toCol === col);
    if (!move) {
      if (!this.game.chainPiece && this.game.board[row]?.[col]?.color === this.puzzle.sideToMove) this.selected = { row, col };
      this.emit(); return;
    }
    const hop = { fromRow: this.selected.row, fromCol: this.selected.col, toRow: row, toCol: col };
    const generation = this.generation;
    this.turnStart ??= this.game.clone(); this.hops.push(hop);
    this.status = 'animating'; this.notice = '';
    const result = await this.animate(hop, generation);
    if (!result) return;
    if (result.chainContinues) {
      this.selected = { row, col }; this.status = 'player'; this.notice = 'Continue the jump with the same piece.'; this.emit(); return;
    }
    if (!sameTurn(this.hops, this.puzzle.solution[this.index])) {
      this.game = this.turnStart; this.attempts = Math.min(10000, this.attempts + 1);
      this.turnStart = null; this.hops = []; this.selected = null;
      this.status = 'player'; this.notice = 'Not that move. Try another line.'; this.emit(); this.report(); return;
    }
    this.turns.push(this.hops); this.hops = []; this.turnStart = null; this.selected = null; this.index++;
    if (this.index >= this.puzzle.solution.length) return this.complete();
    this.status = 'opponent'; this.notice = 'Your opponent replies…'; this.emit();
    if (!await this.pause(400, generation)) return;
    for (const reply of moveHops(this.puzzle.solution[this.index])) if (!await this.animate(reply, generation)) return;
    this.index++; this.status = 'player'; this.notice = 'Your move. Keep the combination going.'; this.emit();
  }
  complete() {
    this.status = this.revealed ? 'revealed' : 'solved';
    this.notice = this.revealed ? 'Solution complete. Try tomorrow’s puzzle without revealing it.' : 'Solved. Nicely played!';
    this.emit(); this.report();
  }
  hint() {
    if (this.status !== 'player') return;
    this.hintUsed = true; this.attempts = Math.min(10000, this.attempts + 1);
    const hop = moveHops(this.puzzle.solution[this.index])[0];
    this.selected = this.game.chainPiece ? { ...this.game.chainPiece } : { row: hop.fromRow, col: hop.fromCol };
    this.notice = 'Try the highlighted piece.'; this.emit(); this.report();
  }
  async reveal() {
    if (!['player', 'solved', 'revealed'].includes(this.status)) return;
    if (this.status === 'solved') return;
    this.revealed = true; this.reset(); const generation = this.generation;
    this.status = 'revealing'; this.notice = 'Playing the solution…'; this.emit(); this.report();
    for (const turn of this.puzzle.solution) {
      for (const hop of moveHops(turn)) if (!await this.animate(hop, generation)) return;
      this.index++;
    }
    this.status = 'revealed'; this.notice = 'Solution shown. You can replay it or try another puzzle.'; this.emit();
  }
}
