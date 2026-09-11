<script>
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  import { track } from '$lib/analytics.js';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { SITE_URL, HUB_PATH } from '$lib/content/strategy.js';

  let { data } = $props();

  const canonical = `${SITE_URL}${HUB_PATH}`;
  const title = 'Checkers Strategy: Rules, Openings, Tactics';
  const description = 'Checkers strategy guides you can play through: the rules with real positions, the seven first moves and what the bot answers, tactics and endgames. Free, no account.';

  function formatDate(iso) {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function trackPlay() {
    track('play_cta_click', { article_slug: 'strategy-hub' });
  }

  const collectionLd = $derived({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonical,
    inLanguage: 'en',
    dateModified: data.updated || undefined,
    isPartOf: { '@type': 'WebSite', name: 'Pure Checkers', url: `${SITE_URL}/` },
    hasPart: data.categories.flatMap(c => c.articles.map(a => ({
      '@type': 'Article',
      headline: a.title,
      description: a.description,
      url: `${SITE_URL}${a.url}`,
      datePublished: a.published,
      dateModified: a.updated,
      author: { '@type': 'Person', name: 'Chris', url: `${SITE_URL}/#about` }
    })))
  });

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Strategy', item: canonical }
    ]
  };
</script>

<svelte:head>
  <title>{title} — Pure Checkers</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
</svelte:head>

<JsonLd data={collectionLd} />
<JsonLd data={breadcrumbLd} />

<section class="hub">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <span>Strategy</span>
  </nav>

  <h1>Checkers strategy guides</h1>

  <div class="intro">
    <p>
      Most checkers strategy advice comes down to three words: hold the centre. That is true, and it is
      not enough. The players who beat you are not doing anything mysterious; they know that a capture is
      forced and use it to pull your pieces where they want them, they keep their back row closed until
      you have run out of safe moves, and they know which of the seven first moves lead somewhere and which
      lead to a cramped side of the board.
    </p>
    <p>
      These guides cover that ground in order. The rules articles answer the questions people actually
      type, with a position on the board for each answer rather than a paragraph of prose, and every
      diagram is rendered from the same engine that runs the games here. The opening guides name the
      first moves the way tournament players do, using the standard 1 to 32 square numbering, and show
      what the site's own bot plays in reply, computed by running it rather than guessing. Tactics and
      endgames cover combinations, promotion and positions where an extra king can force a win.
    </p>
    <p>
      Where the rules on Pure Checkers differ from the standard English game (men capture backwards
      here, and kings fly), the article says so in a clearly marked box, so you can read the standard
      answer first and then see what happens on this board. Pick a guide, play through the diagrams, and
      when something clicks, put it to use against the bot or a friend.
    </p>
  </div>

  <p class="hub-cta"><GameEntryLink  class="play-btn" onclick={trackPlay} label="Play checkers free" /></p>

  {#each data.categories as cat}
    <section class="category" id={cat.id}>
      <h2>{cat.label}</h2>
      <p class="blurb">{cat.blurb}</p>
      <ul class="cards">
        {#each cat.articles as a}
          <li class="card">
            <a href={a.url}>
              <span class="card-title">{a.title}</span>
              <span class="card-desc">{a.description}</span>
              <span class="card-meta">{a.readingTime} min read · Updated {formatDate(a.updated)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}

  <p class="foot">
    Short answers to the common questions live on the <a href="/faq">FAQ</a>; the two-minute version of the
    rules is on the <a href="/#how-to-play">home page</a>. Start with the rules, then explore openings,
    tactics and endgames at your own pace.
  </p>
</section>

<style>
  .hub { max-width: 720px; margin: 0 auto; padding: 48px var(--sp-md) 120px; }

  .breadcrumb { display: flex; align-items: center; gap: var(--sp-xs); font-size: var(--fs-caption); }
  .breadcrumb a { color: var(--text-dim); text-decoration: none; }
  .breadcrumb a:hover { color: var(--accent); }
  .breadcrumb .sep { color: var(--text-dim); opacity: 0.4; }
  .breadcrumb span:last-child { color: var(--text); font-weight: 500; }

  h1 { font-size: var(--fs-title); font-weight: 700; margin: var(--sp-lg) 0 var(--sp-md); line-height: 1.2; }
  .intro { max-width: 640px; display: flex; flex-direction: column; gap: var(--sp-md); }
  .intro p { color: var(--text-dim); font-size: var(--fs-body); line-height: 1.8; }

  .hub-cta { margin: var(--sp-lg) 0 var(--sp-xl); }
  .hub-cta :global(.play-btn) {
    display: inline-block; padding: var(--sp-sm) var(--sp-lg); font-weight: 700;
    background: linear-gradient(135deg, var(--accent), #dc2626); color: #fff; border-radius: var(--radius-sm);
    text-decoration: none; box-shadow: 0 4px 16px rgba(239,68,68,0.25); transition: transform 0.2s;
  }
  .hub-cta :global(.play-btn):hover { transform: translateY(-2px); }

  .category { margin-top: var(--sp-xl); }
  .category h2 { font-size: var(--fs-heading); font-weight: 700; margin-bottom: var(--sp-xs); }
  .blurb { color: var(--text-dim); font-size: var(--fs-caption); margin-bottom: var(--sp-md); }

  .cards { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--sp-sm); padding: 0; }
  .card a {
    display: flex; flex-direction: column; gap: var(--sp-xs); height: 100%;
    background: var(--surface); border: 1px solid var(--surface2); border-radius: var(--radius-md);
    padding: var(--sp-md); text-decoration: none; color: var(--text); transition: border-color 0.15s;
  }
  .card a:hover { border-color: var(--accent); }
  .card-title { font-weight: 600; font-size: var(--fs-body); line-height: 1.3; }
  .card-desc { font-size: var(--fs-caption); color: var(--text-dim); line-height: 1.5; }
  .card-meta { font-size: var(--fs-caption); color: var(--text-dim); margin-top: auto; padding-top: var(--sp-xs); }

  .foot { margin-top: var(--sp-xl); color: var(--text-dim); font-size: var(--fs-caption); line-height: 1.7; }
  .foot a { color: var(--accent); }
</style>
