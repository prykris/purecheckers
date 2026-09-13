<script>
  export let outcome = 'unknown';
</script>

<div class="artwork" class:victory={outcome === 'win'} class:defeat={outcome === 'loss'} aria-hidden="true">
  {#if ['win', 'loss', 'complete', 'draw'].includes(outcome)}
    <div class="halo"></div>
    <svg viewBox="0 0 320 320" fill="none" focusable="false">
      <circle class="orbit" cx="160" cy="160" r="140"/>
      <circle class="orbit inner" cx="160" cy="160" r="126"/>
      {#if outcome === 'draw'}
        <g class="emblem"><circle cx="132" cy="160" r="57"/><circle cx="188" cy="160" r="57"/><path d="M142 151h36m-36 18h36"/></g>
      {:else}
        <g class="emblem crown">
          <path class="crown-fill" d="m89 128 38 28 33-57 33 57 38-28-15 81H104z"/>
          <path d="m89 128 38 28 33-57 33 57 38-28-15 81H104zM105 222h110"/>
          <circle cx="89" cy="123" r="5"/><circle cx="160" cy="94" r="5"/><circle cx="231" cy="123" r="5"/>
        </g>
      {/if}
      <path class="laurel" d="M71 207q14 43 64 57m-59-45-17-6 6 18 21 8m-2-8-4-18m17 35-3-20m16 28 1-18M249 207q-14 43-64 57m59-45 17-6-6 18-21 8m2-8 4-18m-17 35 3-20m-16 28-1-18"/>
    </svg>
  {/if}
</div>

<style>
  .artwork{--result-ink:var(--text-dim);position:relative;width:100%;height:100%;overflow:hidden;pointer-events:none;}
  .victory{--result-ink:var(--gold);}.defeat{--result-ink:color-mix(in srgb,var(--accent) 45%,var(--text-dim));}
  .halo{position:absolute;inset:20% -20% -10%;background:radial-gradient(ellipse at center,color-mix(in srgb,var(--result-ink) 10%,transparent),transparent 65%);}
  svg{position:absolute;width:min(78%,360px);left:50%;top:60%;transform:translate(-50%,-50%);color:var(--result-ink);stroke:currentColor;stroke-width:1.5;}
  .orbit{opacity:.12;}.inner{stroke-dasharray:2 10;opacity:.2;}.emblem{opacity:.32;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}.crown-fill{fill:currentColor;opacity:.08;stroke:none;}.laurel{opacity:.22;stroke-linecap:round;stroke-linejoin:round;}
  .defeat .crown{transform:rotate(-16deg);transform-origin:160px 170px;opacity:.23;}
  .victory .emblem{opacity:.45;}
</style>
