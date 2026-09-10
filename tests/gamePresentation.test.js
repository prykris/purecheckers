import { CheckersGame } from '../shared/game.js';
import { planBoardTransition } from '../src/lib/gamePresentation.js';
import { restoreGame } from '../src/lib/boardSnapshot.js';

function state(game, gameId = 1) { return structuredClone({ ...game, gameId }); }
describe('snapshot presentation', () => {
  it('animates exactly one adjacent accepted move without mutating either snapshot', () => {
    const game = new CheckersGame(); const before = state(game); game.makeMove(5, 0, 4, 1); const after = state(game);
    const transition = planBoardTransition(before, after);
    expect(transition).toMatchObject({ fromRow: 5, toRow: 4, pieceColor: 'red' });
    expect(before.board[5][0].color).toBe('red'); expect(after.board[5][0]).toBeNull();
  });
  it('snaps after a reconnect, skipped moves or game replacement; animates a terminal move', () => {
    const game = new CheckersGame(); const before = state(game); game.makeMove(5,0,4,1); const after = state(game);
    expect(planBoardTransition(before, after, true)).toBeNull();
    expect(planBoardTransition(before, { ...after, gameId: 2 })).toBeNull();
    expect(planBoardTransition(before, { ...after, gameOver: true })).not.toBeNull();
    game.makeMove(2,1,3,0); expect(planBoardTransition(before, state(game))).toBeNull();
  });
  it('ignores clock-only snapshots and restores an independent legal-move preview', () => {
    const game = new CheckersGame(30); const accepted = state(game);
    expect(planBoardTransition(accepted, { ...accepted, redTime: 29 })).toBeNull();
    const preview = restoreGame(new CheckersGame(), accepted); preview.makeMove(5,0,4,1);
    expect(accepted.board[5][0].color).toBe('red'); expect(accepted.moveHistory).toHaveLength(0);
    expect(preview.turnTime).toBe(30);
  });
});
