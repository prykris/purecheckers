import { tableLayout } from '../src/lib/tableLayout.js';
import { TwoFingerTap } from '../src/lib/twoFingerTap.js';
import { TurnCue } from '../src/lib/turnCue.js';
import { replayTimeline } from '../src/lib/replayTimeline.js';
import { CheckersGame } from '../shared/game.js';

it.each([[320,568],[390,844],[667,375],[844,390],[1440,900]])('keeps the board square and inside %sx%s in every context', (w,h) => {
  for(const finished of [false,true]) for(const focused of [false,true]) {
    const size=tableLayout(w,h,{finished,focused});
    expect(size.board).toBeGreaterThan(0);
    expect(size.board+6).toBeLessThanOrEqual(w);
    expect(size.board+6).toBeLessThanOrEqual(h);
    if(size.mode==='landscape' && !focused) expect(size.board+size.rail+226).toBeLessThanOrEqual(w);
  }
  if(w===390) expect(tableLayout(w,h).board).toBe(w-6);
  if(w===844) expect(tableLayout(w,h).board).toBe(h-6);
});

it('consumes both contacts of a two-finger tap and toggles only on the final release',()=>{
  const gesture=new TwoFingerTap();
  expect(gesture.down(1,20,20,0)).toBe(false);
  expect(gesture.down(2,50,50,60)).toBe(true);
  expect(gesture.up(1,20,20,150)).toEqual({consume:true,toggle:false});
  expect(gesture.up(2,50,50,160)).toEqual({consume:true,toggle:true});
  gesture.down(3,20,20,200);
  expect(gesture.up(3,20,20,240)).toEqual({consume:false,toggle:false});
});
it.each(['move','late','hold','third','cancel'])('a %s gesture cannot toggle focus or become a move',kind=>{
  const gesture=new TwoFingerTap(); gesture.down(1,20,20,0);
  gesture.down(2,50,50,kind==='late'?190:50);
  if(kind==='move')gesture.move(1,40,20);
  if(kind==='third'){gesture.down(3,80,80,70);expect(gesture.up(3,80,80,90)).toEqual({consume:true,toggle:false});}
  expect(gesture.up(1,20,20,200,kind==='cancel')).toEqual({consume:true,toggle:false});
  expect(gesture.up(2,50,50,kind==='hold'?500:210)).toEqual({consume:true,toggle:false});
});

it('announces only a settled opponent-to-player handoff, once per turn',()=>{
  const cue=new TurnCue(), context={color:'red'}, opponent={gameId:1,currentPlayer:'black'};
  expect(cue.observe(opponent,context)).toBe(false);
  expect(cue.observe(null,{...context,busy:true})).toBe(false);
  const mine={...opponent,currentPlayer:'red'};
  expect(cue.observe(mine,context)).toBe(true);
  expect(cue.observe({...mine,redTime:45},context)).toBe(false);
  expect(cue.observe({...mine,chainPiece:{row:3,col:2}},context)).toBe(false);
});
it('never announces a reconnect, server recovery, changed game or finished position as a new turn',()=>{
  const cue=new TurnCue(), context={color:'red'}, opponent={gameId:1,currentPlayer:'black'}, mine={...opponent,currentPlayer:'red'};
  for(const [snapshot,options] of [[mine,{recovery:1}],[{...mine,gameId:2},{}],[{...mine,gameOver:true},{}],[{...mine,recovery:{}},{}]]) {
    cue.reset();cue.observe(opponent,context);expect(cue.observe(snapshot,{...context,...options})).toBe(false);
  }
  cue.reset();cue.observe(opponent,context);cue.observe(null,{...context,connected:false});expect(cue.observe(mine,context)).toBe(false);
});

it('reconstructs verified replay positions without altering history, stopping at the first invalid hop',()=>{
  const game=new CheckersGame();game.makeMove(5,0,4,1);game.makeMove(2,3,3,4);
  const history=structuredClone(game.moveHistory), timeline=replayTimeline(history,12);
  expect(timeline.frames.at(-1).board).toEqual(game.board);
  expect(timeline.frames.at(-1).gameId).toBe(12);
  expect(history).toEqual(game.moveHistory);
  const broken=replayTimeline([history[0],{fromRow:5,fromCol:0,toRow:4,toCol:1},history[1]]);
  expect(broken.invalidMoveIndex).toBe(1);expect(broken.frames).toHaveLength(2);
  broken.frames[1].board[4][1].queen=true;
  expect(timeline.frames[1].board[4][1].queen).toBe(false);
});

it.each([[1024,980],[1024,900]])('keeps desktop seats and secondary content usable at %sx%s', (w,h) => {
  for (const finished of [false,true]) {
    const size = tableLayout(w,h,{finished});
    expect(size.mode).toBe('desktop');
    const sidebar = Math.max(260,Math.min(360,w*.28));
    expect(size.board + 6 + 24 + sidebar).toBeLessThanOrEqual(w);
    expect(size.board + 6 + (finished ? 68 : 112)).toBeLessThanOrEqual(h);
  }
});
it('uses spacious stacked seats for a tall tablet and preserves the vertical rail at wide desktop sizes', () => {
  expect(tableLayout(768,900).mode).toBe('stacked');
  expect(tableLayout(844,390).mode).toBe('landscape');
  expect(tableLayout(390,844).mode).toBe('roomy');
});

it.each([[844,390],[1440,900],[1920,1080]])('preserves the landscape rail and reserves replay transport height at %sx%s', (w,h) => {
  const live=tableLayout(w,h), replay=tableLayout(w,h,{finished:true});
  expect(live.mode).toBe('landscape');
  expect(live.rail).toBe(84);
  expect(replay.mode).toBe('landscape');
  expect(replay.rail).toBe(0);
  expect(replay.board+6+68).toBeLessThanOrEqual(h);
});

it.each([[900,980],[908,982],[980,1100]])('keeps a tall desktop layout when a sidebar would shrink the board at %sx%s', (w,h) => {
  const live=tableLayout(w,h);
  expect(live.mode).toBe('stacked');
  expect(live.board).toBe(Math.floor(Math.min(w-38,h-320)));
  expect(tableLayout(w,h,{finished:true}).mode).toBe('stacked');
});
it('never sacrifices board size when the sidebar first appears', () => {
  for (const h of [800,900,980,1100]) {
    let previous=tableLayout(899,h);
    for(let w=900;w<=1250;w++) {
      const next=tableLayout(w,h);
      if(previous.mode==='stacked' && next.mode==='desktop') expect(next.board).toBeGreaterThanOrEqual(previous.board);
      previous=next;
    }
  }
});
