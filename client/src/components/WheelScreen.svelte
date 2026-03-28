<script>
  import { onMount } from 'svelte';
  import { screen, gameState } from '../stores/app.js';
  import { getSocket } from '../lib/socket.js';

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

    // Spin animation
    const spins = 3 + Math.random() * 2;
    let landAngle;
    if (pickedColor === 'red') {
      landAngle = 210 + Math.random() * 120;
    } else {
      landAngle = 30 + Math.random() * 120;
    }
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
      if (pickedColor === 'red') {
        result = 'You are RED \u2014 you go first!';
        resultColor = '#e94560';
      } else {
        result = 'You are BLACK';
        resultColor = '#aaa';
      }
    }, 3000);

    // Listen for game:start (online games)
    const socket = getSocket();
    if (socket && gs?.mode !== 'bot') {
      socket.once('game:start', () => {
        setTimeout(() => { $screen = 'game'; }, 500);
      });
    }

    // Bot games go straight to game after delay
    if (gs?.mode === 'bot') {
      setTimeout(() => { $screen = 'game'; }, 4000);
    }
  });
</script>

<div class="wheel-screen">
  <h2 class="wheel-title">Picking your color...</h2>
  <div class="wheel-container">
    <div class="wheel-pointer"></div>
    <div class="color-wheel" bind:this={wheelEl}>
      <span class="wlabel wlabel-red">RED</span>
      <span class="wlabel wlabel-black">BLACK</span>
    </div>
  </div>
  {#if result}
    <p class="result" style="color: {resultColor}">{result}</p>
  {/if}
</div>

<style>
  .wheel-screen { display: flex; flex-direction: column; align-items: center; gap: 24px; }
  .wheel-title { font-size: 1.3rem; color: var(--text-dim); }
  .wheel-container { position: relative; width: 180px; height: 180px; }
  .color-wheel {
    width: 100%; height: 100%;
    border-radius: 50%;
    background: conic-gradient(var(--red-piece) 0deg 180deg, var(--black-piece) 180deg 360deg);
    border: 4px solid var(--surface2);
    position: relative;
    overflow: hidden;
  }
  .wlabel {
    position: absolute;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .wlabel-red { top: 50%; right: 14%; transform: translateY(-50%); color: rgba(255,255,255,0.7); }
  .wlabel-black { top: 50%; left: 14%; transform: translateY(-50%); color: rgba(255,255,255,0.35); }
  .wheel-pointer {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    width: 0; height: 0;
    border-left: 11px solid transparent;
    border-right: 11px solid transparent;
    border-top: 20px solid var(--text);
    z-index: 2;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  }
  .result { font-size: 1.4rem; font-weight: 700; min-height: 2em; }
</style>
