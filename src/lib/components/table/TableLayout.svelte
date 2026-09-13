<script>
  import { onMount } from 'svelte';
  import { tableLayout } from '$lib/tableLayout.js';
  import Icon from './TableIcon.svelte';
  export let finished = false, focused = false, arrival = false, yourTurn = false;
  export let chatOpen = false, hasChat = true, unread = 0;
  let element, chatElement, width = 390, height = 844;
  $: layout = tableLayout(width, height, { finished, focused });
  $: inlineChat = ['roomy','landscape','desktop','stacked'].includes(layout.mode);
  $: chatVisible = hasChat && !focused && (inlineChat || chatOpen);
  $: if (finished) focused = false;
  function toggleFocus() { focused = !focused; chatOpen = false; }
  function keydown(event) { if(event.key === 'Escape' && !document.querySelector('dialog[open]')) { focused = false; chatOpen = false; } }
  onMount(() => {
    const initial = getComputedStyle(element);
    width = element.clientWidth - parseFloat(initial.paddingLeft) - parseFloat(initial.paddingRight);
    height = element.clientHeight - parseFloat(initial.paddingTop) - parseFloat(initial.paddingBottom);
    const observer = new ResizeObserver(([entry]) => {
      // Keep a focused composer mounted and visible when the keyboard reduces space.
      if (chatElement?.contains(document.activeElement)) chatOpen = true;
      width = entry.contentRect.width; height = entry.contentRect.height;
    });
    observer.observe(element); return () => observer.disconnect();
  });
