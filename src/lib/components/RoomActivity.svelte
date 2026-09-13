<script>
  import PlayerLink from './PlayerLink.svelte';
  import { activeRoom } from '$lib/stores/app.js';
  import { openSession } from '$lib/stores/navigation.js';
  import { sendCommand, session } from '$lib/stores/session.js';
  import { user } from '$lib/stores/user.js';
  import { roomActivity } from '$lib/roomActivity.js';
  let { floating = false } = $props();
  const room = $derived($activeRoom);
  const activity = $derived(roomActivity(room, $user?.id));
  const canAct = $derived($session.status === 'ready' && !$session.pending && room?.status === 'waiting');
  function activate() {
    if (activity.quickPlay && !canAct) return;
    const currentRoom = room;
    const play = activity.quickPlay;
    openSession();
    if (play) sendCommand('room:ready', { roomId: currentRoom.id, ready: true, expectedSettings: currentRoom.settings });
  }
</script>
{#if room}
  <div class="room-activity" class:floating class:ready={activity.ready} role="group" aria-label="Your room">
    <div class="room-summary">
      <button type="button" class="room-status" onclick={() => openSession()}>
        <span class="dot"></span><span aria-live="polite">{activity.label}</span>
      </button>
      {#if activity.opponent}<span class="opponent"><PlayerLink username={activity.opponent.username}/></span>{/if}
    </div>
    <button type="button" class="room-action" class:play={activity.quickPlay} onclick={activate} disabled={activity.quickPlay && !canAct}>{activity.action}</button>
  </div>
{/if}
<style>
  .room-activity { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:6px 8px 6px 12px; border:1px solid var(--surface2); border-radius:var(--radius-md); background:var(--surface); color:var(--text); }
  .room-activity.ready { background:color-mix(in srgb, var(--success) 12%, var(--surface)); }
  .room-summary { min-width:0; display:grid; gap:2px; }
  .room-status { display:flex; align-items:center; gap:8px; min-height:28px; padding:0; border:0; background:none; color:inherit; font:inherit; font-size:var(--fs-caption); text-align:left; cursor:pointer; }
  .dot { width:7px; height:7px; flex:none; border-radius:50%; background:var(--text-dim); }
  .ready .dot { background:var(--success); }
  .opponent { padding-left:15px; font-size:11px; color:var(--text-dim); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .room-action { flex:none; min-height:44px; padding:0 14px; border:0; border-radius:var(--radius-sm); background:var(--surface2); color:var(--text); font-family:var(--font); font-size:var(--fs-caption); font-weight:600; cursor:pointer; }
  .room-action.play { background:var(--success); color:var(--bg); }
  .room-action:disabled { opacity:.5; cursor:default; }
  .floating { position:fixed; z-index:48; width:max-content; max-width:calc(100vw - 24px); bottom:calc(var(--tab-height) + var(--sp-sm) + env(safe-area-inset-bottom, 0px)); left:50%; transform:translateX(-50%); box-shadow:0 4px 20px #0005; border-radius:var(--radius-pill); }
  .floating .room-action { border-radius:var(--radius-pill); }
  @media (min-width:900px) { .floating { bottom:auto; top:var(--sp-md); left:auto; right:var(--sp-md); transform:none; } }
</style>
