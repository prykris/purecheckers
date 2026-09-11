<script>
  import { createEventDispatcher } from 'svelte';
  import { modal } from '$lib/modal.js';
  export let label;
  export let busy = false;
  export let maxWidth = '360px';
  const dispatch = createEventDispatcher();
</script>

<dialog class="dialog" style:--modal-width={maxWidth} aria-label={label} use:modal={{ busy, onclose: () => dispatch('close') }}><slot /></dialog>

<style>
  .dialog { margin: auto; padding: 0; border: 0; background: transparent; color: var(--text); width: min(var(--modal-width), calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; border-radius: var(--radius-md); }
  .dialog::backdrop { background: rgba(0,0,0,0.6); }
  .dialog[open] { animation: appear 150ms ease-out; }
  @keyframes appear { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @media (prefers-reduced-motion: reduce) { .dialog[open] { animation: none; } }
</style>
