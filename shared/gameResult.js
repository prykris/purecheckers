const RESULTS = {
  RED_WIN: { winner: 'red', label: 'Red wins' },
  BLACK_WIN: { winner: 'black', label: 'Black wins' },
  DRAW: { winner: null, label: 'Draw' },
  ABORTED: { winner: null, label: 'Game cancelled' }
};

export function winningColor(result) {
  return RESULTS[result]?.winner ?? null;
}

export function gameResultLabel(result, players = {}) {
  const winner = winningColor(result);
  const name = winner && players[winner];
  return name ? `${name} wins` : RESULTS[result]?.label ?? 'Result unavailable';
}

// A missing participant or an unfamiliar result must never become a loss/draw.
export function playerGameResult(result, color) {
  if (color !== 'red' && color !== 'black') return 'unknown';
  if (result === 'ABORTED') return 'cancelled';
  if (result === 'DRAW') return 'draw';
  const winner = winningColor(result);
  return winner ? winner === color ? 'win' : 'loss' : 'unknown';
}

export function playerResultLabel(result) {
  return ({ win: 'Win', loss: 'Loss', draw: 'Draw', cancelled: 'Cancelled' })[result] ?? 'Result unavailable';
}

export function gameResultCode(winner, endReason) {
  if (endReason === 'restart-abandoned') return 'ABORTED';
  return winner === 'red' ? 'RED_WIN' : winner === 'black' ? 'BLACK_WIN' : 'DRAW';
}

export function gameEndReason(reason, result) {
  return ({ resign: 'By resignation', timeout: 'By timeout', 'no-moves': 'No legal moves remain',
    'draw-agreement': 'Draw by agreement', repetition: 'Draw by repetition', '25-move': 'Draw by the 25-move rule',
    disconnect: 'A player disconnected', abandon: 'A player left',
    'restart-abandoned': 'Cancelled after server restart; wagers refunded',
    'restart-disconnect': 'Opponent did not return after server restart' })[reason] ?? (result === 'DRAW' ? 'Game drawn' : 'Game ended');
}
