<script>
  import { phase, gameState, activeRoom, searching, connectionStatus, browseTab, presenceStats, gameOverVisible } from '$lib/stores/app.js';
  import { gameScreen } from '$lib/stores/gameScreen.js';
  import { user } from '$lib/stores/user.js';
  import { getSocket } from '$lib/socket.js';
  import { api } from '$lib/api.js';
  import { onMount, onDestroy } from 'svelte';

  let open = false;
  let eventLog = [];
  let socket;
  let copied = false;

  // Admin tools
  let targetUserId = '';
  let coinAmount = 100;
  let eloAmount = 1000;
  let adminMsg = '';

  $: targetId = targetUserId ? Number(targetUserId) : undefined;
  const MAX_EVENTS = 40;

  function onKeyDown(e) {
    if (e.key === 'F2') { e.preventDefault(); open = !open; }
  }

  function logEvent(direction, name, data) {
    const entry = {
      t: new Date().toISOString().slice(11, 23),
      dir: direction,
      name,
      data: data ? JSON.stringify(data).slice(0, 200) : ''
    };
    eventLog = [...eventLog.slice(-(MAX_EVENTS - 1)), entry];
  }

  // Intercept socket events
  let origEmit;
  function hookSocket(sock) {
    if (!sock || sock._devHooked) return;
    sock._devHooked = true;

    // Hook incoming events
    const origOn = sock.onevent;
    sock.onevent = function(packet) {
      const [name, ...args] = packet.data || [];
      logEvent('in', name, args[0]);
      origOn.call(this, packet);
    };

    // Hook outgoing events
    origEmit = sock.emit.bind(sock);
    sock.emit = function(name, ...args) {
      if (name !== 'ping') logEvent('out', name, args[0]);
      return origEmit(name, ...args);
    };
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown);
    socket = getSocket();
    if (socket) hookSocket(socket);
    // Re-check periodically in case socket connects later
    const interval = setInterval(() => {
      const s = getSocket();
      if (s && s !== socket) { socket = s; hookSocket(s); }
    }, 2000);
    return () => clearInterval(interval);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
  });

  function copyReport() {
    const gs = $gameState;
    const ar = $activeRoom;
    const report = [
      `=== Pure Checkers Dev Report ===`,
      `Time: ${new Date().toISOString()}`,
      ``,
      `--- Stores ---`,
      `phase: ${$phase}`,
      `gameScreen: ${$gameScreen}`,
      `browseTab: ${$browseTab}`,
      `connectionStatus: ${$connectionStatus}`,
      `searching: ${$searching}`,
      `gameOverVisible: ${$gameOverVisible}`,
      `presenceStats: ${JSON.stringify($presenceStats)}`,
      ``,
      `--- User ---`,
      `id: ${$user?.id}`,
      `username: ${$user?.username}`,
      `isGuest: ${$user?.isGuest}`,
      `elo: ${$user?.elo}`,
      `coins: ${$user?.coins}`,
      ``,
      `--- Game State ---`,
      gs ? [
        `gameId: ${gs.gameId}`,
        `mode: ${gs.mode}`,
        `myColor: ${gs.myColor}`,
        `opponentName: ${gs.opponentName}`,
        `opponentId: ${gs.opponentId}`,
        `opponentOnline: ${gs.opponentOnline}`,
        `reconnectState: ${gs.reconnectState ? 'yes' : 'no'}`,
        gs.reconnectState ? `  currentPlayer: ${gs.reconnectState.currentPlayer}` : null,
        gs.reconnectState ? `  gameOver: ${gs.reconnectState.gameOver}` : null,
        gs.reconnectState ? `  redTime: ${gs.reconnectState.redTime}` : null,
        gs.reconnectState ? `  blackTime: ${gs.reconnectState.blackTime}` : null,
      ].filter(Boolean).join('\n') : 'null',
      ``,
      `--- Active Room ---`,
      ar ? [
        `id: ${ar.id}`,
        `status: ${ar.status}`,
        `effectiveMode: ${ar.effectiveMode}`,
        `players: ${ar.players?.map(p => `${p.username}(${p.userId},${p.isBot?'bot':'human'},${p.ready?'ready':'not'})`).join(', ')}`,
        `spectators: ${ar.spectators?.length || 0}`,
        `gameId: ${ar.gameId}`,
      ].join('\n') : 'null',
      ``,
      `--- Socket ---`,
      `connected: ${socket?.connected}`,
      `id: ${socket?.id}`,
      ``,
      `--- Event Log (last ${eventLog.length}) ---`,
      ...eventLog.map(e => `[${e.t}] ${e.dir === 'in' ? '<-' : '->'} ${e.name} ${e.data}`),
    ].join('\n');

    navigator.clipboard.writeText(report).then(() => {
      copied = true;
      setTimeout(() => copied = false, 2000);
    });
  }

  async function adminAction(endpoint, body) {
    adminMsg = '';
    try {
      const res = await api.post(`/admin/${endpoint}`, body);
      adminMsg = JSON.stringify(res.user || res, null, 0);
      // Refresh user data
      const me = await api.get('/auth/me');
      $user = me.user;
    } catch (err) {
      adminMsg = err.message || 'Failed';
    }
    setTimeout(() => adminMsg = '', 3000);
  }
