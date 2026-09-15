<script>
  import AdminContextButton from '../admin/AdminContextButton.svelte';
  import PlayerAvatar from '../PlayerAvatar.svelte';
  import PlayerLink from '../PlayerLink.svelte';
  import Icon from '../table/TableIcon.svelte';
  import { onMount } from 'svelte';
  import { activeRoom } from '$lib/stores/app.js';
  import { minimizeSession } from '$lib/stores/navigation.js';
  import { user } from '$lib/stores/user.js';
  import { sendCommand, session, serverNow } from '$lib/stores/session.js';
  import { BOT_DIFFICULTIES, botDifficultyLabel } from '../../../../shared/bots.js';
  import { track } from '$lib/analytics.js';
  import { ScreenWakeLock } from '$lib/screenWakeLock.js';
  import RoomChat from '../chat/RoomChat.svelte';
  import ShareActions from '../ShareActions.svelte';
  import Modal from '../Modal.svelte';
  import HelpPopover from '../HelpPopover.svelte';
  import RoomInviteFriends from './RoomInviteFriends.svelte';
  import RoomSettings from './RoomSettings.svelte';

  // Every room uses the same controls. Invitation context adds a sharing section.
  const room = $derived($activeRoom);
  const me = $derived(room?.players?.find(p => p.userId === $user?.id) || null);
  const isHost = $derived(!!room && room.hostId === $user?.id);
  const host = $derived(room?.players?.find(p => p.userId === room.hostId) || null);
  const hostName = $derived(room?.hostName || host?.username || 'your friend');
  const autoReady = $derived(!!room?.settings?.autoReady);
  const seatFree = $derived(!!room && room.players.length < 2);
  const starting = $derived(room?.status === 'starting');
  const updating = $derived(room?.status === 'updating');
  const startAvailable = $derived(autoReady && room?.readyToStart === true);
  const canSend = $derived($session.status === 'ready' && !$session.pending && !updating);
  const leaving = $derived($session.pending === 'room:leave');
  const timerLabel = $derived(room?.settings?.turnTimer ? `${room.settings.turnTimer}s` : 'No clock');
  const effectiveMode = $derived(room?.effectiveMode || 'RANKED');
  const settingBadges = $derived(room ? [
    { field: 'buyIn', label: room.settings.buyIn > 0 ? `${room.settings.buyIn}c` : 'Free', name: 'buy-in' },
    { field: 'turnTimer', label: timerLabel, name: 'turn timer' },
    { field: 'allowSpectators', label: room.settings.allowSpectators ? 'Spectators allowed' : 'Spectators off', icon: room.settings.allowSpectators ? 'eye' : 'eyeOff', name: 'spectator access' },
    { field: 'isPrivate', label: room.settings.isPrivate ? 'Private' : 'Public', name: 'room privacy' },
  ] : []);

  let managedPlayerId = $state(null);
  const managedPlayer = $derived(isHost && room?.players.find(p => p.userId === managedPlayerId && p.userId !== $user?.id));
  let selectedBot = $state('medium');
  let showQr = $state(false);
  let collapsedInviteRoom = $state(null);
  const inviteExpanded = $derived(collapsedInviteRoom !== room?.id);
  let showFriends = $state(false);
  let showSettings = $state(false);
  let focusSetting = $state('buyIn');
  function editSetting(field) {
    if (!isHost || !canSend || !room?.canEditSettings) return;
    focusSetting = field; showSettings = true;
  }
  function toggleReady() { sendCommand('room:ready', { roomId: room?.id, ready: !me?.ready, expectedSettings: room?.settings }); }
  function retryStart() { sendCommand('room:ready', { roomId: room?.id, ready: true, expectedSettings: room?.settings }); }
  function leaveRoom() { sendCommand('room:leave', { roomId: room?.id }); }
  function kick(userId) { sendCommand('room:kick', { roomId: room?.id, userId }); }
  function addBot() { sendCommand('bot:join', { roomId: room?.id, difficulty: selectedBot }); }

  // Both nearby and configured rooms show their code only to the waiting host.
  let wakeLock = $state.raw(null);
  onMount(() => {
    const owner = new ScreenWakeLock({ document, request: type => navigator.wakeLock?.request(type) });
    wakeLock = owner;
    return () => owner.dispose();
  });
  $effect(() => {
    wakeLock?.setTarget(isHost && seatFree && room?.qrDataUrl && (inviteExpanded || showQr) ? room.id : null);
  });
