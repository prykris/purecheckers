<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  // Shell for a strategy article: head tags, JSON-LD, breadcrumb, title and
  // dates, the article body (children), the closing Play CTA, FAQ, related
  // articles and prev/next. Everything renders on the server; the only
  // client behaviour is the play_cta_click event.
  import { track } from '$lib/analytics.js';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { SITE_URL, HUB_PATH } from '$lib/content/strategy.js';

  let { article, related = [], prev = null, next = null, children } = $props();

  const SUFFIX = ' — Pure Checkers';
  const titleTag = $derived(
    (article.title + SUFFIX).length <= 60 ? article.title + SUFFIX : article.title
  );
  const image = $derived(article.ogImage ? absolute(article.ogImage) : `${SITE_URL}/og-image.png`);

  function absolute(path) {
    return /^https?:\/\//.test(path) ? path : `${SITE_URL}${path}`;
  }

  function formatDate(iso) {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    });
  }

  const articleLd = $derived({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image,
    datePublished: article.published,
    dateModified: article.updated,
    author: { '@type': 'Person', name: 'Chris', url: `${SITE_URL}/#about` },
    publisher: {
      '@type': 'Organization',
      name: 'Pure Checkers',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` }
    },
    mainEntityOfPage: article.canonical,
    inLanguage: article.lang || 'en'
  });

  const breadcrumbLd = $derived({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Strategy', item: `${SITE_URL}${HUB_PATH}` },
      { '@type': 'ListItem', position: 3, name: article.title, item: article.canonical }
    ]
  });

  const faqLd = $derived(article.faq && article.faq.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faq.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  } : null);

  function trackPlay() { track('play_cta_click', { article_slug: article.slug }); }
</script>

<svelte:head>
  <title>{titleTag}</title>
  <meta name="description" content={article.description} />
  <link rel="canonical" href={article.canonical} />
  <meta property="og:url" content={article.canonical} />
  <meta property="og:title" content={article.title} />
  <meta property="og:description" content={article.description} />
  <meta property="article:published_time" content={article.published} />
  <meta property="article:modified_time" content={article.updated} />
  <meta property="article:author" content="Chris" />
  <meta property="article:section" content={article.categoryLabel} />
</svelte:head>

<JsonLd data={articleLd} />
<JsonLd data={breadcrumbLd} />
{#if faqLd}
  <JsonLd data={faqLd} />
{/if}

<article class="article">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <a href={HUB_PATH}>Strategy</a>
    <span class="sep">/</span>
    <span>{article.title}</span>
  </nav>

  <header class="article-header">
    <p class="kicker">{article.categoryLabel}</p>
    <h1>{article.title}</h1>
    <p class="dates">
      Published <time datetime={article.published}>{formatDate(article.published)}</time>
      <span class="dot">·</span>
      Updated <time datetime={article.updated}>{formatDate(article.updated)}</time>
      <span class="dot">·</span>
      {article.readingTime} min read
      <span class="dot">·</span>
      By <a href="/#about">Chris</a>
    </p>
  </header>

  <div class="article-body">
    {@render children?.()}
  </div>

  <p>Try a short combination in the <a href="/puzzle">daily checkers puzzle</a>.</p>
  <div class="cta-box">
    <p class="cta-text">Ready to put this on the board? Pure Checkers is free, has no ads, and needs no account.</p>
    <GameEntryLink  class="play-btn" onclick={trackPlay} label="Play checkers now" />
  </div>

  {#if article.faq && article.faq.length}
    <section class="faq" id="faq">
      <h2>Frequently asked questions</h2>
      {#each article.faq as f}
        <div class="faq-item">
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      {/each}
    </section>
  {/if}

  {#if related.length}
    <section class="related">
      <h2>Related guides</h2>
      <ul class="cards">
        {#each related as r}
          <li class="card">
            <a href={r.url}>
              <span class="card-cat">{r.categoryLabel}</span>
              <span class="card-title">{r.title}</span>
              <span class="card-desc">{r.description}</span>
              <span class="card-meta">{r.readingTime} min read</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if prev || next}
    <nav class="prev-next" aria-label="Previous and next guide">
      {#if prev}
        <a class="pn prev" href={prev.url} rel="prev"><span class="pn-label">Previous</span><span class="pn-title">{prev.title}</span></a>
      {:else}
        <span></span>
      {/if}
      {#if next}
        <a class="pn next" href={next.url} rel="next"><span class="pn-label">Next</span><span class="pn-title">{next.title}</span></a>
      {/if}
    </nav>
  {/if}

  <p class="back"><a href={HUB_PATH}>All strategy guides</a></p>
</article>

<style>
  .article { max-width: 640px; margin: 0 auto; padding: 48px var(--sp-md) 120px; }

  .breadcrumb { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-caption); flex-wrap: wrap; }
  .breadcrumb a { color: var(--text-dim); text-decoration: none; }
  .breadcrumb a:hover { color: var(--accent); }
  .breadcrumb .sep { color: var(--text-dim); opacity: 0.4; }
  .breadcrumb span:last-child { color: var(--text); font-weight: 500; }

  .article-header { margin: var(--sp-lg) 0 var(--sp-xl); }
  .kicker { font-size: var(--fs-caption); text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-bottom: var(--sp-xs); }
  h1 { font-size: var(--fs-title); font-weight: 700; line-height: 1.2; margin-bottom: var(--sp-sm); }
  .dates { font-size: var(--fs-caption); color: var(--text-dim); line-height: 1.8; }
  .dates a { color: var(--text-dim); }
  .dot { opacity: 0.5; margin: 0 var(--sp-xs); }

  /* Prose. The body is rendered from markdown, so its elements are global. */
  .article-body { display: flex; flex-direction: column; gap: var(--sp-md); }
  .article-body :global(p) { color: var(--text-dim); font-size: var(--fs-body); line-height: 1.8; }
  .article-body :global(h2) { font-size: var(--fs-heading); font-weight: 700; margin-top: var(--sp-lg); line-height: 1.3; }
  .article-body :global(h3) { font-size: var(--fs-body); font-weight: 700; margin-top: var(--sp-sm); }
  .article-body :global(ul), .article-body :global(ol) { padding-left: 1.4em; color: var(--text-dim); line-height: 1.8; font-size: var(--fs-body); display: flex; flex-direction: column; gap: var(--sp-xs); }
  .article-body :global(li > p) { margin: 0; }
  .article-body :global(strong) { color: var(--text); }
  .article-body :global(a) { color: var(--accent); }
  .article-body :global(code) { font-family: var(--font-mono); font-size: 0.9em; background: var(--surface); padding: 1px 5px; border-radius: 4px; }
  .article-body :global(table) { display: block; overflow-x: auto; border-collapse: collapse; font-size: var(--fs-caption); color: var(--text-dim); max-width: 100%; }
  .article-body :global(th), .article-body :global(td) { border: 1px solid var(--surface2); padding: var(--sp-xs) var(--sp-sm); text-align: left; vertical-align: top; }
  .article-body :global(th) { color: var(--text); background: var(--surface); }
  .article-body :global(blockquote) { border-left: 3px solid var(--surface2); padding-left: var(--sp-md); font-style: italic; }
  .article-body :global(.guide-screenshot) { margin: var(--sp-sm) 0; }
  .article-body :global(.guide-screenshot img) { display: block; width: 100%; height: auto; border-radius: var(--radius-md); }
  .article-body :global(.guide-screenshot figcaption) { margin-top: var(--sp-sm); color: var(--text-dim); font-size: var(--fs-caption); line-height: 1.6; }
  .article-body :global(aside.house-rules) {
    background: var(--surface); border: 1px solid var(--surface2); border-left: 3px solid var(--gold);
    border-radius: var(--radius-md); padding: var(--sp-md) var(--sp-lg); display: flex; flex-direction: column; gap: var(--sp-sm);
  }
  .article-body :global(aside.house-rules .house-rules-label) {
    font-size: var(--fs-caption); text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold); font-weight: 600; margin: 0;
  }

  .cta-box {
    margin: var(--sp-xl) 0; padding: var(--sp-lg); text-align: center;
    background: var(--surface); border: 1px solid var(--surface2); border-radius: var(--radius-lg);
    display: flex; flex-direction: column; gap: var(--sp-md); align-items: center;
  }
  .cta-text { color: var(--text-dim); font-size: var(--fs-body); line-height: 1.6; }
  .cta-box :global(.play-btn) {
    display: inline-block; padding: var(--sp-md) var(--sp-xl); font-size: 1.05rem; font-weight: 700;
    background: linear-gradient(135deg, var(--accent), #dc2626); color: #fff; border-radius: var(--radius-sm);
    text-decoration: none; box-shadow: 0 4px 16px rgba(239,68,68,0.25); transition: transform 0.2s;
  }
  .cta-box :global(.play-btn):hover { transform: translateY(-2px); }

  .faq h2, .related h2 { font-size: var(--fs-heading); font-weight: 700; margin-bottom: var(--sp-md); }
  .faq { margin-top: var(--sp-xl); display: flex; flex-direction: column; }
  .faq-item { padding: var(--sp-md) 0; border-top: 1px solid var(--surface2); }
  .faq-item h3 { font-size: var(--fs-body); font-weight: 600; margin-bottom: var(--sp-xs); }
  .faq-item p { color: var(--text-dim); font-size: var(--fs-body); line-height: 1.7; }

  .related { margin-top: var(--sp-xl); }
  .cards { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--sp-sm); padding: 0; }
  .card a {
    display: flex; flex-direction: column; gap: var(--sp-xs); height: 100%;
    background: var(--surface); border: 1px solid var(--surface2); border-radius: var(--radius-md);
    padding: var(--sp-md); text-decoration: none; color: var(--text); transition: border-color 0.15s;
  }
  .card a:hover { border-color: var(--accent); }
  .card-cat { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); }
  .card-title { font-weight: 600; font-size: var(--fs-body); line-height: 1.3; }
  .card-desc { font-size: var(--fs-caption); color: var(--text-dim); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .card-meta { font-size: var(--fs-caption); color: var(--text-dim); margin-top: auto; }

  .prev-next { margin-top: var(--sp-xl); display: flex; justify-content: space-between; gap: var(--sp-md); }
  .pn { display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: var(--text); max-width: 48%; }
  .pn.next { text-align: right; margin-left: auto; }
  .pn-label { font-size: var(--fs-caption); color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
  .pn-title { font-size: var(--fs-body); font-weight: 600; }
  .pn:hover .pn-title { color: var(--accent); }

  .back { margin-top: var(--sp-xl); font-size: var(--fs-caption); }
  .back a { color: var(--text-dim); }
</style>
