<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  import { track } from '$lib/analytics.js';
  let { slug } = $props();
</script>

<p class="intro-play">
  <GameEntryLink class="lead-play" onclick={() => track('play_cta_click', { article_slug: slug })} label="Try it now — free, no account" />
</p>

<style>
  .intro-play :global(a) { color: var(--accent); text-underline-offset: 3px; }
</style>
