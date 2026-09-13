<script>
  import PlayerLink from './PlayerLink.svelte';
  import { session, sendCommand, serverNow } from '$lib/stores/session.js';
  $: invitations = $session.snapshot?.invitations ?? [];
  $: canSend = $session.status === 'ready' && !$session.pending;
  $: canJoin = canSend && $session.snapshot?.phase === 'idle';
</script>

{#if invitations.length}
  <section class="invitations card" aria-label="Game invitations">
    <h3>Game invitations</h3>
    {#each invitations as invite (invite.roomId)}
      <div class="invitation">
        <p><strong><PlayerLink username={invite.hostName} /></strong> invited you to play. {invite.buyIn ? `${invite.buyIn} coins` : 'No buy-in'} · {invite.turnTimer ? `${invite.turnTimer}s turns` : 'No clock'}.</p>
        <p class="dim">Expires in {Math.max(0, Math.ceil((invite.expiresAt - ($serverNow ?? invite.expiresAt)) / 1000))} seconds.</p>
        <button class="btn btn-primary btn-small" disabled={!canJoin || $serverNow >= invite.expiresAt}
          on:click={() => sendCommand('room:join', { code: invite.code })}>Accept</button>
        <button class="btn btn-dark btn-small" disabled={!canSend}
          on:click={() => sendCommand(invite.kind === 'room' ? 'room:invite-decline' : 'challenge:decline', { roomId: invite.roomId })}>Decline</button>
      </div>
    {/each}
    {#if !canJoin && canSend}<p>Finish your game or leave your room to accept.</p>{/if}
  </section>
{/if}

<style>
  .invitations { width: 100%; display: grid; gap: var(--sp-sm); padding: var(--sp-md); }
  .invitation { display: flex; flex-wrap: wrap; gap: var(--sp-sm); }
  p { width: 100%; font-size: var(--fs-caption); }
  .dim { color: var(--text-dim); }
</style>
