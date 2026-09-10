export function restoreGame(game, snapshot) {
  for (const key of ['board', 'currentPlayer', 'redTime', 'blackTime', 'chainPiece', 'gameOver', 'winner',
    'moveHistory', 'turnTime', 'drawReason', 'positionHistory', 'movesWithoutCapture']) {
    if (snapshot[key] !== undefined) game[key] = structuredClone(snapshot[key]);
  }
  return game;
}
