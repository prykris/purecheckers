// ============================================================
// Strategy content index
//
// Every markdown file under src/content/strategy is an article. mdsvex turns
// it into a Svelte component and exposes the frontmatter as `metadata`. This
// module builds the index the hub, the [slug] route, the sitemap and the tests
// read: slug, validated frontmatter, reading time, related articles, prev/next.
// ============================================================

export const SITE_URL = 'https://purecheckers.com';
export const HUB_PATH = '/strategy';

export const CATEGORIES = [
  { id: 'rules', label: 'Rules', blurb: 'What the rules actually say, with the positions that make them clear.' },
  { id: 'openings', label: 'Openings', blurb: 'The first moves: what they are called, what they aim at, what the bot answers.' },
  { id: 'tactics', label: 'Tactics', blurb: 'Shots, traps and multi-jumps: how pieces are won and lost.' },
  { id: 'endgames', label: 'Endgames', blurb: 'Kings against kings, the draws that hold and the wins that do not.' },
  { id: 'online', label: 'Playing bots and online', blurb: 'Getting the most out of the bots, rooms and ratings on this site.' }
];

const CATEGORY_IDS = CATEGORIES.map(c => c.id);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WORDS_PER_MINUTE = 200;

function fail(slug, message) {
  throw new Error(`Strategy article "${slug}": ${message}`);
}

/** Throws unless the frontmatter matches the contract in docs/growth/02-strategy-content-hub.md. */
export function validateFrontmatter(slug, fm) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) fail(slug, 'slug must use lowercase words separated by hyphens');
  if (!fm || typeof fm !== 'object') fail(slug, 'has no frontmatter');
  for (const key of ['title', 'description', 'category', 'published', 'updated', 'primaryQuery']) {
    if (typeof fm[key] !== 'string' || !fm[key].trim()) fail(slug, `frontmatter "${key}" must be a non-empty string`);
  }
  if (!CATEGORY_IDS.includes(fm.category)) fail(slug, `category must be one of ${CATEGORY_IDS.join(', ')}`);
  for (const key of ['published', 'updated']) {
    const date = new Date(`${fm[key]}T00:00:00Z`);
    if (!DATE_RE.test(fm[key]) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== fm[key]) {
      fail(slug, `"${key}" must be a real, quoted YYYY-MM-DD date`);
    }
  }
  if (fm.updated < fm.published) fail(slug, '"updated" is earlier than "published"');
  for (const key of ['secondaryQueries', 'related']) {
    if (!Array.isArray(fm[key]) || fm[key].some(v => typeof v !== 'string' || !v.trim())) fail(slug, `"${key}" must be an array of non-empty strings`);
    if (new Set(fm[key]).size !== fm[key].length) fail(slug, `"${key}" must not contain duplicates`);
  }
  if (!Array.isArray(fm.faq)) fail(slug, '"faq" must be an array (it may be empty)');
  if (fm.faq.length && (fm.faq.length < 3 || fm.faq.length > 5)) fail(slug, 'a faq block needs 3 to 5 questions');
  for (const item of fm.faq) {
    if (!item || typeof item.q !== 'string' || typeof item.a !== 'string' || !item.q.trim() || !item.a.trim()) {
      fail(slug, 'every faq entry needs "q" and "a" strings');
    }
  }
  if (new Set(fm.faq.map(item => item.q.trim().toLowerCase())).size !== fm.faq.length) fail(slug, 'faq questions must be unique');
  if (fm.ogImage !== undefined) {
    let valid = false;
    if (typeof fm.ogImage === 'string' && fm.ogImage.trim() === fm.ogImage && !/[\s\\]/.test(fm.ogImage)) {
      try {
        const image = new URL(fm.ogImage, SITE_URL);
        valid = (/^\/(?!\/)/.test(fm.ogImage) || fm.ogImage.startsWith('https://'))
          && image.protocol === 'https:' && !image.username && !image.password && !image.hash;
      } catch { /* Invalid URLs fail the content build below. */ }
    }
    if (!valid) fail(slug, '"ogImage" must be a site-relative path or absolute HTTPS URL');
  }
  // Translations need their own routes and reciprocal metadata before publication.
  if (fm.lang !== undefined && fm.lang !== 'en') fail(slug, 'only English articles have a published route');
  if (fm.translationOf !== undefined) fail(slug, 'translation routing is not implemented');
  if (fm.related.includes(slug)) fail(slug, 'lists itself under "related"');
  return true;
}

