<script>
  import TableLayout from './table/TableLayout.svelte';
  import PlayerSeat from './table/PlayerSeat.svelte';
  import TableSettings from './table/TableSettings.svelte';
  import MoveHistory from './table/MoveHistory.svelte';
  import Icon from './table/TableIcon.svelte';
  import ReplayBoard from './ReplayBoard.svelte';
  import { TurnCue } from '$lib/turnCue.js';
  import { boardPreferences } from '$lib/stores/boardPreferences.js';
  import { play } from '$lib/sounds.js';
  import PlayerLink from './PlayerLink.svelte';
  import { onMount, onDestroy, tick } from 'svelte';
  import { roomUnreadChat, roomUnreadMentions } from '$lib/stores/app.js';
  import { session, sendCommand, serverNow } from '$lib/stores/session.js';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { getSocket } from '$lib/socket.js';
  import { api } from '$lib/api.js';
  import { EmoteClient } from '$lib/emoteClient.js';
  import { describeHistory } from '../../../shared/gameHistory.js';
  import { revealView } from '$lib/colorReveal.js';
  import GameBoard from './GameBoard.svelte';
  import ColorReveal from './ColorReveal.svelte';
  import GameResult from './GameResult.svelte';
  import { appearance } from '$lib/stores/appearance.js';
  import RoomChat from './chat/RoomChat.svelte';
  import Modal from './Modal.svelte';
  export let view;
  export let noticeInset = 0;

  // The screen is a view of the session. Only presentation state is writable here.
  $: game = view.state;
  $: gameId = game.gameId;
  $: spectator = view.mode === 'spectator';
  let spectatorFlip = false;
  $: myColor = spectator ? (spectatorFlip ? 'black' : 'red') : view.myColor;
  $: selfName = spectator ? (myColor === 'red' ? view.spectatorRedName : view.spectatorBlackName) : $user?.username;
  $: opponentName = spectator ? (myColor === 'red' ? view.spectatorBlackName : view.spectatorRedName) : view.opponentName;
  $: opponentDisconnected = view.opponentOnline === false && !game.gameOver;
  $: reconnectSeconds = game.opponentReconnectDeadline == null ? null : Math.max(0, Math.ceil((game.opponentReconnectDeadline - $serverNow) / 1000));
  $: currentPlayer = game.currentPlayer;
  $: topColor = myColor === 'red' ? 'black' : 'red';
  $: topTime = topColor === 'red' ? game.redTime : game.blackTime;
  $: bottomTime = myColor === 'red' ? game.redTime : game.blackTime;
  // Colour reveal: the server assigned colours but holds the clock until both players are done.
  $: reveal = spectator ? {active:false} : revealView(game, $user?.id);
  let revealFailed = false;
  $: restart = game.recovery;
  $: restartReady = restart?.readyUserIds?.includes($user?.id);
  $: restartSeconds = restart ? Math.max(0, Math.ceil((restart.deadline - $serverNow) / 1000)) : null;
  $: isMyTurn = !spectator && !restart && game.started && currentPlayer === myColor && !game.gameOver;
  $: canAct = $session.status === 'ready' && !$session.pending;
  $: statusText = reveal.active ? 'Choosing colours…' : $session.pending === 'game:move' ? 'Confirming move…' : busy ? 'Move in progress…' : isMyTurn ? 'Your turn' : "Opponent's turn";
  $: drawOfferPending = game.pendingDrawOffer === $user?.id;
  $: drawOfferReceived = !spectator && !restart && game.pendingDrawOffer != null && !drawOfferPending && !game.gameOver;
  $: drawOfferCooldown = (game.drawOfferAvailableAt || 0) > ($serverNow || 0);
  $: againstBot = game.opponentIsBot;
  $: spectatorCount = game.spectatorCount || 0;
  let capturedPieces = { red: [], black: [] }, moveLog = [];
  $: ({ capturedPieces, moveLog } = describeHistory(game.moveHistory));
  let sheet = null, focused = false, arrival = false, arrivalTimer, busy = false, settledSnapshot = null;
  let historyView, viewportHeight = null, viewportTop = 0;
  let ratings = {}, ratingPopup = null, ratingTimer;
  const cue = new TurnCue();
  $: if(cue.observe(settledSnapshot, {recovery:$session.recovery, busy, connected:$session.status === 'ready',color:spectator ? null : myColor})) { arrival = true; clearTimeout(arrivalTimer); arrivalTimer = setTimeout(() => arrival = false,1800); }
  $: if(!$boardPreferences.ratings) ratingPopup = null;
  function onAnalysis(data) {
    if(data?.gameId !== gameId || $session.status !== 'ready' || !Number.isInteger(data.ply) || data.ply < 1 || data.ply > game.moveHistory.length || !['best','good','inaccuracy','blunder'].includes(data.rating)) return;
    ratings = {...ratings,[data.ply]:data};
    if($boardPreferences.ratings && data.ply === game.moveHistory.length && !game.gameOver) { ratingPopup = data; clearTimeout(ratingTimer); ratingTimer = setTimeout(() => ratingPopup = null,1800); if(data.rating === 'best') play('king'); }
  }
  function leaveSpectating() { sendCommand('room:leave',{roomId:view.roomId}); }
  let showResignConfirm = false;
  let chatOpen = false;
  let activeEmote = null, emoteTimer, socket, emoteView;
  const emotes = new EmoteClient({
    readScope: () => ({ ...captureSession(), gameId, connectionId: socket?.id }),
    isCurrent: scope => isCurrentSession(scope) && scope.gameId === gameId && scope.connectionId === socket?.id,
    canSend: () => $session.status === 'ready' && game.started && !restart,
    load: ({ scope, signal }) => api.get('/shop/emotes', { authToken: scope.token, signal }),
    send: (itemId, scope) => socket.timeout(5000).emitWithAck('emote:send', { gameId: scope.gameId, itemId }),
    publish: value => { emoteView = value; }
  });
  $: ownedEmotes = emoteView.emotes;
  $: emotesDisabled = emoteView.sending || $session.status !== 'ready' || !game.started || !!restart;
  $: if ($session.status !== 'ready') { activeEmote = null; clearTimeout(emoteTimer); }
  // A terminal snapshot invalidates the resignation dialog immediately.
  $: if ((game.gameOver || drawOfferReceived || $session.status !== 'ready') && showResignConfirm) showResignConfirm = false;

  // Finish the last live animation before handing off to the shared replay view.
  let resultVisible = false, resultState = false, resultStarted = false;
  let mounted = false, disposed = false, resultTransition;
  const openedFinished = !!view.state.gameOver;
  $: if (game.gameOver && resultVisible && !resultStarted) showResult();
  function showResult() {
    resultStarted = true;
    const update = async () => {
      if (disposed) return;
      resultState = true;
      // Let the replay canvas and its measured layout settle before the new capture.
      await tick();
    };
    const animate = mounted && !openedFinished && $boardPreferences.animations
      && document.visibilityState === 'visible'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate && document.startViewTransition) {
      resultTransition = document.startViewTransition(update);
      // A skipped visual transition still runs update; it must never block results.
      resultTransition.finished.catch(() => {});
    } else {
      void update();
    }
  }
  async function move({ detail }) {
    await sendCommand('game:move', { gameId, expectedPly: game.moveHistory.length, ...detail });
  }
  async function revealDone() {
    revealFailed = false;
    const result = await sendCommand('game:reveal-done', { gameId });
    const now = spectator ? {active:false} : revealView(game, $user?.id);
    if (!result.ok && now.active && !now.acked) revealFailed = true;
  }
  function resign() { showResignConfirm = false; sendCommand('game:resign', { gameId }); }
  function resumeGame() { sendCommand('game:recovery-ready', { gameId, generation: restart.generation }); }
  function offerDraw() { sendCommand('game:draw-offer', { gameId }); }
  function respondDraw(accepted) { sendCommand('game:draw-response', { gameId, accepted }); }

  function fmtTime(seconds) { if (!game.turnTime) return '∞'; const n = Math.max(0, Math.ceil(seconds)); return Math.floor(n/60) + ':' + String(n%60).padStart(2, '0'); }
  function onEmote(data) {
    if (data?.gameId !== gameId || $session.status !== 'ready' || !$boardPreferences.reactions || !data.emote?.emoji) return;
    activeEmote = { ...data.emote, username: data.username, spectator: !!data.spectator };
    clearTimeout(emoteTimer); emoteTimer = setTimeout(() => activeEmote = null, 2500);
  }
  function sendEmote(emote) { void emotes.sendItem(emote.id); }
  onMount(() => {
    mounted = true;
    const viewport = window.visualViewport;
    const resizeViewport = () => {
      viewportHeight = !viewport || viewport.scale !== 1 ? window.innerHeight : viewport.height;
      viewportTop = viewport?.scale === 1 ? viewport.offsetTop : 0;
    };
    resizeViewport();
    viewport?.addEventListener('resize', resizeViewport); viewport?.addEventListener('scroll', resizeViewport);
    window.addEventListener('resize', resizeViewport);
    socket = getSocket(); socket?.on('emote:show', onEmote); socket?.on('game:move-analysis', onAnalysis);
    let generation;
    const unsubscribe = user.subscribe(() => {
      const next = captureSession().generation;
      if (generation === next) return;
      generation = next; emotes.reset(); void emotes.refresh();
    });
    const reconnect = () => { emotes.reset(); void emotes.refresh(); };
    const disconnect = () => emotes.reset();
    const focus = () => { if (emoteView.status !== 'loading') void emotes.refresh(); };
    socket?.on('connect', reconnect); socket?.on('disconnect', disconnect);
    window.addEventListener('focus', focus);
    return () => {
      viewport?.removeEventListener('resize', resizeViewport); viewport?.removeEventListener('scroll', resizeViewport); window.removeEventListener('resize', resizeViewport);
      unsubscribe(); emotes.dispose(); window.removeEventListener('focus', focus);
      socket?.off('connect', reconnect); socket?.off('disconnect', disconnect);
    };
  });
  onDestroy(() => { disposed = true; resultTransition?.skipTransition(); socket?.off('emote:show', onEmote); clearTimeout(emoteTimer); clearTimeout(arrivalTimer); clearTimeout(ratingTimer); socket?.off('game:move-analysis',onAnalysis); });
