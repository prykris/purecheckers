<script>
  import PlayerLink from './PlayerLink.svelte';
  let { friends, children } = $props();
</script>
<div class="friend-list">
  {#each friends as friend (friend.friendshipId)}
    <div class="card friend-row">
      <span class="status-dot" class:online={friend.status === 'online'} class:in-game={friend.status === 'in-game'}></span>
      <span class="name"><PlayerLink username={friend.username} profilePublic={friend.profilePublic}/></span>
      <span class="detail">ELO {friend.elo}</span>
      <span class="status">{friend.status}</span>
      {@render children(friend)}
    </div>
  {/each}
</div>
<style>
  .friend-list { display:grid; gap:var(--sp-sm); width:100%; }
  .friend-row { display:flex; align-items:center; flex-wrap:wrap; gap:var(--sp-sm); padding:var(--sp-sm) var(--sp-md); }
  .status-dot { width:8px; height:8px; border-radius:50%; background:var(--text-dim); flex-shrink:0; }
  .status-dot.online { background:var(--success); }
  .status-dot.in-game { background:var(--warning); }
  .name { font-weight:600; font-size:var(--fs-body); overflow-wrap:anywhere; }
  .detail, .status { color:var(--text-dim); font-size:var(--fs-caption); }
  .status { margin-left:auto; }
</style>
