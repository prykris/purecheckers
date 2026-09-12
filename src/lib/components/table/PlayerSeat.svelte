<script>
  import PlayerLink from '../PlayerLink.svelte';
  export let username, color, seconds = 0, turnTime = 0, active = false, yours = false, captured = 0, arrival = false, profilePublic = true;
  $: time = turnTime ? `${Math.floor(Math.max(0, Math.ceil(seconds)) / 60)}:${String(Math.max(0, Math.ceil(seconds)) % 60).padStart(2, '0')}` : '∞';
  $: progress = turnTime ? Math.max(0, Math.min(1, seconds / turnTime)) : 1;
</script>

<div class="seat" class:active class:arrival>
  <div class="avatar {color}" aria-hidden="true">{username?.slice(0, 2).toUpperCase()}</div>
  <div class="identity"><strong><PlayerLink {username} {profilePublic} /></strong>
    <small>{#if active}<span class="turn">{yours ? 'Your turn' : 'To move'}</span>{:else}<span>{yours ? 'You' : color === 'red' ? 'Red' : 'Black'}</span>{/if}
      <span class="captures">{captured > 0 ? `+${captured} captured` : ''}</span></small>
  </div>
  <span class="clock" class:low={turnTime && seconds <= 10} aria-label={`${username}: ${time} remaining`}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" class="track"/><circle cx="12" cy="12" r="9" pathLength="1" stroke-dasharray={`${progress} 1`} /></svg>{time}
  </span>
</div>

<style>
  .seat{display:flex;align-items:center;gap:9px;min-width:0;height:var(--seat-height,52px);padding:5px 12px;position:relative;isolation:isolate;border-radius:inherit;}
  .avatar{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:var(--surface2);border:1px solid color-mix(in srgb,var(--text) 25%,transparent);}
  .avatar.red{background:color-mix(in srgb,var(--accent) 55%,var(--surface));}.identity{min-width:0;flex:1;}.identity strong{display:block;font-size:13px;overflow-wrap:anywhere;line-height:1.2;}
  small{display:flex;gap:7px;color:var(--text-dim);font-size:10px;line-height:1.4;margin-top:3px;}.clock{display:flex;align-items:center;gap:5px;font-size:16px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--text-dim);}
  svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;transform:rotate(-90deg);}.track{opacity:.2;}.active{box-shadow:inset 0 -2px var(--gold);background:color-mix(in srgb,var(--gold) 7%,transparent);}.active .avatar{outline:2px solid var(--gold);outline-offset:1px;}.active .clock,.turn{color:var(--gold);}.turn:before{content:'•';margin-right:4px;}.clock.low{color:var(--warning);}
  .arrival:before{content:'';position:absolute;inset:0;z-index:-1;border-radius:inherit;background:linear-gradient(105deg,color-mix(in srgb,var(--gold) 35%,transparent),transparent);animation:arrival 1.8s ease-out both;}
  :global([data-layout=compact]) .seat,:global([data-layout=focus]) .seat{gap:6px;padding:2px 10px;}.seat .avatar{width:var(--avatar-size,34px);height:var(--avatar-size,34px);}
  :global([data-layout=landscape]) .seat{height:100%;flex-direction:column;justify-content:center;text-align:center;padding:10px 5px;gap:10px;}
  :global([data-layout=landscape]) .identity{flex:none;max-width:100%;}:global([data-layout=landscape]) small{flex-direction:column;gap:3px;}:global([data-layout=landscape]) .active{box-shadow:inset 2px 0 var(--gold);}
  @keyframes arrival{0%{opacity:0;}18%{opacity:1;}100%{opacity:0;}}@media(prefers-reduced-motion:reduce){.arrival:before{animation:none;}}
</style>
