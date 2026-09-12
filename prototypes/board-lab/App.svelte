<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { CheckersGame } from '../../shared/game.js';
  import { squareNumber } from '../../shared/notation.js';
  import { DEFAULT_PIECE_SKIN } from '../../shared/pieceSkins.js';
  import { BoardPresentation } from '../../src/lib/boardPresentation.js';
  import { restoreGame } from '../../src/lib/boardSnapshot.js';
  import { modal } from '../../src/lib/modal.js';
  import Board from './PreviewBoard.svelte';
  import Icon from './Icon.svelte';

  const ratings = [
    { key: 'best', label: 'Best', icon: 'star', color: '#edc76f', note: 'A gold ripple and a bright two-note chime.' },
    { key: 'good', label: 'Good', icon: 'check', color: '#91bea4', note: 'A quiet green pulse and one soft note.' },
    { key: 'inaccuracy', label: 'Inaccuracy', icon: 'question', color: '#e5b179', note: 'An amber ring and a muted tap.' },
    { key: 'blunder', label: 'Blunder', icon: 'question', color: '#ed918b', note: 'A coral ring and a short low tone.' }
  ];
  const skin = {
    red: { ...DEFAULT_PIECE_SKIN.red, base: '#912d30', gradStops: ['#ed6d62', '#cb443f', '#aa3434'], stroke: '#77292c', highlight: 'rgba(255,255,255,0.08)', ring: '#ef8c7c' },
    black: { ...DEFAULT_PIECE_SKIN.black, base: '#181b1c', gradStops: ['#656965', '#3c4140', '#262b2a'], stroke: '#141716', highlight: 'rgba(255,255,255,0.06)', ring: '#81857b' }
  };
  let sheetBox = {left:0,width:390,bottom:0,height:844};
  let phone = '390', sheet = null, sheetEl, strip, boardSize = 320, mounted = false;
  let hints = true, highlights = true, feedbackEnabled = false, sound = false, animations = true, reactions = true, reduced = false;
  let game = new CheckersGame(), rendered = game, selected = null, validMoves = [], modelId = 1;
  let view = { snapshot: null, animation: null, busy: false };
  let entries = [], currentEntry = null, pendingFeedback = null, bubble = null, toast = '', reaction = null;
  let outcome = '', drawState = '', replyTimer, bubbleTimer, toastTimer, reactionTimer, audio;
  let nextRating = 0, chatText = '', messages = [{ who:'Emma', text:'Your move. I’m watching that king 👀' }, {who:'You',text:'I have a plan… probably.'}];
  let profile = 'Alex', startY = 0, conversation;
  let watchersOpen = false, watching = false, spectatorName = 'Nora', floatId = 0, floats = [];
  let spectatorNames = ['Nora', 'Leo'];
  let tableWidth = 390, tableHeight = 818;
  let tableEl, layout = 'roomy', result = null, pendingResult = null, frames = [], replayIndex = 0, replayPlaying = false, replayTimer;
  let departed = false, distractionFree = false;
  function setFocus(enabled) {
    if (enabled === distractionFree) return;
    distractionFree = enabled; closeWatchers(); selected=null; validMoves=[];
    tick().then(() => {
      document.querySelector(enabled ? '.exit-focus' : '.enter-focus')?.focus({preventScroll:true});
      scrollChat();
    });
  }
  $: boardSize = Math.floor(distractionFree ? (layout === 'landscape' ? Math.min(tableHeight-6,tableWidth-106) : Math.min(tableWidth-6,tableHeight-50)) : layout === 'landscape' ? Math.min(tableHeight-6, tableWidth-(result?0:84)-226) : tableWidth-6);
  $: resultTitle = !result ? '' : result.winner === null ? 'Draw agreed' : watching ? (result.winner === 'red' ? 'Alex wins' : 'Emma wins') : result.winner === 'red' ? 'You won' : 'You lost';
  $: if (pendingResult && !view.busy) enterReplay(pendingResult);
  const floatTimers = new Set();
  let watcherCloseTimer, messageTimer;
  let settledTurn = null, turnArrival = false, turnTimer;
  $: yourTurn = mounted && !view.busy && !outcome && !pendingResult && !watching && game.currentPlayer === 'red';
  $: observeTurn(view, modelId, watching, !!outcome || !!pendingResult);

  // Announce only a settled handoff, never a capture continuation or a sheet closing.
  function observeTurn(presentation, id, spectator, ended) {
    if (spectator || ended) {
      settledTurn = null; turnArrival = false; clearTimeout(turnTimer); return;
    }
    const current = presentation.snapshot;
    if (presentation.busy || !current || current.gameId !== id) return;
    const previous = settledTurn;
    settledTurn = {id, player:current.currentPlayer};
    if (previous?.id === id && previous.player === 'black' && current.currentPlayer === 'red') {
      turnArrival = true; clearTimeout(turnTimer);
      turnTimer = setTimeout(() => turnArrival = false, 1800);
    } else if (current.currentPlayer !== 'red') {
      turnArrival = false; clearTimeout(turnTimer);
    }
  }
  function closeWatchers() { watchersOpen = false; clearTimeout(watcherCloseTimer); }
  function watcherHover(event) { if (event.pointerType === 'mouse') { clearTimeout(watcherCloseTimer); watchersOpen = true; } }
  function watcherLeave(event) { if (event.pointerType === 'mouse') watcherCloseTimer = setTimeout(() => watchersOpen = false, 180); }
  function spectatorReact(emoji) {
    if (!reactions || departed || !spectatorNames.includes(spectatorName)) return;
    const id = ++floatId;
    floats = [...floats.slice(-7), {id, emoji, who:spectatorName, drift:[-28,20,-12,32][id%4]}];
    const timer = setTimeout(() => { floats = floats.filter(f=>f.id!==id); floatTimers.delete(timer); }, 2100);
    floatTimers.add(timer); closeWatchers();
  }
  function switchRole() { watching = !watching; if(watching) joinTable(); closeWatchers(); if(watching) { selected=null; validMoves=[]; } }
  function scrollChat() { tick().then(()=>{if(conversation)conversation.scrollTop=conversation.scrollHeight;}); }

  const controller = new BoardPresentation({ publish: next => view = next });
  const snapshot = () => ({ ...structuredClone(game), gameId: modelId });
  $: if (view.snapshot) rendered = restoreGame(new CheckersGame(), view.snapshot);
  $: canPlay = mounted && !view.busy && !outcome && !pendingResult && !sheet && !watching && game.currentPlayer === 'red';
  $: if (view.busy || outcome) { selected = null; validMoves = []; }
  $: if (canPlay && game.chainPiece) { selected = { ...game.chainPiece }; validMoves = game.getValidMovesFor(selected.row, selected.col); }
  $: if (pendingFeedback && !view.busy) { const item = pendingFeedback; pendingFeedback = null; showFeedback(item); }
  $: status = outcome || (view.busy ? 'Moving…' : game.currentPlayer === 'black' ? 'Emma is thinking…' : game.chainPiece ? 'Continue your capture' : 'Your turn');
  $: lastMove = highlights ? rendered.moveHistory.at(-1) : null;
  
  $: capturedRed = entries.filter(e => e.color === 'black').reduce((n, e) => n + e.captured, 0);
  $: capturedBlack = entries.filter(e => e.color === 'red').reduce((n, e) => n + e.captured, 0);

  function notify(text) { toast = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast = '', 2400); }
  function tone(kind) {
    if (!sound) return;
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    void audio.resume();
    const notes = { best: [660, 880], good: [520], inaccuracy: [270], blunder: [175], place: [310], capture: [190, 250], crown: [440, 660, 880] }[kind] || [380];
    notes.forEach((hz, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + i * 0.085;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(hz, at);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.08, at + 0.008); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.17);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at + 0.19);
    });
  }
  function showFeedback(entry) {
    if (feedbackEnabled && entry.rating) {
      bubble = { ...entry, id: performance.now() }; clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble = null, 1900);
      tone(entry.rating.key);
    }
    if (game.currentPlayer === 'black' && !outcome) scheduleReply();
  }
  function scheduleReply() { clearTimeout(replyTimer); replyTimer = setTimeout(() => { if (sheet) return; const move = game.getAllValidMoves()[0]; if (move) applyMove(move, false); }, 1050); }
  function applyMove(move, human = true) {
    if (view.busy || outcome || (human && !canPlay)) return;
    const color = game.currentPlayer, result = game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    if (!result) return;
    turnArrival = false; clearTimeout(turnTimer);
    const m = game.moveHistory.at(-1), rating = human ? ratings[nextRating++ % ratings.length] : null;
    const entry = { id: entries.length + 1, color, move: m, captured: m.captured.length, rating, notation: `${squareNumber(m.fromRow,m.fromCol)}${m.captured.length ? '×' : '–'}${squareNumber(m.toRow,m.toCol)}` };
    entries = [...entries, entry]; currentEntry = entry; selected = null; validMoves = []; bubble = null;
    game = game; controller.accept(snapshot(), { enabled: animations && !reduced, recovery: modelId });
    tone(result.promoted ? 'crown' : m.captured.length ? 'capture' : 'place');
    if (human) pendingFeedback = entry;
    else if (game.currentPlayer === 'black' && !game.gameOver) scheduleReply();
    frames = [...frames, snapshot()];
    if (game.gameOver) finish(game.winner, 'No legal moves remaining');
    tick().then(() => strip?.scrollTo({ left: strip.scrollWidth, behavior: reduced ? 'instant' : 'smooth' }));
  }
  function select(event) { selected = { row: event.detail.row, col: event.detail.col }; validMoves = event.detail.moves; }
  function open(name) { closeWatchers(); clearTimeout(replyTimer); const rect = document.querySelector('.phone').getBoundingClientRect(); sheetBox = { left:rect.left, width:rect.width, bottom:innerHeight-rect.bottom, height:rect.height }; sheet = name; }
  function close() { sheet = null; if (game.currentPlayer === 'black' && !outcome) scheduleReply(); }
  function peek(entry) { currentEntry = entry; if(result) seek(entry.id); else open('Moves'); }
  function reactionSend(label) { close(); if (!reactions || departed) return; if(watching){spectatorReact({'Nice move':'👏','Good game':'❤️','Thinking…':'😮','King move':'🔥'}[label]);return;} reaction = label; clearTimeout(reactionTimer); reactionTimer = setTimeout(() => reaction = null, 2200); tone('good'); }
  function chatSend() {
    if (departed || !chatText.trim()) return;
    messages = [...messages, {who:watching?spectatorName:'You',text:chatText.trim()}]; chatText=''; scrollChat();
    clearTimeout(messageTimer); messageTimer=setTimeout(()=>{messages=[...messages,{who:'Emma',text:'Let’s see what happens on the board 🙂'}];scrollChat();},1400);
  }
  function offerDraw() { drawState = 'sent'; close(); notify('Demo draw offered to Emma'); }
  function endDraw() { finish(null, 'By agreement'); }

  // Ending changes the board view, never the table's chat or presence.
  function finish(winner, reason) {
    if(result || pendingResult) return;
    clearTimeout(replyTimer); clearTimeout(bubbleTimer); clearTimeout(messageTimer);
    pendingFeedback = null; bubble = null; drawState = ''; sheet = null;
    pendingResult = {winner, reason};
  }
  function enterReplay(ending) {
    setFocus(false);
    pendingResult = null; result = ending; outcome = ending.reason;
    replayIndex = frames.length - 1; currentEntry = entries.at(-1); scrollChat();
  }
  function stopReplay() { clearTimeout(replayTimer); replayPlaying = false; }
  function seek(index, autoplay = false) {
    if(!result) return;
    if(!autoplay) stopReplay();
    const next = Math.max(0, Math.min(frames.length-1, Number(index)));
    const adjacent = next === replayIndex + 1;
    replayIndex = next; currentEntry = entries[next-1] || null;
    controller.accept(frames[next], {enabled:adjacent && animations && !reduced, recovery:modelId});
  }
  function advanceReplay() {
    if(!replayPlaying) return;
    if(view.busy) { replayTimer=setTimeout(advanceReplay,100); return; }
    if(replayIndex >= frames.length-1) { stopReplay(); return; }
    seek(replayIndex+1, true); replayTimer=setTimeout(advanceReplay,900);
  }
  function toggleReplay() {
    if(replayPlaying) { stopReplay(); return; }
    if(replayIndex === frames.length-1) seek(0);
    replayPlaying = true; replayTimer=setTimeout(advanceReplay,350);
  }
  function presence(name, present) {
    if(spectatorNames.includes(name) === present) return;
    spectatorNames = present ? [...spectatorNames,name] : spectatorNames.filter(n=>n!==name);
    messages = [...messages,{who:'Table',text:`${name} ${present?'joined':'left'} the table.`}]; scrollChat();
  }
  function leaveTable() { stopReplay(); presence(spectatorName,false); departed=true; closeWatchers(); }
  function joinTable() { presence(spectatorName,true); departed=false; }
  async function copyReplay() {
    // A local demonstration link; production will use its persisted replay ID.
    try { await navigator.clipboard.writeText(location.origin+'/?preview=replay'); notify('Local preview link copied'); }
    catch { notify('Copy unavailable in this browser'); }
  }
  function reset(scenario = 'normal') {
    stopReplay(); clearTimeout(turnTimer); turnArrival=false; settledTurn=null; result=null; pendingResult=null; clearTimeout(replyTimer); clearTimeout(bubbleTimer); modelId++; game = new CheckersGame(); outcome = ''; drawState = ''; entries = []; bubble = null; pendingFeedback = null; selected = null; validMoves = []; currentEntry = null; nextRating = 0;
    frames = [snapshot()];
    if (scenario === 'normal') {
      // Real legal history provides a populated tray without fabricated moves.
      for (let i = 0; i < 14 && !game.gameOver; i++) {
        const choices = game.getAllValidMoves(), m = choices[(i * 3 + 1) % choices.length]; if (!m) break;
        const color = game.currentPlayer; game.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
        frames.push(snapshot()); const step = game.moveHistory.at(-1); entries.push({ id: entries.length + 1, color, move: step, captured: step.captured.length, rating: color === 'red' ? ratings[Math.floor(i/2)%4] : null, notation: `${squareNumber(step.fromRow,step.fromCol)}${step.captured.length ? '×' : '–'}${squareNumber(step.toRow,step.toCol)}` });
      }
      while (game.currentPlayer === 'black' && !game.gameOver) { const m = game.getAllValidMoves()[0]; const color = game.currentPlayer; game.makeMove(m.fromRow,m.fromCol,m.toRow,m.toCol); frames.push(snapshot()); const step = game.moveHistory.at(-1); entries.push({id:entries.length+1,color,move:step,captured:step.captured.length,rating:null,notation:`${squareNumber(step.fromRow,step.fromCol)}–${squareNumber(step.toRow,step.toCol)}`}); }
    } else {
      game.board = Array.from({length:8},()=>Array(8).fill(null));
      const pieces = scenario === 'turn' ? [[5,0,'red'],[6,3,'red'],[2,1,'black'],[1,6,'black']] : scenario === 'capture' ? [[5,0,'red'],[4,1,'black'],[2,3,'black'],[0,7,'black'],[7,6,'red']] : [[1,2,'red'],[4,5,'black'],[6,1,'red'],[0,7,'black']];
      for(const [r,c,color] of pieces) game.board[r][c] = {color,queen:false};
      if(scenario === 'turn') game.currentPlayer = 'black';
      game.positionHistory = [game._boardHash()]; frames = [snapshot()];
    }
    entries = [...entries]; currentEntry = entries.at(-1); controller.accept(snapshot(), {enabled:false,recovery:modelId}); sheet = null;
    if(scenario === 'turn') scheduleReply();
    tick().then(() => { if(strip) strip.scrollLeft = strip.scrollWidth; });
  }
  function sample(rating) {
    close(); const entry = entries.findLast(e => e.color === 'red') || { move: {toRow:5,toCol:0}, notation:'Preview' };
    bubble = { ...entry, rating, id: performance.now() }; clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble = null, 1900); tone(rating.key);
  }
  onMount(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)'); const updateMotion = () => reduced = motion.matches;
    updateMotion(); motion.addEventListener('change', updateMotion);
    const resize = new ResizeObserver(([entry]) => {
      const {width,height} = entry.contentRect;
      layout = width > height * 1.2 ? 'landscape' : height-width < 190 ? 'focus' : height-width < 340 ? 'compact' : 'roomy';
      tableWidth = width; tableHeight = height;
      scrollChat();
    });
    resize.observe(tableEl); mounted = true; reset(); if(new URLSearchParams(location.search).get('preview')==='replay') finish('black','By resignation'); scrollChat();
    const outside = event => { if(!event.target.closest('.spectator-anchor'))closeWatchers(); };
    const escape = event => { if(event.key==='Escape' && distractionFree && !sheet){event.preventDefault();setFocus(false);return;} if(event.key==='Escape' && watchersOpen){closeWatchers(); document.querySelector('.watchers')?.focus();} };
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);
    return () => { resize.disconnect(); motion.removeEventListener('change', updateMotion); window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape); };
  });
  onDestroy(() => { stopReplay(); controller.dispose(); [turnTimer,replyTimer,bubbleTimer,toastTimer,reactionTimer,watcherCloseTimer,messageTimer,...floatTimers].forEach(clearTimeout); void audio?.close(); });
