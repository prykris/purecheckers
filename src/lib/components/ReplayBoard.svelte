<script>
  import { onDestroy } from 'svelte';
  import PlayerLink from './PlayerLink.svelte';
  import GameBoard from './GameBoard.svelte';
  import Icon from './table/TableIcon.svelte';
  import { replayTimeline } from '$lib/replayTimeline.js';
  import { gameEndReason, gameResultLabel, winningColor } from '../../../shared/gameResult.js';
  let { gameData, skin, perspective = 'red', initialPosition = 'start', review = false, children } = $props();
  // A replay belongs to one immutable game; callers key it by game ID.
  // svelte-ignore state_referenced_locally
  const timeline = replayTimeline(gameData.moveHistory);
  const total = timeline.frames.length - 1;
  // svelte-ignore state_referenced_locally
  let index = $state(initialPosition === 'end' ? total : 0);
  let playing = $state(false), generation = $state(0), width = $state(320), busy = $state(false);
  let timer;
  function seek(next) { playing = false; generation++; index = Math.max(0, Math.min(total, next)); }
  function step(delta) { playing = false; index = Math.max(0, Math.min(total, index + delta)); }
  function toggle() { if (playing) { playing = false; return; } if(index === total) { generation++; index = 0; } playing = total > 0; }
  $effect(() => {
    clearTimeout(timer);
    if (!playing || busy) return;
    if (index >= total) { playing = false; return; }
    timer = setTimeout(() => index++, 350);
    return () => clearTimeout(timer);
  });
  onDestroy(() => clearTimeout(timer));
  function keyboard(event) {
    if(event.altKey || event.ctrlKey || event.metaKey || event.target?.matches('input')) return;
    const keys = { ArrowLeft: () => step(-1), ArrowRight: () => step(1), Home: () => seek(0), End: () => seek(total) };
    if(keys[event.key]) { event.preventDefault(); keys[event.key](); }
  }
</script>

{#snippet board(size, toggleFocus)}
  <GameBoard snapshot={timeline.frames[index]} recovery={generation} flip={perspective === 'black'} interactive={false} maxSize={size} {skin} bind:busy readOnlyLabel={`Replay position ${index} of ${total}`} on:togglefocus={() => toggleFocus?.()} />
{/snippet}
{#snippet controls()}
  <div class="replay-controls">
    <div class="buttons">
      <button onkeydown={keyboard} onclick={() => seek(0)} disabled={index === 0} aria-label="First position"><Icon name="first" size={17}/></button>
      <button onkeydown={keyboard} onclick={() => step(-1)} disabled={index === 0} aria-label="Previous move"><Icon name="previous" size={17}/></button>
      <button class="playback" onkeydown={keyboard} onclick={toggle} disabled={!total} aria-pressed={playing}><Icon name={playing ? 'pause' : 'play'} size={15}/>{playing ? 'Pause' : 'Replay game'}</button>
      <button onkeydown={keyboard} onclick={() => step(1)} disabled={index === total} aria-label="Next move"><Icon name="arrow" size={17}/></button>
      <button onkeydown={keyboard} onclick={() => seek(total)} disabled={index === total} aria-label="Final position"><Icon name="last" size={17}/></button>
    </div>
    <label><span aria-live="polite">{index} / {total}</span><input aria-label="Replay position" type="range" min="0" max={total} value={index} oninput={event => seek(+event.currentTarget.value)}/></label>
    {#if timeline.invalidMoveIndex !== null}<p role="status">Replay unavailable from recorded step {timeline.invalidMoveIndex + 1}. Only verified moves are shown.</p>{/if}
  </div>
{/snippet}
{#snippet names()}
  <span class="names"><PlayerLink username={gameData.redPlayer} profileUrl={gameData.redProfileUrl}/> <small>vs</small> <PlayerLink username={gameData.blackPlayer} profileUrl={gameData.blackProfileUrl}/></span>
{/snippet}
{#snippet hud()}
  <span>Replay · {index} / {total}</span><button class="hud-play" onclick={toggle} disabled={!total} aria-label={playing ? 'Pause replay' : 'Play replay'}><Icon name={playing ? 'pause' : 'play'}/></button>
{/snippet}
{#if children}
  {@render children(board, controls, names, hud)}
{:else}
  <div class="replay-board" role="region" aria-label="Game replay" bind:clientWidth={width}>
    {@render names()}{@render board(width)}{@render controls()}
    {#if !review}<div class="outcome" class:win={!!winningColor(gameData.result)}><span class="outcome-result">{gameResultLabel(gameData.result, {red:gameData.redPlayer,black:gameData.blackPlayer})}</span><span class="outcome-reason">{gameEndReason(gameData.endReason,gameData.result)}</span></div>{/if}
  </div>
{/if}
<style>
  .replay-board{display:flex;flex-direction:column;gap:10px;width:100%;max-width:640px;min-width:0;}.names{font-size:12px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;font-weight:600;}.names small{font-weight:400;color:var(--text-dim);}.replay-controls{width:100%;min-width:0;}.buttons{display:flex;gap:4px;}.buttons button,.hud-play{display:flex;align-items:center;justify-content:center;gap:6px;min-width:32px;min-height:36px;background:var(--surface);color:var(--text);border:1px solid var(--surface2);border-radius:7px;font-size:11px;cursor:pointer;}.buttons button:disabled,.hud-play:disabled{opacity:.35;cursor:default;}.playback{flex:1;}.replay-controls label{display:flex;align-items:center;gap:10px;font-size:10px;color:var(--text-dim);height:24px;}.replay-controls label span{min-width:38px;font-variant-numeric:tabular-nums;}.replay-controls input{width:100%;min-width:0;accent-color:var(--accent);}.replay-controls p,.outcome{font-size:11px;color:var(--text-dim);}.hud-play{border:0;background:none;width:38px;}
  .outcome{display:flex;flex-direction:column;gap:4px;text-align:center;}.outcome.win .outcome-result{color:var(--success);}
</style>
