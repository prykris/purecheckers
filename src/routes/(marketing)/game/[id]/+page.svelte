<script>
  import ReplayPage from '$lib/components/ReplayPage.svelte';
  let { data } = $props();
</script>

<!-- A new load owns a fresh replay/profile view, including its local controls. -->
{#key data}<ReplayPage {data} />{/key}
