<script>
  let { username = '', size = 40 } = $props();
  const initials = $derived((username || '?').slice(0, 2).toUpperCase());
  const hue = $derived(username.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360);
</script>
<span class="player-avatar" style:--avatar-size={`${size}px`} style:--avatar-hue={hue} aria-hidden="true">{initials}</span>
<style>
  .player-avatar { display:inline-grid; place-items:center; flex:none; width:var(--avatar-size); height:var(--avatar-size); border-radius:50%; background:hsl(var(--avatar-hue) 45% 35%); color:white; font-family:var(--font); font-size:calc(var(--avatar-size) * .32); font-weight:700; line-height:1; }
</style>
