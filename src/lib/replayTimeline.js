import {CheckersGame} from '../../shared/game.js';
export function replayTimeline(history,gameId='replay') {
  const game=new CheckersGame();
  const snapshot=()=>({...structuredClone(game),gameId});
  const frames=[snapshot()];let invalidMoveIndex=null;
  if(!Array.isArray(history))return {frames,invalidMoveIndex:0};
  for(const [index,move] of history.entries()) {
    if(!move||!game.makeMove(move.fromRow,move.fromCol,move.toRow,move.toCol)){invalidMoveIndex=index;break;}
    frames.push(snapshot());
  }
  return {frames,invalidMoveIndex};
}