</script>

<div class="waiting-screen">
  <div class="column">
    <div class="room-heading">
      <button type="button" class="back-btn" onclick={() => minimizeSession()}>Back</button>
      <h2>Game room</h2>{#if room}<AdminContextButton section="rooms" id={room.id} label="Room tools"/>{/if}
      {#if room}<button type="button" class="back-btn leave-btn" onclick={leaveRoom} disabled={!canSend} aria-busy={leaving}>{isHost ? 'Close room' : 'Leave room'}</button>{/if}
    </div>
    {#if updating}<p class="status-line" role="status">Confirming room change…</p>{/if}
    {#if !room}
      <div class="spinner"></div>
      <p class="dim">Loading room…</p>

    {:else}
      <div class="settings-row" role="group" aria-label="Room settings">
        <span class="room-mode">{effectiveMode === 'RANKED' ? 'Ranked' : 'Friendly'}</span>
        {#each settingBadges as badge (badge.field)}
          {#if isHost && !room.challenge}
            <button type="button" class="setting-value" onclick={() => editSetting(badge.field)} disabled={!canSend || !room.canEditSettings}
              aria-label={`Edit ${badge.name}: ${badge.label}`} title={`${badge.name}: ${badge.label}`} aria-haspopup="dialog">
              {#if badge.icon}<Icon name={badge.icon} size={16}/>{:else}<span>{badge.label}</span>{/if}
            </button>
          {:else}<span class="setting-value" title={`${badge.name}: ${badge.label}`} aria-label={`${badge.name}: ${badge.label}`}>{#if badge.icon}<Icon name={badge.icon} size={16}/>{:else}{badge.label}{/if}</span>{/if}
        {/each}
        <HelpPopover label="Room settings">Tap a setting to change it. Settings are locked while a player is ready. Both players ready up to start. Back keeps your room open; Close room ends it.</HelpPopover>
      </div>
      {#if room.challenge && seatFree}
        <p class="status-line" role="status">Invitation sent. Waiting for the player to accept.</p>
        <p class="dim">Expires in {Math.max(0, Math.ceil((room.challenge.expiresAt - ($serverNow ?? room.challenge.expiresAt)) / 1000))} seconds. You can leave to cancel.</p>
      {:else if isHost && seatFree}
        <div class="invite-section">
          <div class="invite-top"><button type="button" class="invite-toggle" aria-expanded={inviteExpanded} aria-controls={`room-invite-content-${room.id}`} onclick={() => collapsedInviteRoom = inviteExpanded ? room.id : null}><span class="invite-chevron" class:expanded={inviteExpanded}><Icon name="arrow" size={16}/></span>Invite to play</button><div class="invite-code"><strong>{room.joinCode}</strong>{#if room.qrDataUrl}<button type="button" class="qr-expand" onclick={() => showQr = true} aria-label="Enlarge QR code" aria-haspopup="dialog"><Icon name="expand" size={16}/></button>{/if}<HelpPopover label="Invite with a code">A friend can scan this QR code, open the link, or enter this code in the lobby. Tap the QR code to enlarge it.</HelpPopover></div></div>
          <div id={`room-invite-content-${room.id}`} class="invite-content" hidden={!inviteExpanded}>
          {#if room.qrDataUrl}
            <button type="button" class="qr-button" onclick={() => showQr = true} aria-label="Enlarge QR code" aria-haspopup="dialog">
              <img class="scan-image" src={room.qrDataUrl} width="224" height="224" alt="Scan to join this room" />
            </button>
          {/if}
          <ShareActions variant="input" surface="invite" url={room.joinUrl} data={{ hostName, buyIn: room.settings.buyIn }} onshared={method => track('invite_link_shared', { method })} />
          </div>
        </div>
      {/if}

      <div class="slots">
        {#each [0, 1] as i}
          {@const p = room.players[i]}
          <div class="slot" class:ready={p?.ready}>
            {#if p}
              <div class="player-row">
                <span class="seat-avatar" role="img" aria-label={`${p.username}: ${p.online === false ? 'offline' : 'online'}`} title={p.online === false ? 'Offline' : 'Online'}>
                  <PlayerAvatar username={p.username} size={36}/>
                  <span class="presence-dot" class:online={p.online !== false} class:offline={p.online === false}></span>
                </span>
                <div class="player-identity" title={p.username}>
                  <span class="pname">
                    <PlayerLink username={p.username} />
                    {#if p.userId === $user?.id}<span class="you-tag">You</span>{/if}
                    {#if p.isBot}<span class="you-tag">Bot</span>{/if}
                  </span>
                  <span class="player-meta"><span>{p.elo} ELO</span>
                    {#if p.userId !== $user?.id || autoReady}<span class="readiness" class:confirmed={p.ready}>{p.online === false ? 'Offline' : p.ready ? 'Ready' : 'Not ready'}</span>{/if}
                  </span>
                </div>
                {#if p.userId === $user?.id && !p.isBot && !autoReady}
                  <button type="button" class="btn btn-small ready-button" class:btn-primary={!p.ready} class:btn-dark={p.ready}
                    onclick={toggleReady} disabled={!canSend || starting || seatFree} aria-pressed={p.ready}
                    title={seatFree ? 'Waiting for an opponent to join' : p.ready ? 'Withdraw readiness' : 'Ready to play with these settings'}>
                    <span class="ready-check" class:checked={p.ready}><Icon name="check" size={16}/></span>Ready
                  </button>

                {/if}
                {#if isHost && p.userId !== $user?.id}
                  <button type="button" class="player-menu" onclick={() => managedPlayerId = p.userId} disabled={!canSend || starting} aria-label={`Room actions for ${p.username}`} aria-haspopup="dialog"><Icon name="more" size={18}/></button>
                {/if}
              </div>
            {:else}
              <div class="empty-slot">
                {#if isHost && !room.challenge}
                  <div class="opponent-actions">
                    <button type="button" class="btn btn-dark btn-small" onclick={() => showFriends = true} disabled={!canSend} aria-haspopup="dialog">Invite a friend</button>
                    {#if room.canAddBot}
                      <div class="bot-control">
                        <button type="button" class="btn btn-dark btn-small" onclick={addBot} disabled={!canSend}>Add bot</button>
                        <select aria-label="Bot difficulty" bind:value={selectedBot} disabled={!canSend}>
                          {#each BOT_DIFFICULTIES as difficulty}<option value={difficulty}>{botDifficultyLabel(difficulty)}</option>{/each}
                        </select>
                      </div>
                    {/if}
                  </div>
                {:else}<span class="dim">Waiting for an opponent</span>{/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if room.spectators?.length > 0}
        <p class="spectators">Spectators: {#each room.spectators as spectator, i}{#if i}, {/if}<PlayerLink username={spectator.username} />{/each}</p>
      {/if}

      <div class="actions">
        {#if starting}
          <p class="status-line"><span class="spinner-small"></span>Starting…</p>
        {:else if startAvailable && me}
          <p class="status-line">Ready to start.</p>
          <button type="button" class="btn btn-primary" onclick={retryStart} disabled={!canSend}>Start game</button>
        {/if}
      </div>

      <div class="chat-box card">
        <RoomChat channelId={`room:${room.id}`} />
      </div>
    {/if}
  </div>
</div>
{#if managedPlayer}
  <Modal label={`Room actions for ${managedPlayer.username}`} on:close={() => managedPlayerId = null}>
    <div class="player-menu-panel">
      <header><h2>{managedPlayer.username}</h2><button type="button" class="menu-close" onclick={() => managedPlayerId = null} aria-label="Close player actions"><Icon name="close" size={20}/></button></header>
      <button type="button" class="btn btn-dark remove-player" disabled={!canSend || starting} onclick={() => { kick(managedPlayer.userId); managedPlayerId = null; }}>Remove from room</button>
    </div>
  </Modal>
{/if}
{#if showSettings && room}
  <RoomSettings {room} focusField={focusSetting} onclose={() => showSettings = false} />
{/if}

{#if showQr && room?.qrDataUrl}
  <Modal label="Scan to join this room" maxWidth="640px" on:close={() => showQr = false}>
    <div class="qr-dialog"><header><h2>Scan to join</h2><button class="btn btn-dark btn-small" onclick={() => showQr = false}>Close</button></header>
      <img src={room.qrDataUrl} width="640" height="640" alt="Enlarged QR code to join this room" />
      <strong>{room.joinCode}</strong>
    </div>
  </Modal>
{/if}
{#if showFriends && isHost && room && seatFree}
  <RoomInviteFriends {room} onclose={() => showFriends = false}/>
{/if}

<style>
  .waiting-screen {
    height: 100%; min-height: 0; display: flex; flex-direction: column;
    background: radial-gradient(ellipse at 50% 30%, var(--bg-subtle) 0%, var(--bg) 70%);
  }
  .room-heading { display:flex; align-items:center; gap:var(--sp-sm); width:100%; flex-shrink:0; }
  .room-heading h2 { flex:1; min-width:0; font-size:13px; font-weight:600; text-align:center; overflow-wrap:anywhere; }
  .room-heading { justify-content:space-between; }
  .back-btn { min-height:44px; padding:0 var(--sp-sm); border:0; border-radius:var(--radius-sm); background:none; color:var(--text-dim); font:inherit; font-size:var(--fs-caption); cursor:pointer; }
  .back-btn:hover { color:var(--text); }

  .column {
    flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    padding: 8px 16px 16px; padding-bottom: max(var(--sp-md), env(safe-area-inset-bottom));
    width: 100%; max-width: 520px; margin: 0 auto;
  }

  .qr-button { position:relative; border:0; padding:0; border-radius:var(--radius-md); background:#fff; cursor:zoom-in; flex-shrink:0; }
  .scan-image { display:block; width:min(224px, 65vw); height:auto; aspect-ratio:1; border-radius:inherit; padding:8px; image-rendering:pixelated; }
  .qr-expand { display:grid; place-items:center; width:44px; height:44px; padding:0; flex:none; border:0; border-radius:var(--radius-sm); background:none; color:var(--text-dim); cursor:pointer; }
  .qr-expand:hover { color:var(--text); background:var(--surface2); }
  .qr-dialog { display:grid; gap:var(--sp-md); padding:var(--sp-md); text-align:center; }
  .qr-dialog header { display:flex; align-items:center; justify-content:space-between; gap:var(--sp-sm); }
  .qr-dialog h2 { font-size:var(--fs-body); }
  .qr-dialog img { display:block; width:100%; height:auto; aspect-ratio:1; image-rendering:pixelated; background:#fff; padding:8px; border-radius:var(--radius-sm); }
  .status-line { display: flex; align-items: center; justify-content: center; gap: var(--sp-sm); font-size: var(--fs-body); color: var(--text-dim); text-align: center; }
  .invite-code { display:flex; align-items:center; color: var(--text-dim); font-size: var(--fs-caption); }
  .invite-code strong { margin-left:0; color: var(--text); letter-spacing: 0.12em; font-family:var(--font); }

  .settings-row { margin-top:-12px; display:flex; align-items:center; justify-content:flex-start; gap:2px; width:100%; min-height:44px; flex-shrink:0; overflow-x:auto; border-bottom:1px solid var(--surface2); }
  .room-mode { flex:none; padding:0 6px; font-size:11px; color:var(--text-dim); }
  .setting-value { display:inline-flex; align-items:center; justify-content:center; flex:none; min-width:44px; min-height:44px; padding:0 6px; border:0; border-radius:6px; background:none; color:var(--text-dim); font:inherit; font-size:12px; white-space:nowrap; }
  button.setting-value { cursor:pointer; }
  button.setting-value:enabled span { text-decoration:underline dotted; text-underline-offset:4px; text-decoration-color:var(--surface2); }
  button.setting-value:enabled:hover { color:var(--text); background:var(--surface); }
  .setting-value:focus-visible { outline:2px solid var(--accent); outline-offset:-3px; }
  .setting-value:disabled { opacity:.55; cursor:not-allowed; }

  .invite-section { width:100%; padding:0 12px; display:flex; flex-direction:column; align-items:center; border:1px solid var(--surface2); border-radius:var(--radius-lg); background:var(--surface); }
  .invite-content { width:100%; display:flex; flex-direction:column; align-items:center; gap:12px; padding:12px 0 22px; }
  .invite-content[hidden] { display:none; }
  .invite-toggle { display:flex; align-items:center; gap:6px; min-height:44px; padding:0; border:0; background:none; color:inherit; font:inherit; cursor:pointer; text-align:left; }
  .invite-toggle:hover { color:var(--text); }
  .invite-chevron { display:flex; flex:none; transition:transform 150ms ease; }
  .invite-chevron.expanded { transform:rotate(90deg); }
  @media (prefers-reduced-motion: reduce) { .invite-chevron { transition:none; } }
  .invite-top { display:flex; align-items:center; justify-content:space-between; width:100%; min-height:44px; color:var(--text-dim); font-size:11px; }


  .slots { display:flex; flex-direction:column; width:100%; border:1px solid var(--surface2); border-radius:var(--radius-lg); background:var(--surface); overflow:hidden; flex-shrink:0; }
  .slot { padding:12px; min-height:68px; display:flex; align-items:center; }
  .slot + .slot { border-top:1px solid var(--surface2); }

  .slot.ready { background:color-mix(in srgb, var(--success) 12%, var(--surface)); }
  .player-row { display: flex; align-items: center; gap: 10px; width: 100%; }
  .seat-avatar { position:relative; display:flex; flex:none; }
  .presence-dot { position:absolute; bottom:-1px; right:-1px; width:10px; height:10px; border:2px solid var(--surface); border-radius:50%; }
  .presence-dot.online { background: var(--success); }
  .presence-dot.offline { background: var(--text-dim); }
  .player-identity { flex:1; min-width:0; overflow-wrap:anywhere; }
  .ready-button { position:relative; flex:none; justify-content:center; min-height:44px; width:86px; margin-left:auto; padding:0 10px; font-family:var(--font); }
  .ready-check { position:absolute; left:5px; top:50%; transform:translateY(-50%); display:flex; visibility:hidden; }
  .ready-check.checked { visibility:visible; }
  .ready-button[aria-pressed="true"] { color:var(--success); background:color-mix(in srgb, var(--success) 10%, var(--surface)); }

  .pname { font-weight: 600; font-size:13px; display:flex; align-items:center; gap: var(--sp-xs); }
  .you-tag { font-size: 0.55rem; color: var(--accent); font-weight: 700; text-transform: uppercase; background: var(--accent-glow, rgba(239,68,68,0.1)); padding: 1px 5px; border-radius: var(--radius-pill); }
  .pname :global(a), .pname :global(span:not(.you-tag)) { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .you-tag { flex:none; }
  .player-meta { display:flex; align-items:center; gap:6px; font-size:10px; color:var(--text-dim); white-space:nowrap; }
  .readiness::before { content:'·'; margin-right:6px; }
  .readiness.confirmed { color:var(--success); }
  .player-menu, .menu-close { display:grid; place-items:center; width:44px; min-height:44px; flex:none; border:0; border-radius:var(--radius-sm); background:none; color:var(--text-dim); cursor:pointer; }
  .player-menu:hover, .menu-close:hover { background:var(--surface2); color:var(--text); }
  .player-menu-panel { display:grid; gap:var(--sp-md); padding:var(--sp-md); }
  .player-menu-panel header { display:flex; align-items:center; gap:var(--sp-sm); justify-content:space-between; }
  .player-menu-panel h2 { font-size:var(--fs-body); overflow-wrap:anywhere; }
  .remove-player { min-height:44px; color:var(--accent); font-family:var(--font); }

  .empty-slot { width:100%; display:grid; gap:var(--sp-sm); }
  .opponent-actions { display:flex; flex-wrap:wrap; align-items:stretch; gap:8px; }
  .opponent-actions .btn { flex:none; white-space:nowrap; min-height:44px; font-family:var(--font); font-size:11px; padding:0 10px; text-decoration:none; }
  .bot-control { display:flex; flex:none; }

  .bot-control .btn { border-radius:var(--radius-sm) 0 0 var(--radius-sm); white-space:nowrap; }
  .bot-control select { min-height:44px; width:auto; min-width:calc(7ch + 2.5rem); flex:none; padding:0 10px; border:1px solid var(--surface2); border-radius:0 var(--radius-sm) var(--radius-sm) 0; background:var(--bg); color:var(--text); font:inherit; font-size:var(--fs-caption); }

  .dim { color: var(--text-dim); }
  .spinner-small { width: 16px; height: 16px; border: 2px solid var(--surface2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }


  .spectators { font-size: var(--fs-caption); color: var(--text-dim); }
  .actions:empty { display:none; }
  .actions { display: flex; gap: var(--sp-sm); flex-wrap: wrap; justify-content: center; align-items: center; }
  .actions .btn { min-height: 44px; }
  .back-btn.leave-btn { color: var(--accent); }
  .chat-box { width: 100%; height: 180px; padding: 0; overflow: hidden; flex-shrink: 0; }
  @media (prefers-reduced-motion: reduce) { .spinner-small { animation-duration: 2s; } }
</style>
