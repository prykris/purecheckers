// Observe settled authority, never UI enable/disable changes or individual capture hops.
export class TurnCue {
  constructor(){this.previous=null;}
  reset(){this.previous=null;}
  observe(snapshot,{recovery=0,busy=false,connected=true,color=null}={}) {
    if(!connected||!color||snapshot?.gameOver||snapshot?.recovery){this.reset();return false;}
    if(busy||!snapshot)return false;
    const next={id:snapshot.gameId,recovery,player:snapshot.currentPlayer};
    const prior=this.previous;this.previous=next;
    return !!prior&&prior.id===next.id&&prior.recovery===recovery&&prior.player!==color&&next.player===color;
  }
}
