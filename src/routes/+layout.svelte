<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { locale, setLocale, restoreLocale } from '$lib/stores/locale.js';
  import { startPuzzleHistory } from '$lib/puzzle/history.js';
  let { children } = $props();
  let SiteRuntime = $state(null);
  onMount(() => {
    let alive = true;
    import('$lib/components/SiteRuntime.svelte').then(module => { if (alive) SiteRuntime = module.default; });
    return () => { alive = false; };
  });
  onMount(startPuzzleHistory);
  afterNavigate(() => {
    const language = page.url.searchParams.get('lang');
    if (language === 'en' || language === 'es') setLocale(language);
    else if (page.url.pathname === '/es') setLocale('es');
    else if (page.url.pathname === '/') setLocale('en');
    else restoreLocale();
  });
  $effect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = page.route.id?.startsWith('/(marketing)') ? (page.url.pathname === '/es' ? 'es' : 'en') : $locale;
  });
</script>

{@render children()}
{#if SiteRuntime}<SiteRuntime />{/if}