</script>

{#snippet tools()}
  {#if !resultState}<button class="tool history-shortcut" on:click={() => historyView?.show()} aria-label="Open move history"><Icon name="history" size={18}/></button>{/if}
  <div class="watchers"><button class="tool" on:click={() => sheet = 'watchers'} aria-label={`${spectatorCount} spectators`} title={game.spectators?.map(p => p.username).join(', ') || 'Nobody watching'}><Icon name="eye" size={18}/><small>{spectatorCount}</small></button>
    {#if activeEmote?.spectator}<span class="spectator-reaction" aria-label={`${activeEmote.username}: ${activeEmote.name}`}>{activeEmote.emoji}</span>{/if}
  </div>
  <button class="tool" on:click={() => sheet = 'settings'} aria-label="Board settings" title="Board settings"><Icon name="settings" size={19}/></button>
{/snippet}
{#snippet chat(visible)}
  <RoomChat channelId={gameId ? `game:${gameId}` : null} variant="table" {visible}/>
{/snippet}
{#snippet toolbar()}
  <span>{spectator ? 'Spectating · ' : ''}{game.mode === 'RANKED' ? 'Ranked' : 'Friendly'} · {game.turnTime ? `${game.turnTime}s / turn` : 'No clock'}</span>
{/snippet}
{#if reveal.active}
  {#key gameId}<div class="page-center"><ColorReveal color={myColor} {opponentName} acked={reveal.acked} waiting={reveal.waiting} failed={revealFailed} on:done={revealDone}/></div>{/key}
{:else}
<div class="game-screen" style={`--notice-inset:${noticeInset}px`} style:height={viewportHeight ? `${viewportHeight}px` : undefined} style:top={`${viewportTop}px`}>
  {#if resultState}
    <GameResult {view} skin={$appearance.data?.skin?.palette}>
      {#snippet children(summary, actions, data, artwork)}
        {#key gameId}<ReplayBoard gameData={data} skin={$appearance.data?.skin?.palette} perspective={myColor} initialPosition="end" review>
          {#snippet children(board, controls, names, hud)}
            <TableLayout finished hasChat={false} bind:focused>
              <svelte:fragment slot="decoration">{@render artwork()}</svelte:fragment>
              <svelte:fragment slot="toolbar">Game over · Replay</svelte:fragment>
              <svelte:fragment slot="tools">{@render tools()}</svelte:fragment>
              <svelte:fragment slot="board" let:boardSize let:toggleFocus>{@render board(boardSize,toggleFocus)}</svelte:fragment>
              <svelte:fragment slot="summary">{@render summary()}{@render names()}</svelte:fragment>
              <svelte:fragment slot="history">{@render controls()}</svelte:fragment>
              <svelte:fragment slot="actions">{@render actions()}</svelte:fragment>
              <svelte:fragment slot="hud">{@render hud()}</svelte:fragment>
            </TableLayout>
          {/snippet}
        </ReplayBoard>{/key}
      {/snippet}
    </GameResult>
  {:else}
    <TableLayout bind:focused bind:chatOpen {arrival} yourTurn={isMyTurn && !busy} unread={$roomUnreadMentions ? `@${$roomUnreadMentions}` : $roomUnreadChat}>
      <svelte:fragment slot="toolbar">{@render toolbar()}</svelte:fragment>
      <svelte:fragment slot="tools">{@render tools()}</svelte:fragment>
      <svelte:fragment slot="opponent"><PlayerSeat username={opponentName} color={topColor} seconds={topTime} turnTime={game.turnTime} active={!restart && !busy && currentPlayer === topColor} captured={capturedPieces[topColor]?.length}/></svelte:fragment>
      <svelte:fragment slot="self"><PlayerSeat username={selfName} color={myColor} seconds={bottomTime} turnTime={game.turnTime} active={!restart && !busy && currentPlayer === myColor} yours={!spectator} captured={capturedPieces[myColor]?.length} profilePublic={spectator || $user?.profilePublic !== false} {arrival}/></svelte:fragment>
      <svelte:fragment slot="board" let:boardSize let:toggleFocus>
        <GameBoard skin={$appearance.data?.skin?.palette} snapshot={game} recovery={$session.recovery} connected={$session.status === 'ready'} {myColor} flip={myColor === 'black'} interactive={canAct && isMyTurn} maxSize={boardSize} bind:resultVisible bind:busy bind:settledSnapshot on:move={move} on:togglefocus={toggleFocus}/>
        {#if ratingPopup}<div class="rating-popup {ratingPopup.rating}" style:left={`clamp(46px, ${((myColor === 'black' ? 7 - game.moveHistory[ratingPopup.ply-1].toCol : game.moveHistory[ratingPopup.ply-1].toCol) + .5)*12.5}%, calc(100% - 46px))`} style:top={`${((myColor === 'black' ? 7 - game.moveHistory[ratingPopup.ply-1].toRow : game.moveHistory[ratingPopup.ply-1].toRow) + .5)*12.5}%`} role="status"><Icon name={ratingPopup.rating === 'best' ? 'star' : ratingPopup.rating === 'good' ? 'check' : 'question'} size={17}/>{ {best:'Best',good:'Good',inaccuracy:'Inaccuracy',blunder:'Blunder'}[ratingPopup.rating] }</div>{/if}
        {#if activeEmote && !activeEmote.spectator}<div class="player-reaction" aria-label={`${activeEmote.username}: ${activeEmote.name}`}><span>{activeEmote.emoji}</span><small>{activeEmote.username}</small></div>{/if}
      </svelte:fragment>
      <svelte:fragment slot="history"><MoveHistory bind:this={historyView} moves={moveLog} {ratings}/></svelte:fragment>
      <svelte:fragment slot="chat" let:visible>{@render chat(visible)}</svelte:fragment>
      <svelte:fragment slot="actions">
        {#if spectator}<button class="table-action" on:click={() => spectatorFlip = !spectatorFlip}>Flip board</button><button class="table-action" disabled={!canAct} on:click={leaveSpectating}>Leave</button>
        {:else}<button class="table-action" on:click={offerDraw} disabled={!canAct || againstBot || !!restart || !game.started || drawOfferPending || drawOfferCooldown}><Icon name="draw" size={16}/>{$session.pending === 'game:draw-offer' ? 'Offering…' : drawOfferPending ? 'Draw offered' : 'Offer draw'}</button><button class="table-action" on:click={() => showResignConfirm = true} disabled={!canAct || !!restart}><Icon name="flag" size={15}/>Resign</button>{/if}
        <button class="table-action" on:click={() => sheet = 'reactions'} aria-label="Send reaction"><Icon name="smile" size={18}/></button>
      </svelte:fragment>
      <svelte:fragment slot="hud"><span class:your-turn={isMyTurn}>{spectator ? `${currentPlayer === myColor ? selfName : opponentName} to move` : statusText}</span><span class="hud-clock">{fmtTime(currentPlayer === myColor ? bottomTime : topTime)}</span></svelte:fragment>
    </TableLayout>
  {/if}
  {#if !resultState && restart}<div class="recovery" role="status">Game restored. Clocks are paused. {restartReady ? 'Waiting for your opponent.' : 'Resume when ready.'} {restartSeconds > 0 ? `${restartSeconds}s remaining.` : 'Confirming recovery…'}{#if !spectator && !restartReady && restartSeconds > 0}<button class="btn btn-primary btn-small" on:click={resumeGame} disabled={!canAct}>Resume game</button>{/if}</div>
  {:else if !resultState && opponentDisconnected}<div class="recovery" role="status">Opponent disconnected. {reconnectSeconds > 0 ? `${reconnectSeconds}s left to reconnect.` : 'Confirming game state…'}</div>{/if}
</div>
{/if}
  <!-- Decisions remain valid only in their server context. -->
  {#if showResignConfirm && !game.gameOver}
    <Modal label="Resign game" on:close={() => showResignConfirm = false}>
      <div class="card confirm"><p>Resign this game?</p><div class="confirm-btns">
        <button class="btn btn-primary btn-small" disabled={!canAct} on:click={resign}>Resign</button>
        <button class="btn btn-dark btn-small" data-initial-focus on:click={() => showResignConfirm = false}>Cancel</button>
      </div></div>
    </Modal>
  {/if}
  {#if drawOfferReceived && $session.status === 'ready'}
    <Modal label="Draw offer" busy={!canAct} on:close={() => respondDraw(false)}>
      <div class="card confirm"><p><PlayerLink username={opponentName} /> offers a draw</p>
        {#if $session.pending === 'game:draw-response'}<p role="status">Confirming your response…</p>{/if}
        <div class="confirm-btns"><button class="btn btn-primary btn-small" disabled={!canAct} on:click={() => respondDraw(true)}>Accept</button>
          <button class="btn btn-dark btn-small" data-initial-focus disabled={!canAct} on:click={() => respondDraw(false)}>Decline</button></div>
      </div>
    </Modal>
  {/if}


{#if sheet}
  <Modal label={sheet === 'settings' ? 'Board settings' : sheet === 'watchers' ? 'Spectators' : 'Reactions'} on:close={() => sheet = null}>
    <div class="table-sheet"><header><h2>{sheet === 'settings' ? 'Board settings' : sheet === 'watchers' ? 'Watching this game' : 'Send a reaction'}</h2><button class="tool" on:click={() => sheet = null} aria-label="Close"><Icon name="close"/></button></header>
      {#if sheet === 'settings'}<TableSettings/>
      {:else if sheet === 'watchers'}{#each game.spectators || [] as person (person.userId)}<p><PlayerLink username={person.username}/></p>{:else}<p>Nobody is watching yet.</p>{/each}<button class="btn btn-dark" on:click={() => sheet = 'reactions'}>Send a reaction</button>
      {:else}<div class="reactions">{#each ownedEmotes as emote}<button disabled={emotesDisabled} on:click={() => sendEmote(emote)} title={emote.name} aria-label={emote.name}><span>{emote.emoji}</span><small>{emote.name}</small></button>{/each}</div>
        {#if emoteView.status === 'loading'}<p role="status">Loading reactions…</p>{:else if !ownedEmotes.length && !emoteView.readError}<p>No reactions in your collection yet.</p>{/if}
        {#if emoteView.readError || emoteView.error}<p role="status">{emoteView.error || emoteView.readError}</p>{#if emoteView.readError}<button class="btn btn-dark" on:click={() => emotes.refresh()}>Refresh reactions</button>{/if}{/if}
      {/if}
    </div>
  </Modal>
{/if}
<style>
  .history-shortcut{display:none;}:global([data-layout=focus]) .history-shortcut{display:flex;}
  .game-screen{position:fixed;inset:0;background:var(--bg);padding-top:max(var(--notice-inset),env(safe-area-inset-top));padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);}
  .tool{display:flex;align-items:center;justify-content:center;gap:5px;min-width:34px;height:34px;border:0;background:none;color:var(--text-dim);cursor:pointer;}.tool small{font-size:10px;}.watchers{position:relative;}.spectator-reaction{position:absolute;left:50%;top:0;pointer-events:none;font-size:25px;animation:float-away 2.5s ease-out both;}.your-turn{color:var(--gold);}.hud-clock{font-variant-numeric:tabular-nums;}
  .rating-popup{position:absolute;left:50%;top:10%;transform:translateX(-50%);display:flex;align-items:center;gap:5px;background:var(--surface);color:var(--text);border:1px solid var(--surface2);border-radius:8px;padding:8px 10px;line-height:1.3;font-size:12px;pointer-events:none;animation:rating-in 1.8s both;}.rating-popup.best{color:var(--gold);box-shadow:0 0 30px color-mix(in srgb,var(--gold) 35%,transparent);}.rating-popup.good{color:var(--success);}.rating-popup.inaccuracy{color:var(--warning);}.rating-popup.blunder{color:var(--accent);}
  .player-reaction{position:absolute;top:12px;left:12px;display:flex;align-items:center;gap:7px;background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:10px;line-height:1.4;pointer-events:none;}.player-reaction span{font-size:28px;}.player-reaction small{font-size:11px;color:var(--text-dim);}
  .recovery{position:absolute;top:max(42px,var(--notice-inset));left:12px;right:12px;z-index:6;background:var(--surface);border:1px solid var(--warning);color:var(--warning);border-radius:10px;padding:12px;font-size:12px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;}
  .confirm,.table-sheet{padding:20px;display:flex;flex-direction:column;gap:12px;}.confirm-btns{display:flex;gap:8px;justify-content:center;}.table-sheet header{display:flex;justify-content:space-between;align-items:center;gap:8px;}.table-sheet h2{font-size:18px;}.table-sheet p{font-size:12px;color:var(--text-dim);}.reactions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}.reactions button{display:flex;flex-direction:column;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--surface2);border-radius:10px;padding:12px;color:var(--text);cursor:pointer;}.reactions span{font-size:28px;}.reactions small{font-size:10px;}
  @keyframes float-away{0%{opacity:0;transform:translate(-50%,0) scale(.5);}15%{opacity:1;}100%{opacity:0;transform:translate(-80%,-60px) scale(1.1);}}@keyframes rating-in{0%{opacity:0;}15%,75%{opacity:1;}100%{opacity:0;}}@media(prefers-reduced-motion:reduce){.spectator-reaction,.rating-popup{animation:none;}}
</style>
