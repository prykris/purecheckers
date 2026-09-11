<script>
  import PlayerPage from '$lib/components/PlayerPage.svelte';
  let { data } = $props();
</script>

<!-- A new load owns a fresh replay/profile view, including its local controls. -->
{#key data}<PlayerPage {data} />{/key}
