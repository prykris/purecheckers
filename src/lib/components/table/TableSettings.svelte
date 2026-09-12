<script>
  import { boardPreferences, toggleBoardPreference } from '$lib/stores/boardPreferences.js';
  import { muted, toggleMute } from '$lib/sounds.js';
  import BoardAppearance from '../BoardAppearance.svelte';
  const options = [['hints','Legal move hints'],['highlights','Highlight last move'],['ratings','Move rating popups'],['animations','Board animations'],['reactions','Show reactions']];
</script>
<div class="settings">
  {#each options as [key,label]}<button role="switch" aria-checked={$boardPreferences[key]} on:click={() => toggleBoardPreference(key)}><span>{label}</span><span class="switch" class:on={$boardPreferences[key]} aria-hidden="true"></span></button>{/each}
  <button role="switch" aria-checked={!$muted} on:click={toggleMute}><span>Sound</span><span class="switch" class:on={!$muted} aria-hidden="true"></span></button>
  <p>Two-finger tap the board to enter or leave Focus. Your turn and clock stay visible.</p>
  <BoardAppearance/>
</div>
<style>
  .settings{display:flex;flex-direction:column;gap:3px;}.settings button{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;min-height:46px;border:0;border-bottom:1px solid var(--surface2);background:none;color:var(--text);font-size:12px;cursor:pointer;}.switch{width:33px;height:20px;padding:3px;border-radius:20px;background:var(--surface2);flex:none;}.switch:before{content:'';display:block;width:14px;height:14px;background:var(--text-dim);border-radius:50%;}.switch.on{background:var(--accent);}.switch.on:before{transform:translateX(13px);background:var(--text);}.settings p{font-size:11px;line-height:1.6;color:var(--text-dim);margin:12px 0;}
</style>
