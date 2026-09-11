<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  import JsonLd from './JsonLd.svelte';
  let { title, description, path, parents = [], breadcrumbLabel, children } = $props();
  const canonical = $derived('https://purecheckers.com' + path);
  const breadcrumbs = $derived([{ name: 'Home', path: '/' }, ...parents, { name: breadcrumbLabel ?? title, path }]);
  const schema = $derived({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement:
    breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: 'https://purecheckers.com' + item.path })) });
</script>

<svelte:head>
  <title>{title} — Pure Checkers</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
</svelte:head>
<JsonLd data={schema} />
<section class="public-index">
  <nav aria-label="Breadcrumb">
    {#each breadcrumbs as item, index}
      {#if index}<span aria-hidden="true">/</span>{/if}
      {#if index < breadcrumbs.length - 1}<a href={item.path}>{item.name}</a>{:else}<span aria-current="page">{item.name}</span>{/if}
    {/each}
  </nav>
  <h1>{title}</h1>
  <p class="intro">{description}</p>
  {@render children()}
  <p class="play"><GameEntryLink  class="btn btn-primary" label="Play checkers" /></p>
</section>

<style>
  .public-index { max-width: 900px; margin: 0 auto; padding: 64px var(--sp-md); }
  nav { color: var(--text-dim); font-size: var(--fs-caption); margin-bottom: var(--sp-lg); }
  nav span { padding: 0 var(--sp-sm); }
  h1 { font-size: var(--fs-title); line-height: 1.2; }
  .intro { color: var(--text-dim); line-height: 1.7; margin: var(--sp-md) 0 var(--sp-xl); }
  .public-index :global(.table-scroll) { overflow-x: auto; }
  .public-index :global(table) { width: 100%; border-collapse: collapse; text-align: left; }
  .public-index :global(caption) { text-align: left; padding-bottom: var(--sp-md); color: var(--text-dim); }
  .public-index :global(th), .public-index :global(td) { padding: var(--sp-md) var(--sp-sm); border-bottom: 1px solid var(--surface2); }
  .public-index :global(th) { font-size: var(--fs-caption); color: var(--text-dim); }
  .public-index :global(.empty) { padding: var(--sp-lg); background: var(--surface); border-radius: var(--radius-md); line-height: 1.7; }
  .play { margin-top: var(--sp-xl); }
</style>
