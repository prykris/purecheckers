<script>
  import { onMount, onDestroy } from 'svelte';
  import { gameState } from '$lib/stores/app.js';
  import { clearScreenOverride } from '$lib/stores/gameScreen.js';

  let wheelEl;
  let result = '';
  let resultColor = '';
  let skipped = false;
  let gameStartReceived = false;
  let pickedColor = 'red';

  function skip() {
    if (skipped) return;
    skipped = true;
    // Snap wheel to final position instantly
    if (wheelEl) {
      wheelEl.style.transition = 'none';
    }
    // Show result immediately
    result = pickedColor === 'red' ? 'You are RED \u2014 you go first!' : 'You are BLACK';
    resultColor = pickedColor === 'red' ? 'var(--accent)' : 'var(--text-dim)';
    // If game:start already arrived, transition immediately
    if (gameStartReceived) {
      clearScreenOverride();
    }
    // Otherwise wait for game:start (bot mode has a short timeout)
  }

  function onKeyDown(e) {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      skip();
    }
  }

  onMount(() => {
    const gs = $gameState;
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

    // Show result after spin
    setTimeout(() => {
      if (skipped) return;
      result = pickedColor === 'red' ? 'You are RED \u2014 you go first!' : 'You are BLACK';
      resultColor = pickedColor === 'red' ? 'var(--accent)' : 'var(--text-dim)';
    }, 3000);

    // Game starts immediately on server — wheel is just visual.
    // Auto-clear after animation finishes (3.5s for spin + 0.5s to read result)
    gameStartReceived = true;
    setTimeout(() => {
      if (!skipped) clearScreenOverride();
    }, 4000);

    window.addEventListener('keydown', onKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
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
    <!-- Always present to prevent layout shift, visibility controlled by opacity -->
    <p class="result" style="color:{resultColor}; opacity:{result ? 1 : 0}">{result || '\u00a0'}</p>
    <button class="skip-btn" on:click={skip} class:hidden={skipped}>
      Skip
      <span class="skip-hint">Space</span>
    </button>
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
  .result { font-size: var(--fs-heading); font-weight: 700; min-height: 2em; transition: opacity 0.3s ease; text-align: center; }
  .skip-btn {
    display: flex; align-items: center; gap: var(--sp-xs);
    background: none; border: 1px solid var(--surface2); color: var(--text-dim);
    font-family: var(--font); font-size: var(--fs-caption);
    padding: var(--sp-xs) var(--sp-md); border-radius: var(--radius-pill);
    cursor: pointer; transition: color 0.15s, border-color 0.15s, opacity 0.2s;
  }
  .skip-btn:hover { color: var(--text); border-color: var(--text-dim); }
  .skip-btn.hidden { opacity: 0; pointer-events: none; }
  .skip-hint {
    font-size: 0.55rem; color: var(--text-dim); background: var(--surface2);
    padding: 1px 4px; border-radius: 3px;
  }
</style>
