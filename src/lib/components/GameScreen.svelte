<script>
  import { browseTo } from '$lib/stores/navigation.js';
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { gameState, activeRoom, roomUnreadChat, roomUnreadMentions, browseTab } from '$lib/stores/app.js';
  import { session, sendCommand } from '$lib/stores/session.js';
  import { user } from '$lib/stores/user.js';
  import { getSocket } from '$lib/socket.js';
  import { api } from '$lib/api.js';
  import { describeHistory } from '$lib/gamePresentation.js';
  import GameBoard from './GameBoard.svelte';
  import RoomChat from './chat/RoomChat.svelte';

  // The screen is a view of the session. Only presentation state is writable here.
  $: game = $gameState.state;
  $: gameId = game.gameId;
  $: myColor = $gameState.myColor;
  $: opponentName = $gameState.opponentName;
  $: opponentDisconnected = $gameState.opponentOnline === false && !game.gameOver;
  $: currentPlayer = game.currentPlayer;
  $: topColor = myColor === 'red' ? 'black' : 'red';
  $: topTime = topColor === 'red' ? game.redTime : game.blackTime;
  $: bottomTime = myColor === 'red' ? game.redTime : game.blackTime;
  $: isMyTurn = currentPlayer === myColor && !game.gameOver;
  $: canAct = $session.status === 'ready' && !$session.pending;
  $: urgency = game.turnTime && isMyTurn && bottomTime < 10 ? (10-bottomTime)/10 : 0;
  $: statusText = game.gameOver ? (game.winner === null ? 'Draw' : game.winner === myColor ? 'Victory!' : 'Defeat') : $session.pending === 'game:move' ? 'Confirming move…' : isMyTurn ? 'Your turn' : "Opponent's turn";
  $: gameOverData = game.gameOver ? game.resultData || { winner: game.winner, endReason: game.endReason } : null;
  $: drawOfferPending = game.pendingDrawOffer === $user?.id;
  $: drawOfferReceived = game.pendingDrawOffer != null && !drawOfferPending && !game.gameOver;
  $: drawOfferCooldown = (game.drawOfferAvailableAt || 0) > ($session.snapshot?.serverTime || 0);
  $: spectatorCount = $activeRoom?.spectators?.length || 0;
  let historyLength = -1, capturedPieces = { red: [], black: [] }, moveLog = [];
  $: if (game.moveHistory.length !== historyLength) {
    historyLength = game.moveHistory.length;
    ({ capturedPieces, moveLog } = describeHistory(game.moveHistory));
  }
  const mode = 'online';
  let showResignConfirm = false, showChat = false, showEmoteBar = false;
  let desktopChat = typeof window !== 'undefined' && window.innerWidth >= 1100;
  let ownedEmotes = [], activeEmote = null, emoteTimer, socket;
  function move({ detail }) { sendCommand('game:move', { gameId, expectedPly: game.moveHistory.length, ...detail }); }
  function resign() { showResignConfirm = false; sendCommand('game:resign', { gameId }); }
  function offerDraw() { sendCommand('game:draw-offer', { gameId }); }
  function respondDraw(accepted) { sendCommand('game:draw-response', { gameId, accepted }); }
  async function goToLobby(tab = 'lobby') { const result = await sendCommand('game:leave', { gameId }); if (result.ok) browseTo(tab); }
  function fmtTime(seconds) { if (!game.turnTime) return '∞'; const n = Math.ceil(seconds); return Math.floor(n/60) + ':' + String(n%60).padStart(2, '0'); }
  function onEmote(data) {
    if (!data.emote?.emoji) return;
    activeEmote = { ...data.emote, username: data.username };
    clearTimeout(emoteTimer); emoteTimer = setTimeout(() => activeEmote = null, 2500);
  }
  function sendEmote(emote) { socket?.emit('emote:send', { gameId, emote: { emoji: emote.data.emoji, label: emote.data.label } }); }
  onMount(() => {
    socket = getSocket(); socket?.on('emote:show', onEmote);
    Promise.all([api.get('/shop/inventory'), api.get('/shop/items')]).then(([inventory, shop]) => {
      const items = [...inventory.inventory.map(i => i.item), ...shop.items.filter(i => i.price === 0)];
      ownedEmotes = [...new Map(items.filter(i => i.type === 'EMOTE').map(i => [i.id, i])).values()];
    }).catch(() => {});
  });
  onDestroy(() => { socket?.off('emote:show', onEmote); clearTimeout(emoteTimer); });
</script>

