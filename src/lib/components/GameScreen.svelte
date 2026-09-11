<script>
  import PlayerLink from './PlayerLink.svelte';
  import { browseTo } from '$lib/stores/navigation.js';
  import { onMount, onDestroy } from 'svelte';
  import { gameState, roomUnreadChat, roomUnreadMentions } from '$lib/stores/app.js';
  import { session, sendCommand, serverNow } from '$lib/stores/session.js';
  import { user, captureSession, isCurrentSession } from '$lib/stores/user.js';
  import { getSocket } from '$lib/socket.js';
  import { api } from '$lib/api.js';
  import { EmoteClient } from '$lib/emoteClient.js';
  import { describeHistory } from '../../../shared/gameHistory.js';
  import { revealView } from '$lib/colorReveal.js';
  import GameBoard from './GameBoard.svelte';
  import BoardAppearance from './BoardAppearance.svelte';
  import ColorReveal from './ColorReveal.svelte';
  import GameResult from './GameResult.svelte';
  import { appearance } from '$lib/stores/appearance.js';
  import RoomChat from './chat/RoomChat.svelte';
  import Modal from './Modal.svelte';
  export let noticeInset = 0;

  // The screen is a view of the session. Only presentation state is writable here.
  $: game = $gameState.state;
  $: gameId = game.gameId;
  $: myColor = $gameState.myColor;
  $: opponentName = $gameState.opponentName;
  $: opponentDisconnected = $gameState.opponentOnline === false && !game.gameOver;
  $: reconnectSeconds = game.opponentReconnectDeadline == null ? null : Math.max(0, Math.ceil((game.opponentReconnectDeadline - $serverNow) / 1000));
  $: currentPlayer = game.currentPlayer;
  $: topColor = myColor === 'red' ? 'black' : 'red';
  $: topTime = topColor === 'red' ? game.redTime : game.blackTime;
  $: bottomTime = myColor === 'red' ? game.redTime : game.blackTime;
  // Colour reveal: the server assigned colours but holds the clock until both players are done.
  $: reveal = revealView(game, $user?.id);
  let revealFailed = false;
  $: restart = game.recovery;
  $: restartReady = restart?.readyUserIds?.includes($user?.id);
  $: restartSeconds = restart ? Math.max(0, Math.ceil((restart.deadline - $serverNow) / 1000)) : null;
  $: isMyTurn = !restart && game.started && currentPlayer === myColor && !game.gameOver;
  $: canAct = $session.status === 'ready' && !$session.pending;
  $: urgency = game.turnTime && isMyTurn && bottomTime < 10 ? (10-bottomTime)/10 : 0;
  $: statusText = reveal.active ? 'Choosing colours…' : $session.pending === 'game:move' ? 'Confirming move…' : isMyTurn ? 'Your turn' : "Opponent's turn";
  $: drawOfferPending = game.pendingDrawOffer === $user?.id;
  $: drawOfferReceived = !restart && game.pendingDrawOffer != null && !drawOfferPending && !game.gameOver;
  $: drawOfferCooldown = (game.drawOfferAvailableAt || 0) > ($serverNow || 0);
  $: againstBot = game.opponentIsBot;
  $: spectatorCount = game.spectatorCount || 0;
  let capturedPieces = { red: [], black: [] }, moveLog = [];
  $: ({ capturedPieces, moveLog } = describeHistory(game.moveHistory));
  const mode = 'online';
  let showResignConfirm = false;
  let chatPreference = null;
  let activeEmote = null, emoteTimer, socket, emoteView;
  const emotes = new EmoteClient({
    readScope: () => ({ ...captureSession(), gameId, connectionId: socket?.id }),
    isCurrent: scope => isCurrentSession(scope) && scope.gameId === gameId && scope.connectionId === socket?.id,
    canSend: () => $session.status === 'ready' && game.started && !game.gameOver && !restart,
    load: ({ scope, signal }) => api.get('/shop/emotes', { authToken: scope.token, signal }),
    send: (itemId, scope) => socket.timeout(5000).emitWithAck('emote:send', { gameId: scope.gameId, itemId }),
    publish: value => { emoteView = value; }
  });
  $: ownedEmotes = emoteView.emotes;
  $: emotesDisabled = emoteView.sending || $session.status !== 'ready' || !game.started || game.gameOver || !!restart;
  $: if (game.gameOver || $session.status !== 'ready') { activeEmote = null; clearTimeout(emoteTimer); }
  // A terminal snapshot invalidates the resignation dialog immediately.
  $: if ((game.gameOver || drawOfferReceived || $session.status !== 'ready') && showResignConfirm) showResignConfirm = false;

  // Finish the last live animation before handing off to the shared replay view.
  let resultVisible = false;
  $: resultState = !!game.gameOver && resultVisible;
  let viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
  $: chatOpen = (chatPreference ?? (viewportWidth >= 1100 && !resultState)) && (!resultState || !againstBot);
  function onResize() { viewportWidth = window.innerWidth; }

  async function move({ detail }) {
    await sendCommand('game:move', { gameId, expectedPly: game.moveHistory.length, ...detail });
  }
  async function revealDone() {
    revealFailed = false;
    const result = await sendCommand('game:reveal-done', { gameId });
    const now = revealView(game, $user?.id);
    if (!result.ok && now.active && !now.acked) revealFailed = true;
  }
  function resign() { showResignConfirm = false; sendCommand('game:resign', { gameId }); }
  function resumeGame() { sendCommand('game:recovery-ready', { gameId, generation: restart.generation }); }
  function offerDraw() { sendCommand('game:draw-offer', { gameId }); }
  function respondDraw(accepted) { sendCommand('game:draw-response', { gameId, accepted }); }
  function toggleChat() { chatPreference = !chatOpen; }
  function fmtTime(seconds) { if (!game.turnTime) return '∞'; const n = Math.ceil(seconds); return Math.floor(n/60) + ':' + String(n%60).padStart(2, '0'); }
  function onEmote(data) {
    if (data?.gameId !== gameId || $session.status !== 'ready' || game.gameOver || !data.emote?.emoji) return;
    activeEmote = { ...data.emote, username: data.username };
    clearTimeout(emoteTimer); emoteTimer = setTimeout(() => activeEmote = null, 2500);
  }
  function sendEmote(emote) { void emotes.sendItem(emote.id); }
  onMount(() => {
    window.addEventListener('resize', onResize);
    socket = getSocket(); socket?.on('emote:show', onEmote);
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
      unsubscribe(); emotes.dispose(); window.removeEventListener('focus', focus);
      socket?.off('connect', reconnect); socket?.off('disconnect', disconnect);
    };
  });
  onDestroy(() => { window.removeEventListener('resize', onResize); socket?.off('emote:show', onEmote); clearTimeout(emoteTimer); });
