import { playerGameResult } from '../../shared/gameResult.js';

export function historyPerspective(game, playerId) {
  const color = playerId != null && game.redPlayerId === playerId ? 'red'
    : playerId != null && game.blackPlayerId === playerId ? 'black' : null;
  return { color, result: playerGameResult(game.result, color) };
}

export function historyTime(date, now = Date.now()) {
  const timestamp = date ? new Date(date).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return 'Date unavailable';
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < 60_000) return 'just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function historyDetails(game, playerId) {
  const { color } = historyPerspective(game, playerId);
  const details = [
    { label: 'Mode', value: game.mode === 'RANKED' ? 'Ranked' : 'Friendly' }
  ];
  if (Number.isInteger(game.moveCount) && game.moveCount >= 0) details.push({
    label: 'Recorded moves', value: String(game.moveCount), help: 'Each landing in a multi-jump counts as a recorded move.'
  });
  const duration = game.date && game.endedAt ? new Date(game.endedAt) - new Date(game.date) : NaN;
  if (Number.isFinite(duration) && duration >= 0) {
    const seconds = Math.floor(duration / 1000);
    details.push({ label: 'Duration', value: seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`, help: 'Elapsed time from game start to finish.' });
  }
  if (game.mode === 'RANKED') {
    for (const side of color ? [color] : ['red', 'black']) {
      const delta = game[`${side}EloChange`];
      if (typeof delta === 'number' && Number.isFinite(delta)) details.push({
        label: color ? 'Rating change' : `${side === 'red' ? 'Red' : 'Black'} rating`, value: `${delta > 0 ? '+' : ''}${delta}`
      });
    }
  }
  return details;
}
