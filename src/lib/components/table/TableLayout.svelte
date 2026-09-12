<script>
  import { onMount } from 'svelte';
  import { tableLayout } from '$lib/tableLayout.js';
  import Icon from './TableIcon.svelte';
  export let finished = false, focused = false, arrival = false, yourTurn = false;
  export let chatOpen = false, hasChat = true, unread = 0;
  let element, chatElement, width = 390, height = 844;
  $: layout = tableLayout(width, height, { finished, focused });
  $: inlineChat = layout.mode === 'roomy' || layout.mode === 'landscape';
  $: chatVisible = hasChat && !focused && (inlineChat || chatOpen);
  $: if (finished) focused = false;
  function toggleFocus() { focused = !focused; chatOpen = false; }
  function keydown(event) { if(event.key === 'Escape' && !document.querySelector('dialog[open]')) { focused = false; chatOpen = false; } }
  onMount(() => {
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
    {#if !finished}<div class="self"><slot name="self"/></div>{/if}
  </div>
  {#if finished}<div class="summary"><slot name="summary"/></div>{/if}
  <div class="history"><slot name="history"/></div>
  <div class="chat" bind:this={chatElement} class:docked={!inlineChat && chatOpen} class:hidden={!chatVisible} inert={!chatVisible}>
    {#if !inlineChat}<button class="close-chat" on:click={() => chatOpen = false} aria-label="Close chat"><Icon name="close" size={18}/></button>{/if}
    <slot name="chat" visible={chatVisible}/>
  </div>
  <div class="actions">
    <slot name="actions"/>
    {#if hasChat && !inlineChat}<button class="chat-shortcut" on:click={() => chatOpen = !chatOpen} aria-expanded={chatOpen}><Icon name="chat" size={17}/>Chat {unread || ''}</button>{/if}
  </div>
  {#if focused}<div class="focus-hud"><slot name="hud"/><button class="icon" on:click={toggleFocus} aria-label="Exit focus mode" title="Exit focus mode"><Icon name="collapse"/></button></div>{/if}
</div>
<style>
  .table{position:relative;width:100%;height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;color:var(--text);background:var(--bg);overflow:hidden;}
  .toolbar{flex:none;display:flex;align-items:center;justify-content:space-between;height:38px;padding:0 10px;gap:8px;font-size:11px;color:var(--text-dim);}.tools{display:flex;align-items:center;gap:2px;}.icon,.close-chat{display:grid;place-items:center;width:38px;height:38px;padding:0;border:0;background:none;color:var(--text-dim);cursor:pointer;flex:none;}
  .play-zone{position:relative;isolation:isolate;flex:none;display:flex;flex-direction:column;width:100%;border-radius:14px;background:linear-gradient(120deg,var(--surface2),var(--surface));box-shadow:inset 0 1px color-mix(in srgb,var(--text) 15%,transparent),0 6px 12px #0003;}
  .self{border-radius:0 0 14px 14px;}.board-stage{display:grid;place-items:center;min-width:0;}.board-frame{position:relative;padding:2px;border:1px solid var(--surface2);width:calc(var(--board-size) + 6px);height:calc(var(--board-size) + 6px);line-height:0;}.board-frame :global(canvas){border-radius:0;box-shadow:none;}
  .summary{flex:none;padding:8px 12px;order:0;}.finished .play-zone{order:1;}.history{flex:none;min-width:0;padding:4px 10px;order:2;}.chat{flex:1;min-height:0;margin:4px 10px;order:3;}.actions{display:flex;align-items:center;flex-wrap:wrap;justify-content:space-between;gap:6px;padding:4px 10px;flex:0 1 auto;min-height:44px;order:4;max-height:25%;overflow-y:auto;}.actions :global(.table-action){background:none;border:0;color:var(--text-dim);font-size:11px;min-height:38px;display:flex;align-items:center;gap:6px;cursor:pointer;}.chat-shortcut{display:flex;align-items:center;gap:5px;background:none;color:var(--text-dim);border:0;min-height:38px;font-size:11px;cursor:pointer;}
  .hidden{display:none;}.chat.docked{position:absolute;z-index:8;bottom:0;left:0;right:0;height:min(340px,65%);margin:0;padding:4px 8px 10px;background:var(--surface);border:1px solid var(--surface2);border-radius:16px 16px 0 0;box-shadow:0 -12px 50px #0005;}.close-chat{margin-left:auto;height:30px;}.docked :global(.chat-panel){height:calc(100% - 30px);}
  [data-layout=compact]{--seat-height:36px;--avatar-size:27px;}[data-layout=focus]{--seat-height:32px;--avatar-size:25px;}[data-layout=compact] .toolbar{height:30px;}[data-layout=focus] .toolbar{height:26px;}[data-layout=focus]:not(.finished) .history{display:none;}[data-layout=focus] .actions,[data-layout=compact] .actions{margin-top:auto;}
  [data-layout=landscape]{display:grid;grid-template-columns:calc(var(--board-size) + 6px + var(--rail)) minmax(0,1fr);grid-template-rows:38px auto minmax(0,1fr) auto;column-gap:12px;}
  [data-layout=landscape] .play-zone{grid-column:1;grid-row:1/-1;display:grid;grid-template-columns:var(--rail) auto;grid-template-rows:1fr 1fr;align-self:center;}
  [data-layout=landscape] .opponent{grid-column:1;grid-row:1;}[data-layout=landscape] .self{grid-column:1;grid-row:2;border-radius:0 0 0 14px;}[data-layout=landscape] .board-stage{grid-column:2;grid-row:1/-1;}
  [data-layout=landscape] .toolbar{grid-column:2;grid-row:1;}[data-layout=landscape] .history{grid-column:2;grid-row:2;}[data-layout=landscape] .chat{grid-column:2;grid-row:3;}[data-layout=landscape] .actions{grid-column:2;grid-row:4;max-height:110px;}
  .finished[data-layout=landscape]{grid-template-rows:34px auto auto minmax(0,1fr) auto;}.finished[data-layout=landscape] .play-zone{display:contents;}.finished[data-layout=landscape] .board-stage{grid-column:1;grid-row:1/-1;}.finished[data-layout=landscape] .summary{grid-column:2;grid-row:2;}.finished[data-layout=landscape] .history{grid-row:3;}.finished[data-layout=landscape] .chat{grid-row:4;}.finished[data-layout=landscape] .actions{grid-row:5;max-height:130px;}
  .finished[data-layout=focus] .summary{padding:3px 10px;}
  .focused[data-layout]{display:grid;grid-template-columns:1fr;grid-template-rows:auto 44px;align-content:center;gap:0;}.focused[data-layout] .play-zone{display:contents;}.focused[data-layout] .toolbar,.focused[data-layout] .opponent,.focused[data-layout] .self,.focused[data-layout] .summary,.focused[data-layout] .history,.focused[data-layout] .chat,.focused[data-layout] .actions{display:none;}.focused[data-layout] .board-stage{grid-column:1;grid-row:1;}
  .focus-hud{grid-column:1;grid-row:2;justify-self:center;width:calc(var(--board-size) + 6px);max-width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 8px;font-size:12px;color:var(--text-dim);}.focus-hud :global(.hud-clock){font-variant-numeric:tabular-nums;font-size:16px;}.focused .yourTurn{border-color:var(--gold);}.focused .arrival{animation:handoff 1.8s ease-out both;}
  .focused[data-layout=landscape]{grid-template-columns:calc(var(--board-size) + 6px) minmax(84px,1fr);grid-template-rows:1fr;}.focused[data-layout=landscape] .focus-hud{grid-column:2;grid-row:1;align-self:center;flex-direction:column;width:100%;text-align:center;gap:18px;}
  @keyframes handoff{20%{box-shadow:0 0 20px color-mix(in srgb,var(--gold) 50%,transparent);}}@media(prefers-reduced-motion:reduce){.arrival{animation:none;}}
</style>