</script>

{#if open}
  <div class="dev-panel">
    <div class="dev-header">
      <span class="dev-title">Dev Panel</span>
      <button class="dev-copy" on:click={copyReport}>{copied ? 'Copied!' : 'Copy Report'}</button>
      <button class="dev-close" on:click={() => open = false}>x</button>
    </div>

    <div class="dev-section">
      <div class="dev-row"><span class="dev-key">phase</span><span class="dev-val">{$phase}</span></div>
      <div class="dev-row"><span class="dev-key">gameScreen</span><span class="dev-val">{$gameScreen}</span></div>
      <div class="dev-row"><span class="dev-key">browseTab</span><span class="dev-val">{$browseTab}</span></div>
      <div class="dev-row"><span class="dev-key">connection</span><span class="dev-val" class:warn={$connectionStatus !== 'connected'}>{$connectionStatus}</span></div>
      <div class="dev-row"><span class="dev-key">searching</span><span class="dev-val">{$searching}</span></div>
      <div class="dev-row"><span class="dev-key">gameOver</span><span class="dev-val">{$gameOverVisible}</span></div>
      <div class="dev-row"><span class="dev-key">online</span><span class="dev-val">{$presenceStats.online}/{$presenceStats.lookingToPlay}</span></div>
    </div>

    {#if $user}
      <div class="dev-section">
        <div class="dev-label">User</div>
        <div class="dev-row"><span class="dev-key">id</span><span class="dev-val">{$user.id}</span></div>
        <div class="dev-row"><span class="dev-key">name</span><span class="dev-val">{$user.username}</span></div>
        <div class="dev-row"><span class="dev-key">guest</span><span class="dev-val">{$user.isGuest}</span></div>
      </div>
    {/if}

    {#if $gameState}
      <div class="dev-section">
        <div class="dev-label">Game</div>
        <div class="dev-row"><span class="dev-key">id</span><span class="dev-val">{$gameState.gameId}</span></div>
        <div class="dev-row"><span class="dev-key">mode</span><span class="dev-val">{$gameState.mode}</span></div>
        <div class="dev-row"><span class="dev-key">myColor</span><span class="dev-val">{$gameState.myColor}</span></div>
        <div class="dev-row"><span class="dev-key">opponent</span><span class="dev-val">{$gameState.opponentName}</span></div>
        {#if $gameState.reconnectState}
          <div class="dev-row"><span class="dev-key">curPlayer</span><span class="dev-val">{$gameState.reconnectState.currentPlayer}</span></div>
          <div class="dev-row"><span class="dev-key">gameOver</span><span class="dev-val">{$gameState.reconnectState.gameOver}</span></div>
        {/if}
      </div>
    {/if}

    {#if $activeRoom}
      <div class="dev-section">
        <div class="dev-label">Room</div>
        <div class="dev-row"><span class="dev-key">id</span><span class="dev-val">{$activeRoom.id}</span></div>
        <div class="dev-row"><span class="dev-key">status</span><span class="dev-val">{$activeRoom.status}</span></div>
        <div class="dev-row"><span class="dev-key">mode</span><span class="dev-val">{$activeRoom.effectiveMode}</span></div>
        {#each $activeRoom.players || [] as p}
          <div class="dev-row"><span class="dev-key">player</span><span class="dev-val">{p.username} {p.isBot?'[bot]':''} {p.ready?'✓':''}</span></div>
        {/each}
      </div>
    {/if}

    <div class="dev-section">
      <div class="dev-label">Socket</div>
      <div class="dev-row"><span class="dev-key">connected</span><span class="dev-val">{socket?.connected}</span></div>
      <div class="dev-row"><span class="dev-key">id</span><span class="dev-val">{socket?.id?.slice(0,8)}</span></div>
    </div>

    {#if $user?.isAdmin}
      <div class="dev-section">
        <div class="dev-label">Admin Tools</div>
        <div class="dev-tool">
          <input type="text" bind:value={targetUserId} class="dev-input" placeholder="User ID (blank=self)" />
        </div>
        <div class="dev-tool">
          <input type="number" bind:value={coinAmount} class="dev-input" />
          <button class="dev-btn" on:click={() => adminAction('give-coins', { userId: targetId, amount: coinAmount })}>Give Coins</button>
        </div>
        <div class="dev-tool">
          <input type="number" bind:value={eloAmount} class="dev-input" />
          <button class="dev-btn" on:click={() => adminAction('set-elo', { userId: targetId, elo: eloAmount })}>Set ELO</button>
        </div>
        <div class="dev-tool">
          <button class="dev-btn warn" on:click={() => adminAction('reset-stats', { userId: targetId })}>Reset Stats</button>
        </div>
        {#if adminMsg}<div class="dev-msg">{adminMsg}</div>{/if}
      </div>
    {/if}

    <div class="dev-section dev-events">
      <div class="dev-label">Events ({eventLog.length})</div>
      <div class="dev-event-list">
        {#each eventLog as e}
          <div class="dev-event" class:incoming={e.dir === 'in'} class:outgoing={e.dir === 'out'}>
            <span class="dev-etime">{e.t}</span>
            <span class="dev-edir">{e.dir === 'in' ? '<-' : '->'}</span>
            <span class="dev-ename">{e.name}</span>
            {#if e.data}<span class="dev-edata">{e.data}</span>{/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .dev-panel {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 950;
    width: 320px; max-width: 90vw;
    background: rgba(0,0,0,0.92); backdrop-filter: blur(8px);
    color: #ccc; font-family: monospace; font-size: 11px;
    display: flex; flex-direction: column;
    overflow-y: auto;
    border-left: 1px solid #333;
  }
  .dev-header {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; background: #111; border-bottom: 1px solid #333;
    position: sticky; top: 0;
  }
  .dev-title { font-weight: 700; color: #0f0; flex: 1; }
  .dev-copy {
    background: #222; border: 1px solid #444; color: #0f0;
    font-family: monospace; font-size: 10px; padding: 2px 8px;
    cursor: pointer; border-radius: 3px;
  }
  .dev-copy:hover { background: #333; }
  .dev-close {
    background: none; border: none; color: #666; font-family: monospace;
    font-size: 14px; cursor: pointer; padding: 0 4px;
  }
  .dev-close:hover { color: #fff; }
  .dev-section { padding: 6px 10px; border-bottom: 1px solid #222; }
  .dev-label { color: #888; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .dev-row { display: flex; justify-content: space-between; padding: 1px 0; }
  .dev-key { color: #888; }
  .dev-val { color: #eee; text-align: right; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
  .dev-val.warn { color: #f90; }

  .dev-tool { display: flex; gap: 4px; margin-bottom: 4px; }
  .dev-input {
    flex: 1; background: #111; border: 1px solid #333; color: #eee;
    font-family: monospace; font-size: 11px; padding: 3px 6px;
    border-radius: 3px; width: 60px;
  }
  .dev-btn {
    background: #222; border: 1px solid #444; color: #0f0;
    font-family: monospace; font-size: 10px; padding: 3px 8px;
    cursor: pointer; border-radius: 3px; white-space: nowrap;
  }
  .dev-btn:hover { background: #333; }
  .dev-btn.warn { color: #f44; border-color: #633; }
  .dev-btn.warn:hover { background: #311; }
  .dev-msg { font-size: 9px; color: #0f0; padding: 2px 0; word-break: break-all; }

  .dev-events { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .dev-event-list {
    display: flex; flex-direction: column; gap: 1px;
    flex: 1; overflow-y: auto;
    scrollbar-width: thin; scrollbar-color: #333 transparent;
  }
  .dev-event-list::-webkit-scrollbar { width: 4px; }
  .dev-event-list::-webkit-scrollbar-track { background: transparent; }
  .dev-event-list::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  .dev-event-list::-webkit-scrollbar-thumb:hover { background: #555; }
  .dev-event { display: flex; gap: 4px; padding: 1px 0; font-size: 10px; }
  .dev-event.incoming .dev-ename { color: #4fc; }
  .dev-event.outgoing .dev-ename { color: #f94; }
  .dev-etime { color: #555; flex-shrink: 0; }
  .dev-edir { color: #666; flex-shrink: 0; }
  .dev-ename { font-weight: 600; flex-shrink: 0; }
  .dev-edata { color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