/** Word count of the article body: frontmatter, scripts, component tags and markup removed. */
export function countBodyWords(raw) {
  const body = String(raw)
    .replace(/^---[\s\S]*?---\s*/, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<DiagramBoard[\s\S]*?\/>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_#>|~-]+/g, ' ');
  const words = body.match(/[A-Za-z0-9][A-Za-z0-9'’.,:;()×/-]*/g) || [];
  return words.length;
}

export function readingMinutes(words) {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function slugFromPath(path) {
  return path.split('/').pop().replace(/\.md$/, '');
}

function categoryRank(id) {
  const i = CATEGORY_IDS.indexOf(id);
  return i === -1 ? CATEGORY_IDS.length : i;
}

/** Hub order: category order, then published date, then slug. */
export function compareHubOrder(a, b) {
  return categoryRank(a.category) - categoryRank(b.category)
    || a.published.localeCompare(b.published)
    || a.slug.localeCompare(b.slug);
}

/**
 * Build the index from two globs over the same files: the compiled modules
 * (component + metadata) and the raw markdown (for the word count).
 */
export function buildIndex(modules, raws = {}) {
  const list = [];
  const seen = new Set();
  for (const [path, mod] of Object.entries(modules)) {
    const slug = slugFromPath(path);
    if (seen.has(slug)) fail(slug, 'duplicate slug');
    seen.add(slug);
    const fm = mod.metadata;
    validateFrontmatter(slug, fm);
    const raw = raws[path] ?? '';
    const words = countBodyWords(raw);
    list.push({
      slug,
      path,
      url: `${HUB_PATH}/${slug}`,
      canonical: `${SITE_URL}${HUB_PATH}/${slug}`,
      title: fm.title,
      description: fm.description,
      category: fm.category,
      categoryLabel: CATEGORIES.find(c => c.id === fm.category)?.label ?? fm.category,
      published: fm.published,
      updated: fm.updated,
      primaryQuery: fm.primaryQuery,
      secondaryQueries: fm.secondaryQueries,
      related: fm.related,
      faq: fm.faq,
      ogImage: fm.ogImage,
      lang: fm.lang ?? 'en',
      translationOf: fm.translationOf,
      words,
      readingTime: readingMinutes(words),
      hasDiagram: /<DiagramBoard\b/.test(raw),
      component: mod.default
    });
  }
  for (const article of list) {
    for (const target of article.related) {
      if (!seen.has(target)) fail(article.slug, `unknown related article "${target}"`);
    }
  }
  list.sort(compareHubOrder);
  return list;
}


export function getArticle(slug, list) {
  return list.find(a => a.slug === slug) ?? null;
}

/** Related articles: frontmatter `related` first, then the same category, never self. */
export function related(slug, n = 3, list) {
  const self = getArticle(slug, list);
  if (!self) return [];
  const out = [];
  const push = a => { if (a && a.slug !== slug && !out.some(o => o.slug === a.slug)) out.push(a); };
  for (const s of self.related) push(getArticle(s, list));
  for (const a of list) {
    if (out.length >= n) break;
    if (a.category === self.category) push(a);
  }
  for (const a of list) {
    if (out.length >= n) break;
    push(a);
  }
  return out.slice(0, n);
}

/** Previous and next article in hub order. */
export function prevNext(slug, list) {
  const i = list.findIndex(a => a.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return { prev: list[i - 1] ?? null, next: list[i + 1] ?? null };
}

/** Categories that have at least one article, each with its articles in hub order. */
export function articlesByCategory(list) {
  return CATEGORIES
    .map(c => ({ ...c, articles: list.filter(a => a.category === c.id) }))
    .filter(c => c.articles.length > 0);
}

/** Card-sized view of an article, safe to hand to page data. */
export function summary(a) {
  if (!a) return null;
  const { slug, url, title, description, category, categoryLabel, published, updated, readingTime } = a;
  return { slug, url, title, description, category, categoryLabel, published, updated, readingTime };
}