<div class="game-layout">
  {#if spectatorCount > 0}
    <div class="spectator-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      {spectatorCount}
    </div>
  {/if}
  <!-- Top: opponent -->
  <div class="player-bar opponent">
    <div class="pinfo" class:active={currentPlayer === topColor}>
      <div class="dot {topColor}"></div>
      <span class="pname">{opponentName}</span>
      <span class="timer" class:low={topTime<=15} class:critical={topTime<=7}>{fmtTime(topTime)}</span>
      <div class="tbar-track"><div class="tbar-fill" class:low={topTime<=15} class:critical={topTime<=7} style="width:{game.turnTime ? Math.min(100, topTime/game.turnTime*100) : 100}%"></div></div>
    </div>
    <div class="captured">
      {#each capturedPieces[topColor]||[] as cap}<div class="cap {cap.color}"></div>{/each}
    </div>
  </div>

  <!-- Center: board -->
  <div class="board-wrap" class:urgent={urgency > 0} style="--urgency: {urgency}">
    <GameBoard snapshot={game} recovery={$session.recovery} connected={$session.status === 'ready'} {myColor} interactive={canAct && isMyTurn} on:move={move} let:resultVisible let:resultDuration>
    {#if gameOverData && resultVisible}
      {@const endReason = gameOverData.endReason}
      {@const reasonText = endReason === 'resign' ? 'by resignation'
        : endReason === 'timeout' ? 'by timeout'
        : endReason === 'no-moves' ? 'no moves left'
        : endReason === 'draw-agreement' ? 'by agreement'
        : endReason === 'repetition' ? 'by 3-fold repetition'
        : endReason === '25-move' ? 'by 25-move rule'
        : ''}
      {@const myElo = gameOverData.eloChanges?.[myColor] || 0}
      {@const myCoinTotal = gameOverData.coinRewards?.[myColor] || 0}
      {@const myBreakdown = gameOverData.coinBreakdown?.[myColor] || []}
      {@const oppElo = gameOverData.eloDetail?.[myColor]?.opponentElo}
      <div class="game-over" in:fade={{ duration: resultDuration }}>
        {#if gameOverData.winner === null}
          <h2 style="color:var(--text-dim)">Draw</h2>
        {:else}
          <h2 style="color:{game.winner===myColor?'var(--success)':'var(--accent)'}">{game.winner===myColor?'Victory!':'Defeat'}</h2>
        {/if}
        {#if reasonText}<p class="end-reason">{reasonText}</p>{/if}

        <div class="go-breakdown">
          {#if myElo !== 0}
            <div class="go-row">
              <span class="go-label">ELO</span>
              <span class="go-val" class:positive={myElo > 0} class:negative={myElo < 0}>{myElo > 0 ? '+' : ''}{myElo}</span>
            </div>
            {#if oppElo}
              <div class="go-row go-sub"><span class="go-label">vs {oppElo} rated</span></div>
            {/if}
          {/if}
          {#if myBreakdown.length > 0}
            {#each myBreakdown as item}
              <div class="go-row">
                <span class="go-label">{item.label}</span>
                <span class="go-val go-coin">+{item.amount}</span>
              </div>
            {/each}
          {:else if myCoinTotal > 0}
            <div class="go-row">
              <span class="go-label">Coins</span>
              <span class="go-val go-coin">+{myCoinTotal}</span>
            </div>
          {/if}
        </div>

        <button class="btn btn-primary btn-small" on:click={() => goToLobby()}>Lobby</button>
        {#if $user?.isGuest}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <p class="guest-nudge" on:click={() => { goToLobby('profile'); }}>Create an account to keep your ELO and progress</p>
        {/if}
      </div>
    {/if}
    </GameBoard>
  </div>

  <!-- Bottom: self -->
  <div class="player-bar self">
    <div class="captured">
      {#each capturedPieces[myColor]||[] as cap}<div class="cap {cap.color}"></div>{/each}
    </div>
    <div class="pinfo" class:active={currentPlayer === myColor}>
      <div class="tbar-track"><div class="tbar-fill" class:low={bottomTime<=15} class:critical={bottomTime<=7} style="width:{game.turnTime ? Math.min(100, bottomTime/game.turnTime*100) : 100}%"></div></div>
      <div class="dot {myColor}"></div>
      <span class="pname">{$user?.username}</span>
      <span class="timer" class:low={bottomTime<=15} class:critical={bottomTime<=7}>{fmtTime(bottomTime)}</span>
    </div>
  </div>

  {#if opponentDisconnected}
    <div class="disconnect-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Opponent disconnected — waiting 30s for reconnect...
    </div>
  {:else}
    <div class="status">{statusText}</div>
  {/if}

  <div class="actions">
    {#if !game.gameOver && mode !== 'spectator'}
      <button class="btn btn-dark btn-small" on:click={()=>showResignConfirm=true}>Resign</button>
      {#if mode === 'online'}
        <button class="btn btn-dark btn-small" on:click={offerDraw} disabled={!canAct || drawOfferPending || drawOfferCooldown}>
          {drawOfferPending ? 'Draw offered' : 'Draw'}
        </button>
      {/if}
    {/if}
    {#if mode==='online'}
      <button class="btn btn-dark btn-small chat-toggle" class:mobile-only={showChat || desktopChat} on:click={()=>{ showChat=!showChat; desktopChat=!desktopChat; $roomUnreadChat=0; $roomUnreadMentions=0; }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        Chat
        {#if $roomUnreadMentions > 0 && !showChat && !desktopChat}
          <span class="mention-badge">@{$roomUnreadMentions > 9 ? '9+' : $roomUnreadMentions}</span>
        {:else if $roomUnreadChat > 0 && !showChat && !desktopChat}
          <span class="unread-badge">{$roomUnreadChat > 9 ? '9+' : $roomUnreadChat}</span>
        {/if}
      </button>
    {/if}
    {#if ownedEmotes.length > 0}
      {#each ownedEmotes as e}<button class="emote-btn" on:click={()=>sendEmote(e)} title={e.name}>{e.data.emoji}</button>{/each}
    {/if}
  </div>

  <div class="moves">
    {#each moveLog.slice(-10) as m}
      <div class="move-pill" class:rate-best={m.rating==='best'} class:rate-good={m.rating==='good'} class:rate-inaccuracy={m.rating==='inaccuracy'} class:rate-blunder={m.rating==='blunder'} title={m.rating==='best'?'Best move':m.rating==='good'?'Good move':m.rating==='inaccuracy'?'Inaccuracy':m.rating==='blunder'?'Blunder':''}><span class="mdot {m.color}"></span><span class="mtxt">{m.from}{m.capture?'\u00d7':'\u2192'}{m.to}</span></div>
    {/each}
  </div>

  <!-- Overlays -->
  {#if showResignConfirm}
    <div class="overlay" on:click|self={()=>showResignConfirm=false} on:keydown|self={(e)=>e.key==='Escape'&&(showResignConfirm=false)} role="dialog" tabindex="-1">
      <div class="card confirm"><p>Resign this game?</p><div class="confirm-btns"><button class="btn btn-primary btn-small" on:click={resign}>Resign</button><button class="btn btn-dark btn-small" on:click={()=>showResignConfirm=false}>Cancel</button></div></div>
    </div>
  {/if}

  {#if drawOfferReceived}
    <div class="overlay" on:click|self={() => respondDraw(false)} on:keydown|self={(e) => e.key === 'Escape' && respondDraw(false)} role="dialog" tabindex="-1">
      <div class="card confirm"><p>{opponentName} offers a draw</p><div class="confirm-btns"><button class="btn btn-primary btn-small" on:click={() => respondDraw(true)}>Accept</button><button class="btn btn-dark btn-small" on:click={() => respondDraw(false)}>Decline</button></div></div>
    </div>
  {/if}

  {#if activeEmote}
    <div class="emote-bubble"><span class="emote-emoji">{activeEmote.emoji}</span><span class="emote-who">{activeEmote.username}</span></div>
  {/if}

  <!-- Left panel: emotes + chat (desktop: always visible, mobile: toggled) -->
  <div class="left-panel" class:mobile-hidden-emotes={!showEmoteBar} class:mobile-hidden-chat={!showChat}>
    {#if ownedEmotes.length > 0}
      <div class="emote-bar" class:mobile-hidden={!showEmoteBar}>
        {#each ownedEmotes as e}<button class="emote-btn" on:click={()=>sendEmote(e)} title={e.name}>{e.data.emoji}</button>{/each}
      </div>
    {/if}
    {#if mode === 'online'}
      {#if showChat || desktopChat}
        <div class="game-chat card" class:minimized={!showChat && !desktopChat}>
          <RoomChat channelId={gameId ? `game:${gameId}` : null} closeable={true} readOnly={mode === 'spectator'} on:close={() => { showChat = false; desktopChat = false; }} />
        </div>
      {/if}
    {/if}
  </div>

</div>

<style>
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

  .board-wrap { position: relative; touch-action: none; border-radius: var(--radius-md); }
  .board-wrap.urgent {
    box-shadow: inset 0 0 calc(20px + 30px * var(--urgency)) rgba(239, 68, 68, calc(0.15 + 0.35 * var(--urgency)));
    animation: urgentPulse 1s ease-in-out infinite;
  }
  @keyframes urgentPulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(calc(1 - 0.08 * var(--urgency))); }
  }
  canvas {
    display: block; border-radius: var(--radius-sm); cursor: pointer; box-shadow: var(--shadow-board);
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    touch-action: none;
  }

  .game-over {
    position: absolute; inset: 0; background: rgba(0,0,0,0.75);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-sm); border-radius: var(--radius-sm); z-index: 10; backdrop-filter: blur(4px);
  }
  .game-over h2 { font-size: var(--fs-title); }
  .end-reason { font-size: var(--fs-caption); color: var(--text-dim); font-style: italic; margin-top: -4px; }

  .go-breakdown {
    display: flex; flex-direction: column; gap: 2px;
    background: rgba(255,255,255,0.05); border-radius: var(--radius-sm);
    padding: var(--sp-xs) var(--sp-sm); min-width: 140px;
  }
  .go-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: var(--fs-caption); gap: var(--sp-md);
  }
  .go-row.go-sub { justify-content: flex-start; }
  .go-sub .go-label { font-size: 0.6rem; color: var(--text-dim); opacity: 0.7; }
  .go-label { color: var(--text-dim); }
  .go-val { font-weight: 700; font-family: var(--font-mono); }
  .go-val.positive { color: var(--success); }
  .go-val.negative { color: var(--accent); }
  .go-val.go-coin { color: var(--gold); }
  .guest-nudge {
    font-size: var(--fs-caption); color: var(--accent2); cursor: pointer;
    text-decoration: underline; opacity: 0.85; margin-top: var(--sp-xs);
  }
  .guest-nudge:hover { opacity: 1; }

  .status { font-size: var(--fs-caption); color: var(--text-dim); height: 18px; }
  .spectator-badge {
    position: fixed; top: var(--sp-sm); right: var(--sp-sm);
    display: flex; align-items: center; gap: 4px;
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
  .actions { display: flex; gap: var(--sp-sm); }
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
  .move-pill.rate-best { border-left: 2px solid var(--gold); }
  .move-pill.rate-good { border-left: 2px solid var(--success); }
  .move-pill.rate-inaccuracy { border-left: 2px solid var(--warning); }
  .move-pill.rate-blunder { border-left: 3px solid #ff2d2d; background: rgba(255,45,45,0.08); }

  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 20; }
  .confirm { text-align: center; display: flex; flex-direction: column; gap: var(--sp-md); padding: var(--sp-lg); }
  .confirm-btns { display: flex; gap: var(--sp-sm); justify-content: center; }

  .emote-bubble { position: fixed; top: 20%; left: 50%; transform: translateX(-50%); background: var(--surface); border: 2px solid var(--accent); border-radius: var(--radius-lg); padding: var(--sp-sm) var(--sp-md); display: flex; flex-direction: column; align-items: center; gap: var(--sp-xs); z-index: 30; animation: emoteFloat 2.5s ease-out forwards; pointer-events: none; }
  .emote-emoji { font-size: 2.5rem; }
  .emote-who { font-size: 0.6rem; color: var(--text-dim); }
  @keyframes emoteFloat { 0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(0.5);} 15%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.1);} 25%{transform:translateX(-50%) translateY(0) scale(1);} 80%{opacity:1;} 100%{opacity:0;transform:translateX(-50%) translateY(-30px);} }

  .left-panel { display: contents; } /* On mobile, children flow into the main flex */
  .mobile-only { display: inline-flex; }
  .mobile-hidden { display: none !important; }

  .emote-bar { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; background: var(--surface); border: 1px solid var(--surface2); border-radius: var(--radius-lg); padding: var(--sp-sm) var(--sp-md); }

  .game-chat {
    width: 100%; max-width: 640px; height: 200px; padding: 0; overflow: hidden;
    position: fixed; bottom: 0; left: 0; right: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    z-index: 15;
  }

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
    .emote-bar { width: 100%; }
  }
  .emote-btn { width: 40px; height: 40px; border-radius: var(--radius-sm); background: var(--surface2); border: none; cursor: pointer; font-size: 1.4rem; transition: transform 0.1s; }
  .emote-btn:hover { transform: scale(1.15); }


  /* ---- Desktop 3-column ---- */
  /* Left: emotes | Center: opponent + board + self + status + actions | Right: moves */
  @media (min-width: 1100px) {
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
    .board-wrap { grid-column: 2; grid-row: 2; justify-self: center; }
    .player-bar.self { grid-column: 2; grid-row: 3; }
    .status { grid-column: 2; grid-row: 4; text-align: center; }
    .disconnect-banner { grid-column: 2; grid-row: 4; }
    .actions { grid-column: 2; grid-row: 5; justify-self: center; }


    .moves {
      grid-column: 3; grid-row: 1 / 6;
      flex-direction: column; overflow-y: auto; overflow-x: hidden;
      max-height: 400px; max-width: none;
      align-self: center;
      scrollbar-width: thin;
    }
  }
</style>
