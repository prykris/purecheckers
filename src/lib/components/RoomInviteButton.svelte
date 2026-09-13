<script>
  import { activeRoom } from '$lib/stores/app.js';
  import { session, sendCommand } from '$lib/stores/session.js';
  import { user } from '$lib/stores/user.js';
  import { canInviteToRoom, canReceiveRoomInvite } from '../../../shared/roomInvitations.js';
  let { player, friends = false } = $props();
  const room = $derived($activeRoom);
  // Keep the same control mounted while its command is being confirmed.
  const eligible = $derived(canInviteToRoom(room?.status === 'updating' ? { ...room, status: 'waiting' } : room, $user?.id) && canReceiveRoomInvite(player, $user?.id, friends));
  const sent = $derived(room?.invites?.some(invite => invite.userId === player.id));
  const canSend = $derived($session.status === 'ready' && !$session.pending && room?.status === 'waiting');
</script>
{#if eligible}
  <button type="button" class="btn btn-dark btn-small" disabled={!canSend || sent} onclick={() => sendCommand('room:invite', { roomId: room.id, userId: player.id })}>{sent ? 'Invited' : 'Invite to room'}</button>
{/if}
<style>button { min-height:44px; font-family:var(--font); }</style>
