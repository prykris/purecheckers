<script>
  import { onMount } from 'svelte';
  import { refreshSession } from '$lib/api.js';
  import PlayTabs from './lobby/PlayTabs.svelte';
  import ChallengeInvitations from './ChallengeInvitations.svelte';

  onMount(() => { refreshSession().catch(() => {}); });
</script>

<div class="lobby-layout">

  <div class="lobby-center">
    <ChallengeInvitations />
    <PlayTabs />
  </div>
</div>

<style>
  .lobby-layout {
    position: absolute; inset: 0; width: 100%;
    display: flex; flex-direction: column; align-items: center;
    background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg) 40%);
  }
  .lobby-center {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; gap: var(--sp-md); padding: var(--sp-sm) var(--sp-md);
    overflow-y: auto; overflow-x: hidden; min-height: 0;
    max-width: 520px; width: 100%;
    scrollbar-width: thin; scrollbar-color: var(--surface2) transparent;
  }
  .lobby-center::-webkit-scrollbar { width: 4px; }
  .lobby-center::-webkit-scrollbar-track { background: transparent; }
  .lobby-center::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 2px; }
</style>