</script>

<div class="lab-bar"><span><i></i> LOCAL BOARD LAB <span class="desktop-note">· no account or server connection</span></span><button class="role-switch" on:click={switchRole}>{watching?'Return to player':'Try spectator view'}</button><div class="sizes"><button class:chosen={phone==='320'} on:click={()=>phone='320'}>320 × 568</button><button class:chosen={phone==='390'} on:click={()=>phone='390'}>390 × 844</button><button class:chosen={phone==='430'} on:click={()=>phone='430'}>430 × 932</button><button class:chosen={phone==='844'} on:click={()=>phone='844'}>Landscape</button></div></div>
<main class="phone" class:immersive={distractionFree} class:watching class:finished={!!result} data-layout={layout} style:--board-size={boardSize+'px'} style:--player-rail={result?'0px':'84px'} bind:this={tableEl} style:--phone-width={phone+'px'} style:--phone-height={(phone==='320'?568:phone==='430'?932:phone==='844'?390:844)+'px'}>
  <header><span class="match-label">{result?'Replay':'Friendly'} <span class="muted">· {result?'Friendly':'60s / turn'}</span></span><div class="header-tools">      <div class="spectator-anchor" on:pointerenter={watcherHover} on:pointerleave={watcherLeave}>
        <button class="watchers" aria-label={`Watching: ${spectatorNames.join(", ") || "nobody"}. Show spectators`} aria-expanded={watchersOpen} aria-controls="spectator-list" on:click={()=>watchersOpen=!watchersOpen}><Icon name="eye" size={18}/><span aria-live="polite">{spectatorNames.length}</span></button>
        {#if watchersOpen}<div class="spectator-popover" id="spectator-list" role="region" aria-label="Spectators">
          <div class="spectator-title"><strong>At this table</strong><button aria-label="Close spectators" on:click={closeWatchers}><Icon name="close" size={16}/></button></div>
          {#each spectatorNames as name}<button class="spectator-person" on:click={()=>{profile=name;open('Player');}}><span class="spectator-avatar">{name.slice(0,2).toUpperCase()}</span><span>{name}<small>At the table</small></span><i></i></button>{/each}
          <div class="spectator-preview"><label>React as <select aria-label="Demo spectator" bind:value={spectatorName}>{#each spectatorNames as name}<option>{name}</option>{/each}</select></label><div>{#each [{emoji:'👏',label:'Applause'},{emoji:'🔥',label:'On fire'},{emoji:'😮',label:'Surprised'},{emoji:'❤️',label:'Love it'}] as r}<button aria-label={r.label+' from spectator'} disabled={!reactions||departed||!spectatorNames.length} on:click={()=>spectatorReact(r.emoji)}>{r.emoji}</button>{/each}</div><small>Presence simulation</small><button class="presence-demo" on:click={()=>presence("Leo",!spectatorNames.includes("Leo"))}>{spectatorNames.includes("Leo")?"Leo leaves":"Leo returns"}</button></div>
        </div>{/if}
        <div class="spectator-floats" aria-hidden="true">{#each floats as f(f.id)}<span class:still={reduced||!animations} style:--drift={f.drift+'px'}><b>{f.emoji}</b><small>{f.who}</small></span>{/each}</div>
      </div><button class="icon-button enter-focus" aria-label="Enter distraction-free mode" title="Focus mode · two-finger tap on the board" on:click={()=>setFocus(true)}><Icon name="expand"/></button><button class="icon-button" aria-label="Board settings" on:click={()=>open('Settings')}><Icon name="settings"/></button></div></header>
  <section class="play-zone" aria-label={result?'Finished game and board':'Players and board'}>
  {#if result}<section class="result-heading" aria-live="polite"><div><h1 class:victory={result.winner==='red'}>{resultTitle}</h1><span>{result.reason}</span></div><p><button on:click={()=>{profile='Alex';open('Player');}}>Alex</button><span>vs</span><button on:click={()=>{profile='Emma';open('Player');}}>Emma</button></p></section>{:else}
  <div class="player"><button class="identity" on:click={()=>{profile='Emma';open('Player');}}><span class="avatar emma">EM</span><span><strong>Emma</strong><small>1,280 <span class="piece-dot black"></span><span class="captures">{capturedRed?`+${capturedRed} captured`:''}</span></small></span></button><span class:active={game.currentPlayer==='black'} class="clock" aria-label="Emma: 38 seconds remaining"><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="clock-track" cx="12" cy="12" r="9"/><circle class="clock-progress" cx="12" cy="12" r="9" pathLength="60" stroke-dasharray="38 60"/></svg><span>0:38</span></span></div>
  {/if}
  <div class="board-stage">
    <div class="board-frame" class:focus-turn={distractionFree && yourTurn} class:focus-arrival={distractionFree && turnArrival && yourTurn && animations && !reduced}>
      <Board readOnlyLabel={result?`Replay position ${replayIndex} of ${entries.length}`:watching?'Watching Alex and Emma play':null} game={rendered} myColor="red" interactive={canPlay} animation={view.animation} maxSize={boardSize} {skin} selectedPiece={selected} {validMoves} showHints={hints} {lastMove} lastMoveCaptured={highlights?lastMove?.captured||[]:[]} on:togglefocus={()=>setFocus(!distractionFree)} on:select={select} on:deselect={()=>{selected=null;validMoves=[];}} on:move={e=>applyMove(e.detail)} />
      {#if bubble && !view.busy && !distractionFree}
        {#key bubble.id}<div class="move-feedback" class:no-motion={!animations||reduced} style:--feedback={bubble.rating.color} style:left={(bubble.move.toCol+.5)*12.5+'%'} style:top={(bubble.move.toRow+.5)*12.5+'%'}><span class="ripple"></span><span class="rating-bubble" class:below={bubble.move.toRow===0}><Icon name={bubble.rating.icon} size={13}/>{bubble.rating.key==='blunder'?'? ':''}{bubble.rating.label}</span></div>{/key}
      {/if}
      {#if reaction && !distractionFree}<div class="reaction-bubble"><Icon name={reaction==='King move'?'crown':'smile'} size={24}/><span>{reaction}</span></div>{/if}
    </div>
  </div>
  {#if !result}<div class="player self" class:turn-active={yourTurn} class:turn-arrival={turnArrival && yourTurn && animations && !reduced}><button class="identity" on:click={()=>{profile='Alex';open('Player');}}><span class="avatar alex">AL</span><span><strong>Alex <span class="you" class:turn-label={yourTurn} role="status">{watching?'':status}</span></strong><small>1,240 <span class="piece-dot red"></span><span class="captures">{capturedBlack?`+${capturedBlack} captured`:''}</span></small></span></button><span class:active={yourTurn} class="clock" aria-label="Alex: 52 seconds remaining"><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="clock-track" cx="12" cy="12" r="9"/><circle class="clock-progress" cx="12" cy="12" r="9" pathLength="60" stroke-dasharray="52 60"/></svg><span>0:52</span></span></div>

  {/if}
  </section>
  {#if result}<section class="replay-controls" aria-label="Game replay"><div><button aria-label="First position" disabled={replayIndex===0} on:click={()=>seek(0)}><Icon name="first" size={17}/></button><button aria-label="Previous move" disabled={replayIndex===0} on:click={()=>seek(replayIndex-1)}><Icon name="previous" size={17}/></button><button class="replay-toggle" on:click={toggleReplay} disabled={frames.length<2}><Icon name={replayPlaying?'pause':'play'} size={16}/>{replayPlaying?'Pause':'Replay game'}</button><button aria-label="Next move" disabled={replayIndex===frames.length-1} on:click={()=>seek(replayIndex+1)}><Icon name="arrow" size={17}/></button><button aria-label="Final position" disabled={replayIndex===frames.length-1} on:click={()=>seek(frames.length-1)}><Icon name="last" size={17}/></button></div><label><span>{replayIndex} / {entries.length}</span><input aria-label="Replay position" type="range" min="0" max={frames.length-1} value={replayIndex} on:input={e=>seek(e.currentTarget.value)}/><button on:click={()=>open('Moves')}>Moves</button></label></section>{:else}
  <section class="history"><button class="history-heading" on:click={()=>open('Moves')}><Icon name="history" size={16}/><span class="history-label">Moves</span><Icon name="up" size={12}/></button><div class="move-strip" bind:this={strip} aria-label="Move history. Scroll horizontally.">{#each entries as e}<button class:latest={e===entries.at(-1)} aria-label={`Move ${e.id}: ${e.notation}${e.rating?', '+e.rating.label:''}`} on:click={()=>peek(e)}><span class="piece-dot {e.color}"></span><small>{e.id}.</small>{e.notation}{#if e.rating}<span style:color={e.rating.color}><Icon name={e.rating.icon} size={12}/></span>{/if}</button>{/each}{#if !entries.length}<p>Make your first move.</p>{/if}</div></section>
  {/if}
  <section class="table-chat" aria-label="Conversation at the table">
    {#if layout==='compact'}<button class="conversation-link" aria-label="Open table chat" on:click={()=>open('Chat')}><Icon name="chat" size={15}/><span>Conversation</span><small class="chat-preview">{messages.at(-1)?.text}</small><Icon name="arrow" size={12}/></button>{/if}<div class="conversation" bind:this={conversation} aria-label="Recent messages" role="log">{#each messages as m}<div class="message" class:mine={m.who==='You'||m.who===spectatorName}><div><small>{m.who}</small><p>{m.text}</p></div></div>{/each}</div>
    <form class="inline-composer" on:submit|preventDefault={chatSend}><button type="button" aria-label="Send a reaction" on:click={()=>open('Reactions')} disabled={!reactions}><Icon name="smile" size={20}/></button><input aria-label="Message the table" placeholder={watching?'Chat as '+spectatorName+'…':'Message Emma…'} bind:value={chatText}/><button type="submit" aria-label="Send message"><Icon name="send" size={18}/></button></form>
  </section>
  <nav aria-label="Game actions">
    {#if departed}<button class="join-table" on:click={joinTable}>Rejoin table</button>
    {:else if result}
      {#if !watching}<button class="again" on:click={()=>reset()}>Play again</button>{/if}
      <button on:click={copyReplay}><Icon name="share"/>Share replay</button>
      {#if watching}<button on:click={leaveTable}>Leave table</button>{/if}
    {:else if watching}<button on:click={()=>open('Reactions')}><Icon name="smile"/>React</button><button on:click={leaveTable}>Leave table</button>
    {:else}<button on:click={()=>open('Draw')}><Icon name="draw"/>{drawState?'Draw offered':'Offer draw'}</button><span class="table-note"></span><button class="resign" on:click={()=>open('Resign')}><Icon name="flag"/>Resign</button>{/if}
    <button class="more-actions" aria-label="Table actions" on:click={()=>open('Table')}>•••</button>
  </nav>
  {#if distractionFree}<section class="focus-hud" aria-label="Focus controls">
    <span class="focus-status" class:my-turn={yourTurn} role="status"><i aria-hidden="true"></i>{result?`Replay · ${replayIndex} / ${entries.length}`:watching?`${game.currentPlayer==='red'?'Alex':'Emma'}’s turn`:status}</span>
    {#if result}<button class="focus-replay" aria-label={replayPlaying?'Pause replay':'Play replay'} on:click={toggleReplay}><Icon name={replayPlaying?'pause':'play'} size={19}/></button>{:else}<span class="focus-clock" class:my-turn={yourTurn} aria-label={`${game.currentPlayer==='red'?'Alex: 52':'Emma: 38'} seconds remaining`}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l3 2"/></svg>{game.currentPlayer==='red'?'0:52':'0:38'}</span>{/if}
    <button class="exit-focus" aria-label="Exit distraction-free mode" aria-keyshortcuts="Escape" title="Exit focus · Esc or two-finger tap" on:click={()=>setFocus(false)}><Icon name="collapse" size={20}/></button>
  </section>{/if}
  {#if departed}<div class="departure"><strong>You left the table</strong><p>The replay remains available.</p><button on:click={joinTable}>Rejoin conversation</button></div>{/if}
  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</main>

{#if sheet}
  <dialog class="sheet" style:left={sheetBox.left+'px'} style:right="auto" style:bottom={sheetBox.bottom+'px'} style:width={sheetBox.width+'px'} style:max-height={sheetBox.height*.84+'px'} bind:this={sheetEl} aria-label={sheet==='Player'?`${profile}'s demo profile`:sheet} use:modal={{onclose:close}}>
    <div class="sheet-grab" role="presentation" on:pointerdown={e=>{startY=e.clientY;e.currentTarget.setPointerCapture(e.pointerId);}} on:pointerup={e=>{if(e.clientY-startY>45)close();}}><span></span></div>
    <div class="sheet-heading"><h2>{sheet==='Player'?profile:sheet==='Draw'?'Draw offer':sheet==='Resign'?'Resign game?':sheet}</h2><button class="icon-button" data-initial-focus aria-label="Close panel" on:click={close}><Icon name="close"/></button></div>
    <div class="sheet-content">
    {#if sheet==='Settings'}
      <p class="footnote">Focus mode: use the expand button or tap the board with two fingers. Tap again or press Escape to return.</p><p class="eyebrow">BOARD & FEEDBACK</p>
      {#each [{label:'Legal-move hints',key:'hints',value:hints,icon:'eye'},{label:'Last-move highlight',key:'highlights',value:highlights,icon:'history'},{label:'Move-rating popups',key:'feedback',value:feedbackEnabled,icon:'star'},{label:'Sound',key:'sound',value:sound,icon:'sound'},{label:'Animations',key:'animations',value:animations,icon:'arrow'},{label:'Reactions',key:'reactions',value:reactions,icon:'smile'}] as setting}
        <button class="setting" role="switch" aria-checked={setting.value} on:click={()=>{if(setting.key==='hints')hints=!hints;if(setting.key==='highlights')highlights=!highlights;if(setting.key==='feedback'){feedbackEnabled=!feedbackEnabled;bubble=null;}if(setting.key==='sound'){sound=!sound;if(sound)tone('good');}if(setting.key==='animations')animations=!animations;if(setting.key==='reactions')reactions=!reactions;}}><span><Icon name={setting.icon} size={18}/>{setting.label}</span><span class="toggle" class:on={setting.value}></span></button>
      {/each}
      <p class="footnote">Tap-to-move and keyboard controls stay available. {reduced?'Your reduced-motion preference is active.':'Effects respect your reduced-motion preference.'}</p>
      <p class="eyebrow lab-heading">PROTOTYPE CONTROLS</p><p class="footnote">Moves use real rules. Ratings are rotating samples, not an assessment of your play. Timers and opponent replies are simulated.</p>
      <div class="feedback-samples">{#each ratings as r}<button style:color={r.color} on:click={()=>sample(r)}><Icon name={r.icon} size={18}/>{r.label}</button>{/each}</div>
      <div class="demo-buttons"><button on:click={()=>reset('turn')}>Try turn change</button><button on:click={()=>reset('capture')}>Try a double jump</button><button on:click={()=>reset('crown')}>Try a promotion</button><button on:click={()=>reset()}>Reset demo</button><button disabled={!!result} on:click={()=>finish('red','By resignation')}>Preview win</button><button disabled={!!result} on:click={()=>finish('black','By resignation')}>Preview loss</button><button disabled={!!result} on:click={()=>finish(null,'By agreement')}>Preview draw</button></div>
    {:else if sheet==='Table'}
      <div class="demo-buttons"><button on:click={()=>open('Chat')}>Conversation</button><button on:click={()=>open('Moves')}>Move history</button><button disabled={departed} on:click={()=>open('Reactions')}>Reactions</button>{#if !watching && !result}<button on:click={()=>open('Draw')}>Offer draw</button><button on:click={()=>open('Resign')}>Resign</button>{/if}<button on:click={()=>open('Settings')}>Board settings</button></div>
    {:else if sheet==='Moves'}
      <p class="footnote">{result?'Select a move, then return to its position on the board.':'Your board stays live while you browse.'} Move ratings are demo samples.</p><div class="move-strip expanded">{#each entries as e}<button class:latest={currentEntry===e} on:click={()=>{currentEntry=e;if(result)seek(e.id);}}><span class="piece-dot {e.color}"></span>{e.id}. {e.notation}{#if e.rating}<span style:color={e.rating.color}><Icon name={e.rating.icon} size={13}/></span>{/if}</button>{/each}</div>
      {#if currentEntry}<div class="move-detail"><span class="detail-disc {currentEntry.color}">{#if currentEntry.rating}<Icon name={currentEntry.rating.icon} size={28}/>{/if}</span><div><small>{currentEntry.color==='red'?'Your move':'Emma’s move'} · {currentEntry.id}</small><h3>{currentEntry.notation}</h3><strong style:color={currentEntry.rating?.color||'#b7b4ab'}>{currentEntry.rating?.label||'Not evaluated'}</strong></div></div><p class="footnote">{currentEntry.captured?`${currentEntry.captured} piece${currentEntry.captured>1?'s':''} captured`:'No capture'}{currentEntry.rating?' · Sample rating':''}</p>{:else}<p class="footnote">No moves yet.</p>{/if}<button class="primary full" on:click={close}>{result?'Return to replay':'Return to live board'}</button>
    {:else if sheet==='Chat'}
      <p class="footnote">Local chat preview. Nothing is sent to another player.</p><div class="chat-messages">{#each messages as m}<div class:mine={m.who==='You'}><small>{m.who}</small><p>{m.text}</p></div>{/each}</div><form class="chat-form" on:submit|preventDefault={chatSend}><button type="button" class="icon-button" aria-label="Send a reaction" disabled={!reactions||departed} on:click={()=>open('Reactions')}><Icon name="smile"/></button><input aria-label="Chat message" placeholder="Message Emma…" bind:value={chatText}/><button class="icon-button" aria-label="Send demo message"><Icon name="send"/></button></form>
    {:else if sheet==='Reactions'}
      <p class="footnote">Quick reactions appear briefly beside the board.</p><div class="reaction-picker">{#each ['Nice move','Good game','Thinking…','King move'] as label}<button on:click={()=>reactionSend(label)}><span><Icon name={label==='King move'?'crown':'smile'} size={32}/></span>{label}</button>{/each}</div>
    {:else if sheet==='Draw'}
      <p class="sheet-copy">{drawState?'Your offer is waiting for Emma.':'Offer Emma a draw? The game continues until both players agree.'}</p>{#if drawState}<p class="footnote">Prototype: choose the response to preview either outcome.</p><div class="button-row"><button class="primary" on:click={endDraw}>Emma accepts</button><button on:click={()=>{drawState='';close();notify('Emma declined your draw offer');}}>Emma declines</button></div>{:else}<div class="button-row"><button on:click={close}>Keep playing</button><button class="primary" on:click={offerDraw}>Offer draw</button></div>{/if}
    {:else if sheet==='Resign'}
      <p class="sheet-copy">Emma wins if you resign. This only ends the local demo.</p><div class="button-row"><button on:click={close}>Keep playing</button><button class="danger" on:click={()=>finish('black','By resignation')}>Resign game</button></div>
    {:else if sheet==='Player'}
      <div class="profile-card"><span class="avatar {profile==='Alex'?'alex':'emma'}">{profile==='Alex'?'AL':'EM'}</span><div><h3>{profile}</h3><p>{profile==='Alex'?'Your profile':spectatorNames.includes(profile)?'Spectator profile':'Opponent profile'} · demo</p></div></div><div class="profile-stats"><div><strong>{profile==='Alex'?'1,240':'1,280'}</strong><small>Rating</small></div><div><strong>42</strong><small>Games</small></div><div><strong>58%</strong><small>Win rate</small></div></div>{#if profile!=='Alex'}<button class="primary full" on:click={()=>notify('Demo friend request sent')}>Add as friend</button>{/if}<p class="footnote">Sample profile; opening this sheet keeps the game in place.</p>
    {/if}
    </div>
  </dialog>
{/if}

<style>
  :global(html),:global(body),:global(#app){width:100%;height:100%;min-height:0;margin:0;overflow:hidden;} :global(body){background:#111311;color:#efede7;} :global(button){font:inherit;cursor:pointer;color:inherit;} :global(button:disabled){opacity:.4;cursor:default;} :global(button:focus-visible){outline:2px solid #edc76f;outline-offset:2px;}
  :global(:root){--board-light:#d1ae79;--board-dark:#785d40;--shadow-board:none;}
  .lab-bar{height:26px;display:flex;align-items:center;justify-content:center;font-size:9px;letter-spacing:1.3px;color:#989f96;gap:30px;background:#151815;} .lab-bar i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#9db79f;margin-right:5px;}.sizes,.desktop-note{display:none;}
  .phone{position:relative;container-type:size;width:100%;height:calc(100dvh - 26px);margin:auto;padding:0 0 max(2px,env(safe-area-inset-bottom));display:flex;flex-direction:column;background:#1c1c19;overflow:hidden;}
  .role-switch{border:0;background:#b9996120;color:#d8c5a5;padding:3px 7px;border-radius:5px;font-size:9px;letter-spacing:0;white-space:nowrap;}.lab-bar{gap:12px;}
  header{height:34px;min-height:34px;display:flex;align-items:center;justify-content:space-between;padding:0 6px;font-size:11px;border-bottom:1px solid #e9cc9712;}header>span{display:flex;align-items:center;gap:6px;}.table-mark{font-weight:700;color:#edbc76;width:22px;height:22px;display:grid;place-items:center;border:1px solid #dba66466;border-radius:7px;background:#dcb27815;}.muted{color:#a99d8e;}.icon-button{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;background:transparent;border-radius:10px;padding:0;}
  .player{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;height:48px;gap:8px;padding:0 8px;}.identity{display:flex;align-items:center;gap:9px;background:none;border:0;padding:3px 0;text-align:left;min-height:44px;}.avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:600;box-shadow:inset 0 0 0 1px #fff3,0 3px 7px #0003;}.emma{background:linear-gradient(145deg,#8a7762,#53493e);color:#fff0d4;}.alex{background:linear-gradient(145deg,#c66a4e,#723e32);color:#ffddc2;}.identity strong{font-size:13px;font-weight:600;}.identity small{display:flex;align-items:center;gap:6px;color:#ad9f8e;font-size:10px;margin-top:1px;}.you{font-size:9px;color:#d0b780;font-weight:400;margin-left:4px;}.captures{font-size:9px;}
  .clock{display:flex;align-items:center;gap:5px;font-size:16px;font-variant-numeric:tabular-nums;font-weight:500;letter-spacing:.2px;color:#a99b87;}.clock svg{width:22px;height:22px;transform:rotate(-90deg);fill:none;stroke-width:2;}.clock-track{stroke:#ffffff12;}.clock-progress{stroke:#9a8a73;stroke-linecap:round;}.clock.active{color:#eed6a7;}.clock.active .clock-progress{stroke:#e8bd75;filter:drop-shadow(0 0 2px #e3ad6477);}
.board-stage{flex:none;aspect-ratio:1;width:100%;min-height:0;display:flex;align-items:center;justify-content:center;}.board-frame{position:relative;padding:2px;background:#6b573a;border:1px solid #debb8499;border-radius:3px;}.board-frame :global(canvas){border-radius:1px;}.piece-dot{display:inline-block;width:7px;height:7px;border-radius:50%;flex-shrink:0;border:1px solid #b5b2a34d;}.piece-dot.red{background:#df6658;}.piece-dot.black{background:#60655e;}
  .history{height:40px;flex-shrink:0;display:flex;align-items:center;gap:7px;padding:0 6px;border-top:1px solid #dbc29a18;border-bottom:1px solid #dbc29a18;background:#19161155;}.history-heading{display:flex;gap:4px;align-items:center;color:#c2ad8b;background:none;border:0;padding:0;flex-shrink:0;font-size:10px;height:36px;}.history-label{display:none;}.move-strip{min-width:0;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding:3px 0;overscroll-behavior-x:contain;}.move-strip>button{white-space:nowrap;display:flex;align-items:center;gap:4px;border:1px solid #dcc09717;background:linear-gradient(#ffffff07,#ffffff02);border-radius:6px;padding:6px 7px;font-size:10px;min-height:30px;flex-shrink:0;}.move-strip>button>span{display:flex;}.move-strip small{font-size:9px;color:#9c8c74;}.move-strip>button.latest{border-color:#c5a36b70;background:#c5a36b19;}.move-strip p{font-size:11px;color:#a3937c;}
  .table-chat{flex:1;min-height:66px;display:flex;flex-direction:column;margin:0 6px;padding-top:3px;}.conversation-heading{height:25px;min-height:25px;display:flex;justify-content:space-between;align-items:center;}.conversation-heading>button{display:flex;align-items:center;gap:4px;border:0;background:none;font-size:10px;color:#ad9a80;padding:0;}.conversation{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#6c5b46 transparent;display:flex;flex-direction:column;gap:7px;padding:3px 0 6px;overscroll-behavior:contain;}.message{display:flex;align-items:flex-end;gap:6px;max-width:91%;}.message>div{background:linear-gradient(145deg,#463b2f,#3a3128);border:1px solid #e6cba516;border-radius:11px 11px 11px 3px;padding:6px 9px;box-shadow:0 2px 4px #0002;}.message small{font-size:9px;color:#d4bb94;}.message p{font-size:11px;line-height:1.5;margin:1px 0 0;}.message-avatar{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:#715e43;color:#f8dfba;font-size:8px;flex-shrink:0;}.message.mine{align-self:flex-end;flex-direction:row-reverse;}.message.mine>div{background:linear-gradient(145deg,#704a34,#513929);border-radius:11px 11px 3px 11px;border-color:#eec09d24;}.message.mine .message-avatar{background:#934d38;}
  .inline-composer{display:flex;align-items:center;flex-shrink:0;min-height:38px;border:1px solid #c3a47429;background:#17151299;border-radius:10px;box-shadow:inset 0 2px 5px #0002;margin:3px 0 5px;}.inline-composer input{min-height:0;min-width:0;width:100%;height:36px;background:none;border:0;color:#f4e4cc;font-size:12px;font-family:inherit;outline-offset:-2px;padding:0 4px;}.inline-composer input::placeholder{color:#a49278;}.inline-composer button{width:38px;min-width:38px;height:38px;border:0;background:none;display:grid;place-items:center;color:#d1b88f;}
  nav{display:grid;grid-template-columns:repeat(4,1fr);height:44px;flex-shrink:0;border-top:1px solid #d6b8891c;padding-top:2px;gap:3px;margin:0 5px;}nav button{background:linear-gradient(#ffffff05,transparent);border:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:7px;font-size:9px;color:#c9bba7;}nav button:hover{background:#ffffff09;}nav :global(svg){width:17px;height:17px;}nav .resign{color:#c89a83;}.action-icon{position:relative;display:flex;}.badge{display:none;}.watching nav{grid-template-columns:1fr 62px 90px;}.spectating-label{display:flex;align-items:center;gap:5px;font-size:10px;color:#cebb96;}
  .spectator-anchor{position:relative;z-index:8;}.watchers{display:flex;align-items:center;justify-content:center;gap:5px;min-width:44px;min-height:28px;border:0;border-radius:7px;background:#cfac7620;color:#d9bd91;font-size:10px;}.watchers[aria-expanded=true]{background:#cfac7640;}.spectator-popover{position:absolute;bottom:calc(100% + 9px);right:0;width:238px;padding:12px;border:1px solid #d6b68255;border-radius:14px;background:linear-gradient(145deg,#46392b,#28231c);box-shadow:0 8px 32px #0008;z-index:10;}.spectator-popover:after{content:'';position:absolute;right:16px;bottom:-5px;width:8px;height:8px;background:#30281f;border-right:1px solid #d6b68255;border-bottom:1px solid #d6b68255;transform:rotate(45deg);}.spectator-title{display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:5px;}.spectator-title>button{width:28px;height:28px;display:grid;place-items:center;border:0;background:none;color:#bfa984;}.spectator-person{display:flex;align-items:center;gap:8px;width:100%;text-align:left;min-height:44px;padding:4px 0;background:none;border:0;font-size:12px;}.spectator-person small{display:block;font-size:9px;color:#aa977b;margin-top:2px;}.spectator-avatar{display:grid;place-items:center;width:29px;height:29px;border-radius:50%;background:linear-gradient(140deg,#83815c,#4e5140);font-size:10px;color:#eee4c0;}.spectator-person>i{width:5px;height:5px;background:#adbf8a;border-radius:50%;margin-left:auto;}.spectator-preview{border-top:1px solid #ffffff12;margin-top:8px;padding-top:9px;}.spectator-preview label{font-size:10px;color:#c6b08a;}.spectator-preview select{background:#211d16;border:1px solid #ffffff20;border-radius:5px;color:#e9d5ad;font:inherit;padding:3px;}.spectator-preview>div{display:flex;gap:5px;margin-top:8px;}.spectator-preview>div>button{height:42px;flex:1;font-size:23px;border:1px solid #ffffff12;background:#d3af7720;border-radius:8px;}.spectator-preview>small{font-size:9px;color:#a48e6f;display:block;margin-top:7px;}.spectator-floats{position:absolute;bottom:15px;left:50%;width:0;height:0;pointer-events:none;z-index:12;}.spectator-floats>span{position:absolute;left:0;bottom:0;display:flex;flex-direction:column;align-items:center;animation:spectator-rise 2s ease-out forwards;filter:drop-shadow(0 3px 6px #0007);}.spectator-floats b{font-weight:400;font-size:28px;line-height:1.1;}.spectator-floats small{font-size:8px;color:#f6e6c4;background:#241d14b0;border-radius:4px;padding:1px 3px;}.spectator-floats>span.still{animation:spectator-fade 1.5s ease-out forwards;transform:translate(-50%,-22px);}
  .header-tools{display:flex;align-items:center;gap:7px;}.header-tools .icon-button{width:36px;height:36px;}.match-label{font-size:11px;color:#d2bfa3;}
  header{border-bottom:0;height:40px;min-height:40px;}.spectator-anchor .watchers{background:transparent;color:#b9a78a;min-height:36px;}.spectator-popover{bottom:auto;top:calc(100% + 7px);right:0;}.spectator-popover:after{bottom:auto;top:-5px;transform:rotate(225deg);}.spectator-floats b{font-size:22px;}.spectator-floats small{display:none;}
  .table-chat{margin:5px 9px 0;padding-top:0;min-height:88px;}.conversation-link{display:flex;align-items:center;gap:3px;align-self:flex-start;background:none;border:0;font-size:9px;letter-spacing:.4px;color:#ad9c82;padding:0;min-height:25px;}.conversation{gap:8px;padding-bottom:10px;}.message{max-width:88%;}.message>div{padding:7px 10px;box-shadow:none;background:#bca47b12;border-color:transparent;}.message.mine>div{background:#c67c4622;border-color:#cda17e0d;}.message small{font-size:8px;opacity:.7;}.message p{font-size:11px;}
  .inline-composer{border-radius:22px;background:#16131080;border-color:#c3a47420;min-height:42px;box-shadow:none;}.inline-composer input{height:40px;}.inline-composer button{height:40px;width:40px;min-width:40px;}
  .player{padding:0 9px;height:50px;}.self{height:54px;}.history{margin:0 8px;padding:0;gap:8px;background:transparent;border-top:0;border-bottom:1px solid #dbc29a12;}.move-strip>button{border-color:transparent;background:transparent;padding:6px 8px;}.move-strip>button.latest{border-color:#c5a36b35;background:#c5a36b0c;}.history-heading{opacity:.7;}
  nav{grid-template-columns:94px 1fr 70px;border-top:0;height:44px;margin:0 9px;gap:6px;}nav button{flex-direction:row;background:transparent;gap:5px;font-size:10px;}.table-note{display:flex;align-items:center;justify-content:center;font-size:8px;color:#97846a;}.watching nav{grid-template-columns:1fr 100px;}
  @keyframes spectator-rise{0%{opacity:0;transform:translate(-50%,0) scale(.5) rotate(-8deg);}12%{opacity:1;}65%{opacity:.9;}100%{opacity:0;transform:translate(calc(-50% - 42px + var(--drift)),-27px) scale(1.1) rotate(12deg);}}@keyframes spectator-fade{0%,75%{opacity:1;}100%{opacity:0;}}
  .move-feedback{position:absolute;width:0;height:0;pointer-events:none;z-index:3;}.ripple{position:absolute;width:calc(var(--phone-width,390px) / 11);height:calc(var(--phone-width,390px) / 11);max-width:44px;max-height:44px;left:0;top:0;border-radius:50%;border:2px solid var(--feedback);transform:translate(-50%,-50%);animation:ripple 850ms ease-out both;box-shadow:0 0 10px color-mix(in srgb,var(--feedback) 30%,transparent);}.rating-bubble{position:absolute;bottom:23px;left:0;display:flex;align-items:center;gap:4px;white-space:nowrap;background:var(--feedback);color:#20241d;font-size:10px;font-weight:600;padding:4px 7px;border-radius:6px;box-shadow:0 3px 10px #0004;transform:translateX(-50%);animation:badge-in 180ms ease-out both;}.rating-bubble.below{bottom:auto;top:24px;}.no-motion .ripple,.no-motion .rating-bubble{animation:none;}.no-motion .ripple{opacity:.6;}.reaction-bubble{position:absolute;top:12px;left:12px;background:#20281feF;border:1px solid #bacaac44;padding:10px;border-radius:12px;display:flex;align-items:center;gap:7px;font-size:12px;color:#e3d2ae;box-shadow:0 5px 20px #0005;pointer-events:none;}.toast{position:absolute;left:12px;right:12px;bottom:145px;background:#e0d4b7;color:#292d23;padding:12px;border-radius:10px;text-align:center;font-size:12px;z-index:6;}
  .sheet{position:fixed;inset:auto 0 0;margin:0 auto;border:1px solid #ffffff12;border-bottom:0;border-radius:22px 22px 0 0;padding:0 18px max(18px,env(safe-area-inset-bottom));background:#252922;color:#eeeee5;width:min(100%,480px);max-width:100%;max-height:82dvh;overflow:hidden;box-shadow:0 -16px 80px #0006;}.sheet[open]{display:flex;flex-direction:column;animation:sheet-up 220ms cubic-bezier(.2,.75,.2,1);}.sheet::backdrop{background:#080c098c;backdrop-filter:blur(2px);}.sheet-grab{height:21px;min-height:21px;display:grid;place-items:center;touch-action:none;}.sheet-grab span{width:34px;height:3px;background:#717762;border-radius:2px;}.sheet-heading{display:flex;justify-content:space-between;align-items:center;min-height:46px;flex-shrink:0;}.sheet-heading h2{font-size:18px;font-weight:600;}.sheet-content{overflow-y:auto;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;}.eyebrow{font-size:9px;letter-spacing:1.5px;color:#9fa992;padding:10px 0 5px;}.setting{min-height:46px;width:100%;display:flex;align-items:center;justify-content:space-between;border:0;border-bottom:1px solid #ffffff09;background:none;padding:0;font-size:12px;}.setting>span:first-child{display:flex;gap:10px;align-items:center;}.toggle{width:33px;height:20px;background:#484f42;border-radius:15px;padding:3px;}.toggle:before{content:'';display:block;width:14px;height:14px;border-radius:50%;background:#a9b09e;transition:transform 150ms;}.toggle.on{background:#b9c69c;}.toggle.on:before{background:#263221;transform:translateX(13px);}.footnote{font-size:11px;color:#a9b09e;line-height:1.65;margin:10px 0;}.lab-heading{border-top:1px solid #ffffff14;margin-top:15px;padding-top:16px;}.feedback-samples{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;}.feedback-samples button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;font-size:9px;border:1px solid #ffffff14;background:#ffffff04;border-radius:9px;min-height:62px;padding:4px;}.demo-buttons{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px;}.demo-buttons button{min-height:40px;padding:8px 10px;border:1px solid #ffffff1c;border-radius:8px;background:none;font-size:10px;}
  .expanded{margin:16px 0;}.expanded>button{min-height:44px;}.move-detail{display:flex;align-items:center;gap:18px;background:#ffffff04;padding:18px;border-radius:12px;}.move-detail small{font-size:11px;color:#b1b7a7;}.move-detail h3{font-size:26px;margin:3px 0;}.move-detail strong{font-size:13px;}.detail-disc{width:68px;height:68px;border-radius:50%;display:grid;place-items:center;box-shadow:inset 0 0 0 5px #ffffff12,inset 0 0 0 7px #0003,0 5px 8px #0004;}.detail-disc.red{background:#b9493e;color:#efc081;}.detail-disc.black{background:#353c34;color:#bbc4ad;}
  .primary,.danger,.button-row>button{min-height:44px;border-radius:10px;padding:10px 14px;border:1px solid #ffffff1a;font-size:12px;}.primary{background:#bdcaa6;color:#20281b;border:0;}.full{width:100%;margin-top:15px;}.button-row{display:flex;gap:8px;margin:20px 0 6px;}.button-row>button{flex:1;background:#ffffff06;}.button-row>.primary{background:#bdcaa6;color:#20281b;}.button-row>.danger{background:#a64d40;color:#fff2e9;}.sheet-copy{font-size:13px;line-height:1.7;color:#bcc3b0;margin:12px 0;}
  .chat-messages{max-height:32dvh;min-height:140px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:10px 0;}.chat-messages>div{max-width:85%;background:#ffffff06;border-radius:12px;padding:10px 12px;}.chat-messages>div.mine{align-self:flex-end;background:#bfd29d15;}.chat-messages small{font-size:9px;color:#b4c199;}.chat-messages p{font-size:12px;margin-top:4px;}.chat-form{display:flex;gap:5px;margin-top:12px;}.chat-form input{width:100%;min-width:0;min-height:44px;font:inherit;font-size:12px;background:#161c16;border:1px solid #ffffff1a;border-radius:9px;color:#edeee5;padding:10px;}.reaction-picker{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:18px 0;}.reaction-picker button{min-height:95px;border-radius:12px;border:1px solid #ffffff12;background:#ffffff04;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-size:10px;}.reaction-picker button>span{color:#dccb94;}.profile-card{display:flex;align-items:center;gap:14px;padding:16px 0;}.profile-card .avatar{width:58px;height:58px;font-size:18px;}.profile-card h3{font-size:20px;}.profile-card p{font-size:11px;color:#a9b59c;}.profile-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}.profile-stats>div{background:#ffffff05;border-radius:10px;padding:13px;display:flex;flex-direction:column;align-items:center;gap:4px;}.profile-stats strong{font-size:21px;}.profile-stats small{font-size:10px;color:#a8b398;}
  @keyframes ripple{from{opacity:.85;transform:translate(-50%,-50%) scale(.85);}to{opacity:0;transform:translate(-50%,-50%) scale(1.75);}}@keyframes badge-in{from{opacity:0;transform:translate(-50%,5px);}to{opacity:1;transform:translate(-50%,0);}}@keyframes sheet-up{from{transform:translateY(30px);opacity:.6;}to{transform:translateY(0);opacity:1;}}
  @media(min-width:600px){.lab-bar{height:48px;font-size:10px;}.desktop-note{display:inline;}.sizes{display:flex;gap:5px;}.sizes button{border:1px solid #ffffff14;background:transparent;color:#929d87;border-radius:6px;padding:6px 10px;font-size:10px;}.sizes button.chosen{background:#c5d4b117;color:#d9e3cf;}.phone{width:var(--phone-width);height:min(var(--phone-height),calc(100dvh - 72px));border:1px solid #ffffff14;border-radius:19px;margin-top:10px;box-shadow:0 24px 90px #0006;}.sheet{bottom:12px;border-bottom:1px solid #ffffff12;border-radius:22px;}}
  @media(prefers-reduced-motion:reduce){*,.sheet[open]{animation:none!important;transition:none!important;}.spectator-floats>span{transform:translate(-50%,-24px);}}

  /* Space belongs to the board first; secondary surfaces fold into the table drawer. */
  .chat-preview,.more-actions{display:none;}
  .result-heading{flex:none;min-height:74px;display:flex;align-items:center;justify-content:space-between;padding:8px 14px;gap:12px;}
  .result-heading h1{font-size:24px;line-height:1.15;color:#ed9984;margin:0 0 3px;letter-spacing:-.6px;}
  .result-heading h1.victory{color:#edc76f;}.result-heading>div{font-size:10px;line-height:1.3;}.result-heading>div>span{font-size:10px;color:#bca88d;}
  .result-heading p{line-height:1.2;display:flex;flex-direction:column;align-items:flex-end;margin:0;gap:2px;}
  .result-heading p button{background:none;border:0;padding:0;font-size:11px;color:#e2cfb2;}.result-heading p>span{font-size:8px;color:#ac977b;}
  .replay-controls{flex:none;padding:4px 10px;height:66px;}.replay-controls>div{display:flex;gap:4px;height:36px;}
  .replay-controls button{background:#dfc38f09;border:1px solid #dfc38f14;border-radius:7px;display:flex;align-items:center;justify-content:center;min-width:34px;gap:6px;font-size:11px;}
  .replay-controls .replay-toggle{flex:1;color:#ecd1a2;}.replay-controls label{display:flex;align-items:center;gap:9px;height:22px;color:#b5a184;font-size:9px;}
  .replay-controls label>span{min-width:34px;font-variant-numeric:tabular-nums;}.replay-controls input{width:100%;min-width:0;accent-color:#cdb07a;height:14px;}
  .replay-controls label button{border:0;background:none;font-size:9px;padding:0;min-width:32px;}
  .finished nav,.watching nav{grid-template-columns:1fr 1fr;}.finished nav .again{background:linear-gradient(120deg,#be7250,#975538);color:#fff0d6;border:1px solid #edb7882a;font-size:12px;}
  .presence-demo{border:1px solid #ffffff18;border-radius:6px;background:transparent;width:100%;font-size:10px;min-height:34px;margin-top:8px;}
  .departure{position:absolute;bottom:52px;left:10px;right:10px;padding:14px;background:#2b281ff5;border:1px solid #d9bd9133;border-radius:12px;z-index:5;box-shadow:0 5px 20px #0005;}
  .departure strong{font-size:14px;}.departure p{font-size:11px;margin:5px 0;color:#b8a98f;}.departure button{background:#cdb07a;color:#241c14;border:0;border-radius:7px;font-size:11px;padding:8px 12px;}
  .phone[data-layout=compact] header{height:30px;min-height:30px;}.phone[data-layout=focus] header{height:26px;min-height:26px;}
  .phone[data-layout=compact] .player{height:36px;padding:0 10px;}
  .phone[data-layout=compact] .identity,.phone[data-layout=focus] .identity{min-height:32px;gap:7px;}
  .phone[data-layout=compact] .avatar,.phone[data-layout=focus] .avatar{width:27px;height:27px;font-size:9px;}
  .phone[data-layout=compact] .identity strong,.phone[data-layout=focus] .identity strong{font-size:11px;}
  .phone[data-layout=compact] .identity small,.phone[data-layout=focus] .identity small{font-size:9px;}
  .phone[data-layout=compact] .clock,.phone[data-layout=focus] .clock{font-size:14px;}
  .phone[data-layout=compact] .history{height:32px;}
  .phone[data-layout=compact] .table-chat{min-height:34px;margin:0 12px;justify-content:center;}
  .phone[data-layout=compact] .conversation,.phone[data-layout=compact] .inline-composer{display:none;}
  .phone[data-layout=compact] .conversation-link{width:100%;min-height:34px;gap:6px;}
  .phone[data-layout=compact] .chat-preview{display:block;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:left;font-size:9px;letter-spacing:0;color:#d1bfa6;}
  .phone[data-layout=compact] .conversation-link>span{display:none;}
  .phone[data-layout=compact] .result-heading{min-height:50px;padding:4px 12px;}.phone[data-layout=compact] .result-heading h1{font-size:21px;}
  .phone[data-layout=compact] .replay-controls{height:56px;padding:2px 10px;}.phone[data-layout=compact] .replay-controls>div{height:32px;}.phone[data-layout=compact] .replay-controls label{height:20px;}
  .phone[data-layout=focus] .player{height:32px;}.phone[data-layout=focus] .captures{display:none;}
  .phone[data-layout=focus] .history,.phone[data-layout=focus] .table-chat{display:none;}
  .phone[data-layout=focus] nav{margin-top:auto;grid-template-columns:1fr 1fr 44px;}.phone[data-layout=focus] .table-note{display:none;}.phone[data-layout=focus] .more-actions{display:flex;}
  .phone[data-layout=focus] .result-heading{min-height:36px;padding:2px 12px;}.phone[data-layout=focus] .result-heading h1{font-size:17px;margin-bottom:0;}
  .phone[data-layout=focus] .result-heading p{flex-direction:row;gap:4px;align-items:center;}.phone[data-layout=focus] .result-heading>div>span{font-size:9px;}
  .phone[data-layout=focus] .replay-controls{height:40px;padding:2px 8px;}.phone[data-layout=focus] .replay-controls label{display:none;}
  .phone[data-layout=landscape]{display:grid;grid-template-columns:calc(var(--board-size) + 6px + var(--player-rail)) minmax(0,1fr);grid-template-rows:40px 66px minmax(0,1fr) 44px;column-gap:14px;padding:4px 12px 4px 0;}
  .phone[data-layout=landscape] .play-zone{grid-column:1;grid-row:1/-1;display:grid;grid-template-columns:var(--player-rail) auto;grid-template-rows:1fr 1fr;width:fit-content;justify-self:start;align-self:center;}
  .phone[data-layout=landscape] .board-stage{grid-column:2;grid-row:1/-1;aspect-ratio:auto;width:auto;}
  .phone[data-layout=landscape] header{grid-column:2;grid-row:1;height:40px;min-height:40px;}
  .phone[data-layout=landscape] .player{grid-column:1;grid-row:1;height:auto;min-height:0;padding:10px 5px;flex-direction:column;justify-content:center;gap:10px;}
  .phone[data-layout=landscape] .self{grid-row:2;border-radius:0 0 0 14px;}
  .phone[data-layout=landscape] .identity{min-height:44px;min-width:0;max-width:100%;flex-direction:column;text-align:center;gap:7px;}
  .phone[data-layout=landscape] .identity>span:last-child{max-width:100%;}
  .phone[data-layout=landscape] .identity strong{font-size:12px;overflow-wrap:anywhere;}
  .phone[data-layout=landscape] .identity small{flex-wrap:wrap;justify-content:center;gap:4px;font-size:10px;}
  .phone[data-layout=landscape] .captures{width:100%;font-size:8px;}
  .phone[data-layout=landscape] .you{display:block;margin:4px 0 0;font-size:9px;line-height:1.3;}
  .phone[data-layout=landscape] .you.turn-label{display:flex;justify-content:center;}
  .phone[data-layout=landscape] .clock{font-size:15px;gap:3px;}.phone[data-layout=landscape] .clock svg{width:18px;height:18px;}
  .phone[data-layout=landscape] .self.turn-active{box-shadow:inset 2px 0 #d8ba70;}

  .phone[data-layout=landscape] .result-heading{min-height:54px;}
  .phone[data-layout=landscape] .result-heading h1{font-size:20px;}
  .phone[data-layout=landscape] .history,.phone[data-layout=landscape] .replay-controls{grid-column:2;grid-row:2;width:auto;min-width:0;align-self:center;}
  .phone[data-layout=landscape] .table-chat{grid-column:2;grid-row:3;min-height:0;overflow:hidden;}
  .phone[data-layout=landscape] nav{grid-column:2;grid-row:4;}
  /* A finished board uses the full landscape height; the result joins the side column. */
  .phone.finished[data-layout=landscape]{grid-template-rows:36px 64px 66px minmax(0,1fr) 44px;}
  .phone.finished[data-layout=landscape] .play-zone{display:contents;}
  .phone.finished[data-layout=landscape] .board-stage{grid-column:1;grid-row:1/-1;height:100%;width:100%;}
  .phone.finished[data-layout=landscape] header{height:36px;min-height:36px;}
  .phone.finished[data-layout=landscape] .result-heading{grid-column:2;grid-row:2;min-height:0;padding:2px 9px 8px;}
  .phone.finished[data-layout=landscape] .result-heading h1{font-size:25px;}
  .phone.finished[data-layout=landscape] .replay-controls{grid-row:3;}
  .phone.finished[data-layout=landscape] .table-chat{grid-row:4;}
  .phone.finished[data-layout=landscape] nav{grid-row:5;}

  @media (min-width:600px) and (max-height:500px){.lab-bar{height:26px;}.sizes,.desktop-note{display:none;}.phone{width:100%;height:calc(100dvh - 26px);margin:0;border:0;border-radius:0;}}



  .play-zone{position:relative;isolation:isolate;flex:none;display:flex;flex-direction:column;width:100%;border-radius:14px;background:linear-gradient(120deg,#433a2e,#332f27 65%,#3d3428);box-shadow:inset 0 1px #e3c49535,inset 0 -1px #e3c49530,0 6px 12px #0004;}
  .play-zone .player{padding-inline:12px;}.play-zone .self{border-radius:0 0 14px 14px;}
  .history,.replay-controls{position:relative;background:#1c1c19;}
  .phone[data-layout=roomy] .history,.phone[data-layout=roomy] .replay-controls{margin-top:10px;}
  .phone[data-layout=compact] .history,.phone[data-layout=compact] .replay-controls{margin-top:4px;}

  .self{position:relative;isolation:isolate;}
  .self.turn-active{background:#d9b97013;box-shadow:inset 0 -2px #d8ba70;}
  .self.turn-active .avatar{box-shadow:0 0 0 2px #ddc58a,0 0 0 4px #ddc58a18;}
  .self.turn-active .clock{color:#f8dda1;}.self.turn-active .clock .clock-progress{stroke:#f2ce7e;}
  .you.turn-label{display:inline-flex;align-items:center;gap:4px;color:#ffe5ab;font-weight:600;}
  .you.turn-label:before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;flex:none;}
  .self.turn-arrival:before{content:'';position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;background:linear-gradient(105deg,#eed08d55,#d4af631c);box-shadow:inset 0 0 18px #ebc77533;animation:turn-arrival 1.8s ease-out both;}
  @keyframes turn-arrival{0%{opacity:0;}18%{opacity:1;}45%{opacity:.65;}100%{opacity:0;}}

  .phone.immersive[data-layout]{display:grid;grid-template-columns:1fr;grid-template-rows:auto 44px;align-content:center;gap:0;background:#141511;}
  .phone.immersive[data-layout] .play-zone{display:contents;}
  .phone.immersive[data-layout] header,.phone.immersive[data-layout] .player,.phone.immersive[data-layout] .result-heading,.phone.immersive[data-layout] .history,.phone.immersive[data-layout] .replay-controls,.phone.immersive[data-layout] .table-chat,.phone.immersive[data-layout] nav,.phone.immersive[data-layout] .toast,.phone.immersive[data-layout] .departure{display:none;}
  .phone.immersive[data-layout] .board-stage{grid-column:1;grid-row:1;aspect-ratio:auto;width:100%;height:auto;}
  .board-frame.focus-turn{border-color:#f0ce7e;box-shadow:0 0 0 1px #d6b96f55;}
  .board-frame.focus-arrival{animation:focus-handoff 1.8s ease-out both;}
  .focus-hud{grid-column:1;grid-row:2;width:calc(var(--board-size) + 6px);max-width:100%;justify-self:center;display:flex;align-items:center;gap:12px;padding:0 8px;color:#d1c5ab;}
  .focus-status{display:flex;align-items:center;gap:6px;flex:1;min-width:0;font-size:11px;line-height:1.4;}
  .focus-status i{width:5px;height:5px;border-radius:50%;background:#8d8c77;flex:none;}.focus-status.my-turn i{background:#edce86;}
  .focus-clock{display:flex;align-items:center;gap:5px;font-size:15px;font-variant-numeric:tabular-nums;white-space:nowrap;}
  .focus-clock svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.5;}
  .my-turn{color:#efcf87;}
  .exit-focus,.focus-replay{display:grid;place-items:center;width:44px;height:44px;flex:none;border-radius:9px;border:0;background:transparent;color:#d1c5ab;opacity:.75;}
  .exit-focus:hover,.exit-focus:focus-visible,.focus-replay:hover,.focus-replay:focus-visible{opacity:1;background:#e1cfa10b;}
  .phone.immersive[data-layout=landscape]{grid-template-columns:calc(var(--board-size) + 6px) minmax(84px,1fr);grid-template-rows:1fr;align-content:stretch;padding:4px 8px;}
  .phone.immersive[data-layout=landscape] .board-stage{align-self:center;}
  .phone.immersive[data-layout=landscape] .focus-hud{grid-column:2;grid-row:1;align-self:center;width:100%;flex-direction:column;gap:18px;text-align:center;}
  .phone.immersive[data-layout=landscape] .focus-status{flex:none;justify-content:center;flex-wrap:wrap;}
  @keyframes focus-handoff{0%,100%{box-shadow:0 0 0 1px #d6b96f55;}20%{box-shadow:0 0 0 2px #f0ce7e,0 0 20px #f0ce7e60;}}
</style>