</script>
<svelte:window on:keydown={keydown}/>
<div class="table" bind:this={element} data-layout={layout.mode} class:finished class:focused style={`--board-size:${layout.board}px;--rail:${layout.rail}px`}>
  <header class="toolbar"><slot name="toolbar"/><div class="tools"><slot name="tools"/><button class="icon" on:click={toggleFocus} aria-label="Enter focus mode" title="Focus mode"><Icon name="expand" size={18}/></button></div></header>
  <div class="play-zone">
    {#if !finished}<div class="opponent"><slot name="opponent"/></div>{/if}
    <div class="board-stage"><div class="board-frame" class:yourTurn class:arrival={focused && arrival}><slot name="board" boardSize={layout.board} {toggleFocus}/></div></div>
    {#if !finished}<div class="self"><slot name="self"/></div>
    {:else}<div class="replay-transport"><slot name="history"/></div>{/if}
  </div>
  {#if finished}<div class="result-decoration" aria-hidden="true"><slot name="decoration"/></div><div class="summary"><slot name="summary"/></div>{/if}
  {#if !finished}<div class="history"><slot name="history"/></div>{/if}
  {#if hasChat && !finished}<div class="chat" bind:this={chatElement} class:docked={!inlineChat && chatOpen} class:hidden={!chatVisible} inert={!chatVisible}>
    {#if !inlineChat}<button class="close-chat" on:click={() => chatOpen = false} aria-label="Close chat"><Icon name="close" size={18}/></button>{/if}
    <slot name="chat" visible={chatVisible}/>
  </div>{/if}
  <div class="actions">
    <slot name="actions"/>
    {#if hasChat && !finished && !inlineChat}<button class="chat-shortcut" on:click={() => chatOpen = !chatOpen} aria-expanded={chatOpen}><Icon name="chat" size={17}/>Chat {unread || ''}</button>{/if}
  </div>
  {#if focused}<div class="focus-hud"><slot name="hud"/><button class="icon" on:click={toggleFocus} aria-label="Exit focus mode" title="Exit focus mode"><Icon name="collapse"/></button></div>{/if}
</div>
<style>
  .table{position:relative;width:100%;height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;color:var(--text);background:var(--bg);overflow:hidden;}
  .toolbar{flex:none;display:flex;align-items:center;justify-content:space-between;height:38px;padding:0 10px;gap:8px;font-size:11px;color:var(--text-dim);}.tools{display:flex;align-items:center;gap:2px;}.icon,.close-chat{display:grid;place-items:center;width:38px;height:38px;padding:0;border:0;background:none;color:var(--text-dim);cursor:pointer;flex:none;}
  .play-zone{position:relative;isolation:isolate;flex:none;display:flex;flex-direction:column;width:calc(var(--board-size) + 6px);max-width:100%;align-self:center;border-radius:14px;background:linear-gradient(120deg,var(--surface2),var(--surface));box-shadow:inset 0 1px color-mix(in srgb,var(--text) 15%,transparent),0 6px 12px #0003;}
  .opponent,.self{flex:none;min-height:var(--seat-height,52px);}.opponent{border-radius:14px 14px 0 0;}.self{border-radius:0 0 14px 14px;}.board-stage{display:grid;place-items:center;min-width:0;}.board-frame{position:relative;padding:2px;border:1px solid var(--surface2);width:calc(var(--board-size) + 6px);height:calc(var(--board-size) + 6px);line-height:0;}.board-frame :global(canvas){border-radius:0;box-shadow:none;}
  .summary{flex:none;padding:8px 12px;order:0;}.history{flex:none;min-width:0;padding:4px 10px;order:2;}.chat{flex:1;min-height:0;margin:4px 10px;order:3;}.actions{display:flex;align-items:center;flex-wrap:wrap;justify-content:space-between;gap:6px;padding:4px 10px;flex:0 1 auto;min-height:44px;order:4;max-height:25%;overflow-y:auto;}.actions :global(.table-action){background:none;border:0;color:var(--text-dim);font-size:11px;min-height:38px;display:flex;align-items:center;gap:6px;cursor:pointer;}.chat-shortcut{display:flex;align-items:center;gap:5px;background:none;color:var(--text-dim);border:0;min-height:38px;font-size:11px;cursor:pointer;}
  .hidden{display:none;}.chat.docked{position:absolute;z-index:8;bottom:0;left:0;right:0;height:min(340px,65%);margin:0;padding:4px 8px 10px;background:var(--surface);border:1px solid var(--surface2);border-radius:16px 16px 0 0;box-shadow:0 -12px 50px #0005;}.close-chat{margin-left:auto;height:30px;}.docked :global(.chat-panel){height:calc(100% - 30px);}
  [data-layout=compact]{--seat-height:36px;--avatar-size:27px;}[data-layout=focus]{--seat-height:32px;--avatar-size:25px;}[data-layout=compact] .toolbar{height:30px;}[data-layout=focus] .toolbar{height:26px;}[data-layout=focus]:not(.finished) .history{display:none;}[data-layout=focus] .actions,[data-layout=compact] .actions{margin-top:auto;}
  [data-layout=landscape]{display:grid;grid-template-columns:calc(var(--board-size) + 6px + var(--rail)) minmax(0,1fr);grid-template-rows:38px auto minmax(0,1fr) auto;column-gap:12px;}
  [data-layout=landscape] .play-zone{width:calc(var(--board-size) + 6px + var(--rail));max-width:none;grid-column:1;grid-row:1/-1;display:grid;grid-template-columns:var(--rail) auto;grid-template-rows:1fr 1fr;align-self:center;}
  [data-layout=landscape] .opponent{grid-column:1;grid-row:1;}[data-layout=landscape] .self{grid-column:1;grid-row:2;border-radius:0 0 0 14px;}[data-layout=landscape] .board-stage{grid-column:2;grid-row:1/-1;}
  [data-layout=landscape] .toolbar{grid-column:2;grid-row:1;}[data-layout=landscape] .history{grid-column:2;grid-row:2;}[data-layout=landscape] .chat{grid-column:2;grid-row:3;}[data-layout=landscape] .actions{grid-column:2;grid-row:4;max-height:110px;}
  [data-layout=stacked]{--seat-height:56px;--avatar-size:36px;align-items:center;}
  [data-layout=stacked] .toolbar,[data-layout=stacked] .history,[data-layout=stacked] .chat,[data-layout=stacked] .actions,[data-layout=stacked] .summary{width:calc(var(--board-size) + 6px);max-width:100%;}
  [data-layout=stacked] .toolbar{height:44px;}[data-layout=stacked] .chat{width:calc(var(--board-size) - 14px);}
  [data-layout=desktop]{--seat-height:56px;--avatar-size:36px;display:grid;grid-template-columns:calc(var(--board-size) + 6px) clamp(260px,28%,360px);grid-template-rows:44px auto minmax(0,1fr) auto;column-gap:24px;justify-content:center;align-content:center;}
  [data-layout=desktop] .play-zone{grid-column:1;grid-row:1/-1;align-self:center;}
  [data-layout=desktop] .toolbar{grid-column:2;grid-row:1;height:44px;}
  [data-layout=desktop] .history{grid-column:2;grid-row:2;}
  [data-layout=desktop] .chat{grid-column:2;grid-row:3;}
  [data-layout=desktop] .actions{grid-column:2;grid-row:4;max-height:180px;}
  /* A single centered content column aligns the live sidebar from toolbar to composer. */
  :is([data-layout=landscape],[data-layout=desktop]):not(.focused):not(.finished) :is(.toolbar,.history,.actions){width:100%;max-width:520px;justify-self:center;}
  :is([data-layout=landscape],[data-layout=desktop]):not(.focused):not(.finished) .chat{width:calc(100% - 20px);max-width:500px;justify-self:center;margin:4px 0;}
  /* Results form a video player: the transport belongs to the board, not the sidebar. */
  .finished[data-layout]{display:grid;grid-template-columns:1fr;grid-template-rows:38px auto auto minmax(0,1fr);grid-template-areas:"toolbar" "summary" "player" "actions";align-content:start;align-items:stretch;gap:0;}
  .finished[data-layout] .toolbar{grid-area:toolbar;height:38px;}
  .finished[data-layout] .summary{grid-area:summary;}
  .finished[data-layout] .play-zone{grid-area:player;display:flex;flex-direction:column;align-self:start;width:calc(var(--board-size) + 6px);max-width:100%;border-radius:0;background:none;box-shadow:none;}
  .finished[data-layout] .board-stage{display:block;}
  .replay-transport{width:100%;padding:4px 0;min-height:68px;}
  .finished[data-layout] .actions{display:flex;flex-direction:column;flex-wrap:nowrap;align-items:stretch;justify-content:flex-start;gap:10px;grid-area:actions;align-self:stretch;align-content:start;max-height:none;min-height:0;margin-top:0;overflow-y:auto;padding:10px 0;}
  .finished[data-layout] .toolbar,.finished[data-layout] .summary,.finished[data-layout] .actions{width:calc(var(--board-size) + 6px);max-width:100%;justify-self:center;}
  .finished[data-layout] .play-zone{justify-self:center;}
  .finished:is([data-layout=landscape],[data-layout=desktop]){grid-template-columns:calc(var(--board-size) + 6px) minmax(0,1fr);grid-template-rows:38px auto minmax(0,1fr);grid-template-areas:"player toolbar" "player summary" "player actions";column-gap:16px;}
  .finished:is([data-layout=landscape],[data-layout=desktop]) .play-zone{align-self:center;}
  .finished:is([data-layout=landscape],[data-layout=desktop]) .toolbar,.finished:is([data-layout=landscape],[data-layout=desktop]) .summary,.finished:is([data-layout=landscape],[data-layout=desktop]) .actions{width:100%;}
  .finished:is([data-layout=landscape],[data-layout=desktop]) .actions{padding:12px 10px;}
  .finished[data-layout=desktop]{grid-template-columns:calc(var(--board-size) + 6px) clamp(260px,28%,360px);column-gap:24px;}
  .result-decoration{display:none;}
  .finished:is([data-layout=landscape],[data-layout=desktop]) .result-decoration{display:block;grid-column:2;grid-row:2/-1;min-height:0;min-width:0;pointer-events:none;}
  .finished[data-layout] :is(.summary,.actions){position:relative;}
  .finished[data-layout] .summary{text-align:center;}
  .finished[data-layout] .summary :global(.verdict-row){justify-content:center;}
  .finished:is([data-layout=landscape],[data-layout=desktop]) :is(.toolbar,.summary,.actions){max-width:520px;}
  .finished:is([data-layout=landscape],[data-layout=desktop]) .summary{padding:16px 12px 12px;}
  .board-frame{view-transition-name:game-board;}
  :global(::view-transition-group(game-board)){animation-duration:480ms;animation-timing-function:cubic-bezier(.22,.68,.2,1);}
  :global(::view-transition-old(game-board)),:global(::view-transition-new(game-board)){animation:none;mix-blend-mode:normal;height:100%;}
  .focused[data-layout]{display:grid;grid-template-columns:1fr;grid-template-rows:auto 44px;align-content:center;gap:0;}.focused[data-layout] .play-zone{display:contents;}.focused[data-layout] .toolbar,.focused[data-layout] .opponent,.focused[data-layout] .self,.focused[data-layout] .summary,.focused[data-layout] .history,.focused[data-layout] .chat,.focused[data-layout] .actions{display:none;}.focused[data-layout] .board-stage{grid-column:1;grid-row:1;}
  .focus-hud{grid-column:1;grid-row:2;justify-self:center;width:calc(var(--board-size) + 6px);max-width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 8px;font-size:12px;color:var(--text-dim);}.focus-hud :global(.hud-clock){font-variant-numeric:tabular-nums;font-size:16px;}.focused .yourTurn{border-color:var(--gold);}.focused .arrival{animation:handoff 1.8s ease-out both;}
  .focused[data-layout=landscape]{grid-template-columns:calc(var(--board-size) + 6px) minmax(84px,1fr);grid-template-rows:1fr;}.focused[data-layout=landscape] .focus-hud{grid-column:2;grid-row:1;align-self:center;flex-direction:column;width:100%;text-align:center;gap:18px;}
  @keyframes handoff{20%{box-shadow:0 0 20px color-mix(in srgb,var(--gold) 50%,transparent);}}@media(prefers-reduced-motion:reduce){.arrival{animation:none;}}
</style>
