<script>
  import ArticleLayout from '$lib/components/ArticleLayout.svelte';

  let { data } = $props();
  const Article = $derived(data.article.component);
</script>

{#key data.article.slug}
  <ArticleLayout article={data.article} related={data.related} prev={data.prev} next={data.next}>
    <Article />
  </ArticleLayout>
{/key}
