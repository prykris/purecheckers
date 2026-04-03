<script>
  export let open = false;
  export let side = 'left'; // 'left' | 'right'
  export let title = '';

  function close() { open = false; }
</script>

{#if open}
  <div class="backdrop" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()} role="presentation" tabindex="-1"></div>
{/if}

<div class="panel {side}" class:open>
  <div class="panel-header">
    <h3>{title}</h3>
    <button class="close-btn" on:click={close} aria-label="Close panel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="panel-body">
    <slot />
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 60;
  }
  .panel {
    position: fixed; top: 0; bottom: 0;
    width: 320px; max-width: 85vw;
    background: var(--surface);
    border: 1px solid var(--surface2);
    z-index: 70;
    display: flex; flex-direction: column;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .panel.left { left: 0; transform: translateX(-100%); }
  .panel.right { right: 0; transform: translateX(100%); }
  .panel.left.open { transform: translateX(0); }
  .panel.right.open { transform: translateX(0); }

  .panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--sp-md); border-bottom: 1px solid var(--surface2); flex-shrink: 0;
  }
  h3 { font-size: var(--fs-body); font-weight: 600; }
  .close-btn {
    background: none; border: none; color: var(--text-dim); cursor: pointer;
    width: 24px; height: 24px; padding: 0;
  }
  .close-btn:hover { color: var(--text); }
  .close-btn svg { width: 18px; height: 18px; }

  .panel-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }

  @media (min-width: 1100px) {
    .backdrop { background: transparent; }
    .panel { box-shadow: var(--shadow-card); }
  }
</style>
