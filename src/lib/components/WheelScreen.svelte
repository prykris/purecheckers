<script>
  import { onMount } from 'svelte';
  import { gameState } from '$lib/stores/app.js';
  import { clearScreenOverride } from '$lib/stores/gameScreen.js';
  import { getSocket } from '$lib/socket.js';

  let wheelEl;
  let result = '';
  let resultColor = '';

  onMount(() => {
    const gs = $gameState;
    let pickedColor;
    if (gs?.mode === 'bot') {
      pickedColor = Math.random() < 0.5 ? 'red' : 'black';
      $gameState = { ...gs, myColor: pickedColor };
    } else {
      pickedColor = gs?.myColor || 'red';
    }

    const spins = 3 + Math.random() * 2;
    const landAngle = pickedColor === 'red' ? 210 + Math.random() * 120 : 30 + Math.random() * 120;
    const totalRotation = Math.floor(spins) * 360 + landAngle;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (wheelEl) {
          wheelEl.style.transition = 'transform 2.8s cubic-bezier(0.15, 0.6, 0.15, 1)';
          wheelEl.style.transform = `rotate(${totalRotation}deg)`;
        }
      });
    });

    setTimeout(() => {
      result = pickedColor === 'red' ? 'You are RED \u2014 you go first!' : 'You are BLACK';
      resultColor = pickedColor === 'red' ? 'var(--accent)' : 'var(--text-dim)';
    }, 3000);

    const socket = getSocket();
    if (socket && gs?.mode !== 'bot') {
      socket.once('game:start', () => { setTimeout(() => { clearScreenOverride(); }, 500); });
    }
    if (gs?.mode === 'bot') {
      setTimeout(() => { clearScreenOverride(); }, 4000);
    }
  });
</script>

<div class="page-center">
  <div class="wheel-screen">
    <h2>Picking your color...</h2>
    <div class="wheel-container">
      <div class="pointer"></div>
      <div class="wheel" bind:this={wheelEl}>
        <span class="wl wl-red">RED</span>
        <span class="wl wl-black">BLACK</span>
      </div>
    </div>
    {#if result}
      <p class="result" style="color:{resultColor}">{result}</p>
    {/if}
  </div>
</div>

<style>
  .wheel-screen { display: flex; flex-direction: column; align-items: center; gap: var(--sp-lg); }
  h2 { font-size: var(--fs-heading); color: var(--text-dim); }
  .wheel-container { position: relative; width: 180px; height: 180px; }
  .wheel {
    width: 100%; height: 100%; border-radius: 50%;
    background: conic-gradient(var(--red-piece) 0deg 180deg, var(--black-piece) 180deg 360deg);
    border: 4px solid var(--surface2); position: relative; overflow: hidden;
  }
  .wl { position: absolute; font-size: var(--fs-caption); font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .wl-red { top: 50%; right: 14%; transform: translateY(-50%); color: rgba(255,255,255,0.7); }
  .wl-black { top: 50%; left: 14%; transform: translateY(-50%); color: rgba(255,255,255,0.35); }
  .pointer {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    width: 0; height: 0;
    border-left: 11px solid transparent; border-right: 11px solid transparent;
    border-top: 20px solid var(--text); z-index: 2;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  }
  .result { font-size: var(--fs-heading); font-weight: 700; min-height: 2em; }
</style>
