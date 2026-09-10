<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { REVEAL_TIMING, wheelRotation } from '$lib/colorReveal.js';

  // The server has already assigned `color`. This overlay only shows it.
  // `acked` comes from the snapshot: true when this player already reported done
  // (for example after a reconnect), so the wheel must not spin again.
  export let color = 'red';
  export let opponentName = 'Opponent';
  export let acked = false;
  export let waiting = false;
  export let failed = false;

  const dispatch = createEventDispatcher();
  let wheelEl, showResult = acked, reported = acked, skipped = false, reducedMotion = false;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function finish() {
    if (reported) return;
    reported = true; showResult = true;
    dispatch('done');
  }
  function skip() {
    if (skipped || reported) return;
    skipped = true;
    if (wheelEl) { wheelEl.style.transition = 'none'; }
    finish();
  }
  function onKeyDown(event) {
    if ([' ', 'Enter', 'Escape'].includes(event.key)) { event.preventDefault(); skip(); }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown);
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rotation = wheelRotation(color);
    if (acked) { if (wheelEl) wheelEl.style.transform = `rotate(${rotation}deg)`; return; } // already reported: rest on the colour
    if (reducedMotion) {
      if (wheelEl) wheelEl.style.transform = `rotate(${rotation}deg)`;
      showResult = true;
      later(finish, REVEAL_TIMING.reducedMotion);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!wheelEl) return;
      wheelEl.style.transition = `transform ${REVEAL_TIMING.spin}ms cubic-bezier(0.15, 0.6, 0.15, 1)`;
      wheelEl.style.transform = `rotate(${rotation}deg)`;
    }));
    later(() => { if (!skipped) showResult = true; }, REVEAL_TIMING.spin + REVEAL_TIMING.settle);
    later(finish, REVEAL_TIMING.spin + REVEAL_TIMING.settle + REVEAL_TIMING.read);
  });
  onDestroy(() => { window.removeEventListener('keydown', onKeyDown); timers.forEach(clearTimeout); });
</script>

<div class="reveal" role="status" aria-live="polite">
  <h2>{showResult ? 'Colours chosen' : 'Choosing colours…'}</h2>
  <div class="wheel-container" aria-hidden="true">
    <div class="pointer"></div>
    <div class="wheel" bind:this={wheelEl}>
      <span class="wl wl-red">RED</span>
      <span class="wl wl-black">BLACK</span>
    </div>
  </div>
  <p class="result" class:red={color === 'red'} class:visible={showResult}>
    {color === 'red' ? 'You are RED — you go first!' : 'You are BLACK'}
  </p>
  {#if failed}
    <button class="btn btn-primary btn-small" on:click={() => dispatch('done')}>Continue</button>
  {:else if waiting || reported}
    <p class="waiting">Waiting for {opponentName}…</p>
  {:else}
    <button class="skip-btn" on:click={skip}>Skip <span class="skip-hint">Space</span></button>
  {/if}
</div>

<style>
  .reveal { display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg); text-align: center; padding: var(--sp-md); }
  h2 { font-size: var(--fs-heading); color: var(--text-dim); margin: 0; }
  .wheel-container { position: relative; width: 180px; height: 180px; }
  .wheel {
    width: 100%; height: 100%; border-radius: 50%;
    background: conic-gradient(var(--red-piece) 0deg 180deg, var(--black-piece) 180deg 360deg);
    border: 4px solid var(--surface2); position: relative; overflow: hidden;
  }
  .wl { position: absolute; top: 50%; transform: translateY(-50%); font-size: var(--fs-caption); font-weight: 700; letter-spacing: 2px; }
  .wl-red { right: 14%; color: rgba(255,255,255,0.7); }
  .wl-black { left: 14%; color: rgba(255,255,255,0.35); }
  .pointer {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%); z-index: 2;
    width: 0; height: 0; border-left: 11px solid transparent; border-right: 11px solid transparent;
    border-top: 20px solid var(--text); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  }
  .result { font-size: var(--fs-heading); font-weight: 700; margin: 0; min-height: 1.5em; color: var(--text-dim); opacity: 0; transition: opacity 0.3s ease; }
  .result.red { color: var(--accent); }
  .result.visible { opacity: 1; }
  .waiting { margin: 0; font-size: var(--fs-caption); color: var(--text-dim); min-height: 2em; }
  .skip-btn {
    display: flex; align-items: center; gap: var(--sp-xs); min-height: 2em;
    background: none; border: 1px solid var(--surface2); color: var(--text-dim);
    font-family: var(--font); font-size: var(--fs-caption);
    padding: var(--sp-xs) var(--sp-md); border-radius: var(--radius-pill); cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .skip-btn:hover { color: var(--text); border-color: var(--text-dim); }
  .skip-hint { font-size: 0.55rem; color: var(--text-dim); background: var(--surface2); padding: 1px 4px; border-radius: 3px; }
</style>
