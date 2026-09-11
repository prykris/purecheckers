import { colorName } from '../../../shared/notation.js';

const themes = Object.freeze({
  'multi-jump': { label: 'multi-jump', guide: 'double-jump-in-checkers', guideLabel: 'Double and triple jumps' },
  shot: { label: 'sacrifice', guide: 'checkers-traps', guideLabel: 'Sacrifices and traps' },
  breakthrough: { label: 'promotion breakthrough', guide: 'how-do-kings-move-in-checkers', guideLabel: 'Promotion and kings' },
  'king-trap': { label: 'king trap', guide: 'checkers-traps', guideLabel: 'Trapping an opposing piece' },
  immobilise: { label: 'immobilisation', guide: 'checkers-traps', guideLabel: 'Blocking the opponent’s moves' },
  'quiet-move': { label: 'quiet move', guide: 'checkers-traps', guideLabel: 'Setting up a combination' }
});

export function puzzleTheme(key) {
  const theme = Object.hasOwn(themes, key) ? themes[key] : null;
  return theme ? { label: theme.label, url: '/strategy/' + theme.guide, guideLabel: theme.guideLabel }
    : { label: String(key ?? 'tactics').replaceAll('-', ' '), url: '/strategy', guideLabel: 'Checkers strategy' };
}

export const formatPuzzleDate = date => new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
});

export function puzzleDescription(puzzle) {
  const difficulty = puzzle.difficulty.toLowerCase();
  return `${difficulty === 'easy' ? 'An' : 'A'} ${difficulty} ${puzzleTheme(puzzle.theme).label} puzzle for ${formatPuzzleDate(puzzle.date)}: ${colorName(puzzle.sideToMove)} to move. Find the combination, play the replies and explore the explanation.`;
}
