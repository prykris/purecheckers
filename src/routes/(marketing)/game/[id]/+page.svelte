<script>
  import { CheckersGame } from '$lib/game.js';

  let { data } = $props();

  // svelte-ignore state_referenced_locally
  const g = data.game;
  const moves = g.moveHistory || [];
  let moveIndex = $state(0);
  let checkers = $state(new CheckersGame());

  function replayTo(index) {
    checkers = new CheckersGame();
    for (let i = 0; i < index && i < moves.length; i++) {
      const m = moves[i];
      checkers.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
    }
    moveIndex = index;
  }

  function prev() { if (moveIndex > 0) replayTo(moveIndex - 1); }
  function next() { if (moveIndex < moves.length) replayTo(moveIndex + 1); }
  function toStart() { replayTo(0); }
  function toEnd() { replayTo(moves.length); }

  function onKeyDown(e) {
    if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'Home') toStart();
    else if (e.key === 'End') toEnd();
  }

  const winner = g.result === 'RED_WIN' ? g.redPlayer : g.result === 'BLACK_WIN' ? g.blackPlayer : null;
  const loser = g.result === 'RED_WIN' ? g.blackPlayer : g.result === 'BLACK_WIN' ? g.redPlayer : null;
  const resultText = winner ? `${winner} wins` : 'Draw';

  // Infer why the game ended from the final board state
  function getEndReason() {
    const final = new CheckersGame();
    for (const m of moves) final.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);

    const loserColor = g.result === 'RED_WIN' ? 'black' : 'red';
    let loserPieces = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = final.at(r, c);
      if (p?.color === loserColor) loserPieces++;
    }

    if (loserPieces === 0) return `All pieces captured`;
    const loserMoves = final.getAllValidMoves();
    if (loserMoves.length === 0) return `${loser} has no valid moves`;
    return `${loser} forfeited`;
  }
  const endReason = g.result === 'DRAW' ? 'Game drawn' : getEndReason();

  const fmtDate = new Date(g.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
</script>

<svelte:head>
  <title>{g.redPlayer} vs {g.blackPlayer} — Game Replay — Pure Checkers</title>
  <meta name="description" content="Watch the checkers game between {g.redPlayer} and {g.blackPlayer}. {resultText}. {moves.length} moves played." />
  <link rel="canonical" href="https://purecheckers.com/game/{g.id}" />
  <meta property="og:title" content="{g.redPlayer} vs {g.blackPlayer} — Checkers Replay" />
  <meta property="og:description" content="{resultText} · {moves.length} moves · {g.mode}" />
  <meta property="og:url" content="https://purecheckers.com/game/{g.id}" />
</svelte:head>

<svelte:window onkeydown={onKeyDown} />

<section class="replay-page">
  <nav class="breadcrumb">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <span>Game #{g.id}</span>
  </nav>

  <div class="replay-header">
    <h1>{g.redPlayer} <span class="vs">vs</span> {g.blackPlayer}</h1>
    <div class="meta">
      <span class="result" class:red={g.result === 'RED_WIN'} class:black={g.result === 'BLACK_WIN'}>{resultText}</span>
      <span class="mode">{g.mode === 'RANKED' ? 'Ranked' : 'Friendly'}</span>
      <span class="date">{fmtDate}</span>
    </div>
  </div>

  <div class="board">
    {#each { length: 8 } as _, r}
      {#each { length: 8 } as _, c}
        {@const isDark = (r + c) % 2 === 1}
        {@const piece = checkers.at(r, c)}
        <div class="cell" class:dark={isDark} class:light={!isDark}>
          {#if piece}
            <div class="piece" class:red={piece.color === 'red'} class:black={piece.color === 'black'} class:queen={piece.queen}>
              {#if piece.queen}<span class="crown">♛</span>{/if}
            </div>
          {/if}
        </div>
      {/each}
    {/each}
  </div>

  <div class="controls">
    <button class="ctrl-btn" onclick={toStart} disabled={moveIndex === 0} title="Start">⏮</button>
    <button class="ctrl-btn" onclick={prev} disabled={moveIndex === 0} title="Previous">◀</button>
    <span class="move-counter">{moveIndex} / {moves.length}</span>
    <button class="ctrl-btn" onclick={next} disabled={moveIndex >= moves.length} title="Next">▶</button>
    <button class="ctrl-btn" onclick={toEnd} disabled={moveIndex >= moves.length} title="End">⏭</button>
  </div>

  {#if moveIndex >= moves.length}
    <div class="outcome" class:win={g.result !== 'DRAW'}>
      <span class="outcome-result">{resultText}</span>
      <span class="outcome-reason">{endReason}</span>
    </div>
  {:else}
    <p class="hint">Use arrow keys to navigate moves</p>
  {/if}

  <div class="players">
    <a href="/player/{g.redPlayer}" class="player-link red">
      <span class="dot red"></span> {g.redPlayer}
    </a>
    <a href="/player/{g.blackPlayer}" class="player-link black">
      <span class="dot black"></span> {g.blackPlayer}
    </a>
  </div>
</section>

<style>
  .breadcrumb { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-caption); }
  .breadcrumb a { color: var(--text-dim); text-decoration: none; }
  .breadcrumb a:hover { color: var(--accent); }
  .breadcrumb .sep { color: var(--text-dim); opacity: 0.4; }
  .breadcrumb span:last-child { color: var(--text); font-weight: 500; }

  .replay-page {
    max-width: 500px; margin: 0 auto;
    padding: 48px var(--sp-md) 120px;
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg);
  }

  .replay-header { text-align: center; }
  .replay-header h1 { font-size: var(--fs-heading); font-weight: 700; }
  .vs { color: var(--text-dim); font-weight: 400; font-size: var(--fs-body); }
  .meta { display: flex; gap: var(--sp-sm); align-items: center; justify-content: center; margin-top: var(--sp-xs); font-size: var(--fs-caption); }
  .result { font-weight: 700; }
  .result.red { color: var(--accent); }
  .result.black { color: var(--text); }
  .mode { color: var(--text-dim); padding: 1px 6px; background: var(--surface2); border-radius: var(--radius-pill); }
  .date { color: var(--text-dim); }

  .board {
    display: grid; grid-template-columns: repeat(8, 1fr);
    width: 100%; max-width: 400px; aspect-ratio: 1;
    border-radius: var(--radius-md); overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }
  .cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; position: relative; }
  .cell.light { background: var(--board-light); }
  .cell.dark { background: var(--board-dark); }

  .piece {
    width: 70%; height: 70%; border-radius: 50%; position: relative;
    display: flex; align-items: center; justify-content: center;
  }
  .piece.red { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .piece.black { background: radial-gradient(circle at 35% 35%, #44403c, #1c1917); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .crown { font-size: 0.7em; color: var(--gold); }

  .controls { display: flex; align-items: center; gap: var(--sp-sm); }
  .ctrl-btn {
    background: var(--surface); border: 1px solid var(--surface2); color: var(--text);
    font-size: 1rem; width: 40px; height: 40px; border-radius: var(--radius-md);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .ctrl-btn:hover:not(:disabled) { background: var(--surface2); }
  .ctrl-btn:disabled { opacity: 0.3; cursor: default; }
  .move-counter { font-size: var(--fs-caption); color: var(--text-dim); min-width: 60px; text-align: center; font-family: var(--font-mono); }

  .hint { font-size: 0.6rem; color: var(--text-dim); }
  .outcome {
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-xs);
    padding: var(--sp-md) var(--sp-lg);
    background: var(--surface); border: 1px solid var(--surface2);
    border-radius: var(--radius-md); text-align: center;
  }
  .outcome-result { font-size: var(--fs-heading); font-weight: 700; }
  .outcome.win .outcome-result { color: var(--success); }
  .outcome-reason { font-size: var(--fs-caption); color: var(--text-dim); }

  .players { display: flex; gap: var(--sp-lg); }
  .player-link { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-body); font-weight: 500; color: var(--text-dim); text-decoration: none; transition: color 0.15s; }
  .player-link:hover { color: var(--text); }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot.red { background: var(--accent); }
  .dot.black { background: var(--text-dim); }
</style>
