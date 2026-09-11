import { CheckersGame } from './game.js';
import { isoDate, todayUtc, addDays, parsePuzzleDate } from './puzzleDates.js';

export function puzzleGame(position) {
  const game = new CheckersGame(0);
  game.board = structuredClone(position.board);
  game.currentPlayer = position.currentPlayer;
  game.positionHistory = [game._boardHash()];
  return game;
}

export const moveHops = move => move.hops ?? [move];
export const sameHop = (a, b) => !!a && !!b && ['fromRow', 'fromCol', 'toRow', 'toCol'].every(k => a[k] === b[k]);
export function validPuzzleProgress(value) {
  return !!value && ['solved', 'revealed', 'hintUsed', 'rewarded'].every(key => typeof value[key] === 'boolean')
    && Number.isInteger(value.attempts) && value.attempts >= 1 && value.attempts <= 10000
    && !(value.solved && value.revealed) && (!value.rewarded || value.solved);
}

export function validPuzzleAttemptResponse(value) {
  return validPuzzleProgress(value?.attempt) && [0, 1].includes(value.coinsAwarded)
    && (!value.coinsAwarded || value.attempt.rewarded);
}

export function sameTurn(actual, expected) {
  const hops = moveHops(expected);
  return actual.length === hops.length && actual.every((hop, i) => sameHop(hop, hops[i]));
}

// Cheap authoritative validation, with no search on the API thread. Only the
// player's decisions are submitted; the server plays the stored opponent line.
export function validatePuzzleSolve(puzzle, turns) {
  if (!Array.isArray(turns) || !Array.isArray(puzzle.solution) || !puzzle.solution.length
    || turns.length !== Math.ceil(puzzle.solution.length / 2)) return false;
  try {
    const game = puzzleGame(puzzle.position);
    for (let i = 0; i < puzzle.solution.length; i++) {
      const expected = puzzle.solution[i];
      if (i % 2 === 0 && !sameTurn(turns[i / 2], expected)) return false;
      const hops = moveHops(expected);
      for (let h = 0; h < hops.length; h++) {
        const move = hops[h];
        const result = game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        if (!result || !!result.chainContinues !== (h < hops.length - 1)) return false;
      }
    }
    return true;
  } catch { return false; }
}

export function puzzleStreak(history, now = new Date()) {
  const solved = new Set(Object.entries(history).filter(([date, item]) => parsePuzzleDate(date) && item.solved && !item.revealed).map(([date]) => date));
  let day = todayUtc(now);
  if (!solved.has(isoDate(day))) day = addDays(day, -1);
  let streak = 0;
  while (solved.has(isoDate(day))) { streak++; day = addDays(day, -1); }
  return streak;
}
