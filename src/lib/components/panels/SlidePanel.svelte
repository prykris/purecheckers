<script>
  import { modal } from '$lib/modal.js';
  export let open = false;
  export let side = 'left'; // 'left' | 'right'
  export let title = '';

  function close() { open = false; }
</script>

<dialog class="panel {side}" aria-label={title} use:modal={{ open, onclose: close }}>
  <div class="panel-header">
    <h3>{title}</h3>
    <button class="close-btn" on:click={close} aria-label="Close panel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="panel-body">
    <slot />
  </div>
</dialog>

<style>
  .panel {
    position: fixed; top: 0; bottom: 0; margin: 0; padding: 0; max-height: none; height: 100dvh; color: var(--text);
    width: 320px; max-width: 85vw;
    background: var(--surface);
    border: 1px solid var(--surface2);

    display: flex; flex-direction: column;

  }
  .panel:not([open]) { display: none; }
  .panel::backdrop { background: rgba(0,0,0,0.4); }
  .panel.left { left: 0; right: auto; --from: -100%; }
  .panel.right { right: 0; left: auto; --from: 100%; }
  .panel[open] { animation: enter 200ms ease-out; }
  @keyframes enter { from { transform: translateX(var(--from)); } to { transform: translateX(0); } }
  @media (prefers-reduced-motion: reduce) { .panel[open] { animation: none; } }

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

    .panel { box-shadow: var(--shadow-card); }
  }
</style>