</script>

{#if reveal.active}
  <!-- Nothing that betrays the colour (board orientation, player bars) is shown until the wheel has landed and the game starts. -->
  {#key gameId}
    <div class="page-center">
      <ColorReveal color={myColor} {opponentName} acked={reveal.acked} waiting={reveal.waiting} failed={revealFailed} on:done={revealDone} />
    </div>
  {/key}
{:else}
<div class="game-layout" class:result={resultState} style="--notice-inset: {noticeInset}px">
  {#if !resultState}
    {#if spectatorCount > 0}
      <div class="spectator-badge">{spectatorCount} watching</div>
    {/if}
    <!-- Top: opponent -->
    <div class="player-bar opponent">
      <div class="pinfo" class:active={currentPlayer === topColor}>
        <div class="dot {topColor}"></div>
        <span class="pname"><PlayerLink username={opponentName} /></span>
        <span class="timer" class:low={topTime<=15} class:critical={topTime<=7}>{fmtTime(topTime)}</span>
        <div class="tbar-track"><div class="tbar-fill" class:low={topTime<=15} class:critical={topTime<=7} style="width:{game.turnTime ? Math.min(100, topTime/game.turnTime*100) : 100}%"></div></div>
      </div>
      <div class="captured">
        {#each capturedPieces[topColor]||[] as cap}<div class="cap {cap.color}"></div>{/each}
      </div>
    </div>
  {/if}

  {#if !resultState}
  <div class="board-area">
    <div class="board-wrap" class:urgent={urgency > 0} style="--urgency: {urgency}">
      <GameBoard snapshot={game} recovery={$session.recovery} connected={$session.status === 'ready'} {myColor}
        interactive={canAct && isMyTurn} bind:resultVisible on:move={move} />
      <BoardAppearance />
    </div>
  </div>
  {/if}

  {#if !resultState}
    <!-- Bottom: self -->
    <div class="player-bar self">
      <div class="captured">
        {#each capturedPieces[myColor]||[] as cap}<div class="cap {cap.color}"></div>{/each}
      </div>
      <div class="pinfo" class:active={currentPlayer === myColor}>
        <div class="tbar-track"><div class="tbar-fill" class:low={bottomTime<=15} class:critical={bottomTime<=7} style="width:{game.turnTime ? Math.min(100, bottomTime/game.turnTime*100) : 100}%"></div></div>
        <div class="dot {myColor}"></div>
        <span class="pname"><PlayerLink username={$user?.username} profilePublic={$user?.profilePublic} /></span>
        <span class="timer" class:low={bottomTime<=15} class:critical={bottomTime<=7}>{fmtTime(bottomTime)}</span>
      </div>
    </div>

    {#if restart}
      <div class="disconnect-banner" role="status">
        Game restored after a server restart. Clocks are paused.
        {restartReady ? 'Waiting for your opponent to resume.' : 'Resume when you are ready.'}
        {restartSeconds > 0 ? `${restartSeconds}s remaining.` : 'Confirming recovery…'}
        {#if !restartReady && restartSeconds > 0}
          <button class="btn btn-primary btn-small" on:click={resumeGame} disabled={!canAct}>Resume game</button>
        {/if}
      </div>
    {:else if opponentDisconnected}
      <div class="disconnect-banner" role="status">Opponent disconnected. {reconnectSeconds === null ? 'Waiting for them to reconnect…' : reconnectSeconds > 0 ? `${reconnectSeconds}s left to reconnect.` : 'Confirming the game result…'}</div>
    {:else}
      <div class="status">{game.gameOver ? 'Game over' : statusText}</div>
    {/if}

    <div class="actions">
      {#if !game.gameOver}
        <button class="btn btn-dark btn-small" on:click={()=>showResignConfirm=true} disabled={!canAct || !!restart}>Resign</button>
        {#if !againstBot}
          <button class="btn btn-dark btn-small" on:click={offerDraw} disabled={!canAct || !!restart || !game.started || drawOfferPending || drawOfferCooldown}>
            {$session.pending === 'game:draw-offer' ? 'Offering…' : drawOfferPending ? 'Draw offered' : 'Draw'}
          </button>
        {/if}
      {/if}
      <button class="btn btn-dark btn-small chat-toggle" class:mobile-only={chatOpen} on:click={toggleChat}>
        Chat
        {#if $roomUnreadMentions > 0 && !chatOpen}
          <span class="mention-badge">@{$roomUnreadMentions > 9 ? '9+' : $roomUnreadMentions}</span>
        {:else if $roomUnreadChat > 0 && !chatOpen}
          <span class="unread-badge">{$roomUnreadChat > 9 ? '9+' : $roomUnreadChat}</span>
        {/if}
      </button>
      {#if ownedEmotes.length > 0}
        {#each ownedEmotes as e}<button class="emote-btn" disabled={emotesDisabled} on:click={()=>sendEmote(e)} title={e.name} aria-label={e.name}>{e.emoji}</button>{/each}
      {/if}
    </div>

    {#if emoteView.readError || emoteView.error}
      <div class="emote-feedback" role="status">
        <span>{emoteView.error || emoteView.readError}</span>
        {#if emoteView.readError}<button class="btn btn-dark btn-small" disabled={emoteView.status === 'loading'} on:click={() => emotes.refresh()}>Refresh emotes</button>{/if}
      </div>
    {:else if emoteView.status === 'loading' && ownedEmotes.length === 0}
      <p class="emote-feedback" role="status">Loading emotes…</p>
    {/if}

    <div class="moves">
      {#each moveLog.slice(-10) as m}
        <div class="move-pill"><span class="mdot {m.color}"></span><span class="mtxt">{m.notation}</span></div>
      {/each}
    </div>
  {:else}
    <div class="result-holder">
      <GameResult onchat={toggleChat} {chatOpen} unread={$roomUnreadChat} skin={$appearance.data?.skin?.palette} />
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

  {#if activeEmote}
    <div class="emote-bubble"><span class="emote-emoji">{activeEmote.emoji}</span><span class="emote-who"><PlayerLink username={activeEmote.username} /></span></div>
  {/if}

  <!-- Desktop chat panel; mobile chat is toggled from the action row. -->
  <div class="left-panel" class:chat-open={chatOpen}>
    {#if chatOpen}
      <div class="game-chat card">
        <RoomChat channelId={gameId ? `game:${gameId}` : null} closeable={true} on:close={() => { chatPreference = false; }} />
      </div>
    {/if}
  </div>

</div>
{/if}

<style>
  .emote-feedback { font-size: var(--fs-caption); color: var(--text-dim); display: flex; gap: var(--sp-sm); align-items: center; flex-wrap: wrap; }
  .game-layout {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: var(--sp-sm); padding-top: max(var(--sp-sm), env(safe-area-inset-top));
    padding-bottom: max(var(--sp-sm), env(safe-area-inset-bottom));
    gap: var(--sp-xs); background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg) 30%);
  }

  .player-bar { width: 100%; max-width: 640px; display: flex; flex-direction: column; }
  .pinfo {
    display: flex; align-items: center; gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md); padding-bottom: var(--sp-xs);
    border-radius: var(--radius-md); background: var(--surface);
    border: 1px solid var(--surface2);
    transition: border-color 0.3s, box-shadow 0.3s;
    flex-wrap: wrap;
    overflow: hidden;
  }
  .pinfo.active { border-color: var(--accent); box-shadow: 0 0 12px rgba(239,68,68,0.15); }
  .dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
  .dot.red { background: var(--red-piece); }
  .dot.black { background: var(--black-piece); border: 2px solid #555; }
  .pname { font-weight: 600; font-size: var(--fs-caption); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .timer { font-family: var(--font-mono); font-size: var(--fs-caption); color: var(--text-dim); margin-left: auto; flex-shrink: 0; }
  .timer.low { color: var(--warning); font-weight: 700; }
  .timer.critical { color: var(--accent); animation: timerPulse 0.5s ease-in-out infinite; }

  .tbar-track { width: 100%; height: 3px; background: var(--surface2); border-radius: 2px; overflow: hidden; margin-top: var(--sp-xs); }
  .tbar-fill { height: 100%; background: var(--accent2); border-radius: 2px; transition: width 1s linear; }
  .tbar-fill.low { background: var(--warning); }
  .tbar-fill.critical { background: var(--accent); }

  .captured { display: flex; gap: 2px; min-height: 14px; padding: 2px; flex-wrap: wrap; }
  .cap { width: 10px; height: 10px; border-radius: 50%; animation: capPop 0.3s ease-out; }
  .cap.red { background: var(--red-piece); }
  .cap.black { background: var(--black-piece); border: 1px solid #555; }

  .board-area { display: flex; align-items: center; justify-content: center; width: 100%; }
  .board-wrap { position: relative; touch-action: none; border-radius: var(--radius-md); }
  .board-wrap.urgent {
    box-shadow: inset 0 0 calc(20px + 30px * var(--urgency)) rgba(239, 68, 68, calc(0.15 + 0.35 * var(--urgency)));
    animation: urgentPulse 1s ease-in-out infinite;
  }
  @keyframes urgentPulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(calc(1 - 0.08 * var(--urgency))); }
  }

  .result-holder {
    width: 100%; min-width: 0;
    display: flex; justify-content: center;
    animation: sheet-in 0.18s ease-out;
  }
  @keyframes sheet-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .status { font-size: var(--fs-caption); color: var(--text-dim); height: 18px; }
  .spectator-badge {
    position: fixed; top: var(--sp-sm); right: var(--sp-sm);
    padding: 4px 10px; border-radius: var(--radius-pill);
    background: var(--surface); border: 1px solid var(--surface2);
    color: var(--text-dim); font-size: 0.65rem; font-weight: 600;
    z-index: 10;
  }
  .disconnect-banner {
    display: flex; align-items: center; gap: var(--sp-xs);
    padding: var(--sp-xs) var(--sp-md);
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid var(--warning);
    border-radius: var(--radius-sm);
    color: var(--warning);
    font-size: var(--fs-caption);
    font-weight: 500;
    animation: pulse-border 2s ease-in-out infinite;
  }
  @keyframes pulse-border { 0%,100%{border-color:var(--warning);} 50%{border-color:transparent;} }
  .actions { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; max-width: 640px; }
  .chat-toggle { position: relative; }
  .unread-badge, .mention-badge {
    position: absolute; top: -6px; right: -6px;
    min-width: 16px; height: 16px;
    font-size: 0.55rem; font-weight: 700;
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    padding: 0 4px; line-height: 1; color: #fff;
  }
  .unread-badge { background: var(--surface2); color: var(--text-dim); }
  .mention-badge { background: var(--accent2); }

  .moves { display: flex; gap: var(--sp-xs); overflow-x: auto; width: 100%; max-width: 640px; scrollbar-width: none; min-height: 18px; }
  .moves::-webkit-scrollbar { display: none; }
  .move-pill { display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: var(--surface); border-radius: var(--radius-pill); font-size: 0.65rem; white-space: nowrap; flex-shrink: 0; }
  .mdot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .mdot.red { background: var(--red-piece); }
  .mdot.black { background: var(--black-piece); }
  .mtxt { color: var(--text-dim); font-family: var(--font-mono); }

  .confirm { text-align: center; display: flex; flex-direction: column; gap: var(--sp-md); padding: var(--sp-lg); }
  .confirm-btns { display: flex; gap: var(--sp-sm); justify-content: center; }

  .emote-bubble { position: fixed; top: 20%; left: 50%; transform: translateX(-50%); background: var(--surface); border: 2px solid var(--accent); border-radius: var(--radius-lg); padding: var(--sp-sm) var(--sp-md); display: flex; flex-direction: column; align-items: center; gap: var(--sp-xs); z-index: 30; animation: emoteFloat 2.5s ease-out forwards; pointer-events: none; }
  .emote-emoji { font-size: 2.5rem; }
  .emote-who { font-size: 0.6rem; color: var(--text-dim); }
  .emote-who :global(a) { pointer-events: auto; }
  @keyframes emoteFloat { 0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(0.5);} 15%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.1);} 25%{transform:translateX(-50%) translateY(0) scale(1);} 80%{opacity:1;} 100%{opacity:0;transform:translateX(-50%) translateY(-30px);} }

  .left-panel { display: contents; } /* On mobile, children flow into the main flex */
  .mobile-only { display: inline-flex; }


  .game-chat {
    width: 100%; max-width: 640px; height: 200px; padding: 0; overflow: hidden;
    position: fixed; bottom: 0; left: 0; right: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    z-index: 15;
  }
  .emote-btn { flex: 0 0 44px; width: 44px; height: 44px; border-radius: var(--radius-sm); background: var(--surface2); border: none; cursor: pointer; font-size: 1.4rem; transition: transform 0.1s; }
  .emote-btn:hover:not(:disabled) { transform: scale(1.15); }

  @media (prefers-reduced-motion: reduce) {
    .result-holder, .cap, .board-wrap.urgent, .disconnect-banner, .timer.critical, .emote-bubble { animation: none; }
    .tbar-fill, .pinfo, .emote-btn { transition: none; }
  }

  /* ---- Desktop 3-column ---- */
  /* Left: chat | Center: board and controls | Right: moves or the result sheet */
  @media (min-width: 1100px) {
    .mobile-only { display: none !important; }
    .left-panel {
      display: flex !important; flex-direction: column; gap: var(--sp-sm);
      grid-column: 1; grid-row: 1 / 6;
      align-self: center;
      width: 100%;
    }
    .game-chat {
      position: static; height: 360px; max-width: none; width: 100%;
      border-radius: var(--radius-lg);
    }

    .game-layout {
      display: grid;
      grid-template-columns: var(--side-panel) auto var(--side-panel);
      grid-template-rows: auto auto auto auto auto;
      align-content: center;
      justify-content: center;
      gap: var(--sp-xs) var(--sp-xl);
      padding: var(--sp-lg);
    }

    .player-bar { max-width: none; grid-column: 2; }
    .player-bar.opponent { grid-row: 1; }
    .board-area { grid-column: 2; grid-row: 2; justify-self: center; }
    .player-bar.self { grid-column: 2; grid-row: 3; }
    .status { grid-column: 2; grid-row: 4; text-align: center; }
    .disconnect-banner { grid-column: 2; grid-row: 4; }
    .actions { grid-column: 2; grid-row: 5; justify-self: center; }
    .emote-feedback { grid-column: 2; grid-row: 6; max-width: 640px; justify-self: center; }

    .moves {
      grid-column: 3; grid-row: 1 / 6;
      flex-direction: column; overflow-y: auto; overflow-x: hidden;
      max-height: 400px; max-width: none;
      align-self: center;
      scrollbar-width: thin;
    }
  }

  .game-layout.result {
    display: grid;
    grid-template-columns: minmax(0, 480px);
    grid-template-rows: auto;
    justify-content: center;
    align-content: start;
    align-items: start;
    gap: var(--sp-lg);
    padding: max(var(--sp-md), var(--notice-inset), env(safe-area-inset-top)) var(--sp-md) max(var(--sp-lg), env(safe-area-inset-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .result .result-holder { grid-column: 1; grid-row: 1; }
  .result .left-panel { display: none !important; }
  .result .left-panel.chat-open { display: block !important; grid-column: 1; grid-row: 2; width: 100%; }
  .result .game-chat { position: static; width: 100%; max-width: none; height: 240px; border-radius: var(--radius-lg); }

</style>
