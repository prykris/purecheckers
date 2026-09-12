<script>
  import { tick } from 'svelte';
  import Icon from './TableIcon.svelte';
  import Modal from '../Modal.svelte';
  export let moves = [], ratings = {};
  export function show() { selected = Math.max(0,moves.length-1); }
  let selected = null, strip, previousLength = 0;
  $: if(moves.length !== previousLength) { previousLength = moves.length; tick().then(() => { if(strip) strip.scrollLeft = strip.scrollWidth; }); }
  const labels = {best:'Best',good:'Good',inaccuracy:'Inaccuracy',blunder:'Blunder'};
  $: details = selected === null ? null : moves[selected];
  function ratingAt(index) { return ratings[moves.slice(0,index+1).reduce((n,move)=>n+move.hops.length,0)]; }
</script>
<div class="move-history"><button class="history-icon" aria-label="Open move history" on:click={() => selected = Math.max(0,moves.length-1)}><Icon name="history" size={18}/></button><div class="strip" bind:this={strip}>
  {#each moves as move,index}<button on:click={() => selected = index} aria-label={`Move ${move.num}: ${move.notation}`}><i class={move.color}></i><span>{move.num}. <strong>{move.notation}</strong></span>{#if ratingAt(index)}<small>{labels[ratingAt(index).rating]}</small>{/if}</button>{/each}
  {#if !moves.length}<span class="empty">Moves appear here</span>{/if}
</div></div>
{#if selected !== null}<Modal label="Move history" on:close={() => selected = null}><div class="details"><h2>Move history</h2><div class="all-moves">{#each moves as move,index}<button class:selected={selected === index} on:click={() => selected = index}>{move.num}. {move.notation}</button>{/each}</div>
  {#if details}<h3>{details.notation}</h3><p>{details.color === 'red' ? 'Red' : 'Black'} · {details.captured.length} captured{details.promoted ? ' · Crowned' : ''}</p>{#if ratingAt(selected)}<strong>{labels[ratingAt(selected).rating]}</strong>{/if}{:else}<p>No moves yet.</p>{/if}
  <button class="btn btn-dark" on:click={() => selected = null}>Close</button></div></Modal>{/if}
<style>
  .move-history{display:flex;align-items:center;gap:6px;min-width:0;height:38px;border-bottom:1px solid var(--surface2);}.strip{display:flex;align-items:center;gap:10px;overflow-x:auto;scrollbar-width:none;min-width:0;}.strip button,.history-icon{display:flex;align-items:center;gap:5px;flex:none;border:0;background:none;color:var(--text-dim);padding:4px 0;min-height:32px;cursor:pointer;font-size:10px;}.history-icon{width:30px;flex:none;}.strip strong{color:var(--text);font-weight:500;}.strip small{color:var(--gold);}.strip i{width:6px;height:6px;border-radius:50%;background:var(--text-dim);}.strip i.red{background:var(--accent);}.empty{font-size:10px;color:var(--text-dim);}.details{padding:20px;display:flex;flex-direction:column;gap:12px;}.details h2{font-size:18px;}.details p{font-size:12px;color:var(--text-dim);}.all-moves{display:flex;flex-wrap:wrap;gap:5px;max-height:35dvh;overflow-y:auto;}.all-moves button{border:1px solid var(--surface2);background:var(--surface);color:var(--text-dim);border-radius:6px;padding:7px;font-size:11px;cursor:pointer;}.all-moves .selected{border-color:var(--accent);color:var(--text);}
</style>
