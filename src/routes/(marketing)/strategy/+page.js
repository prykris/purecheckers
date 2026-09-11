import { articles, articlesByCategory, summary } from '$lib/content/strategy.js';

export const prerender = true;

export function load() {
  const categories = articlesByCategory().map(c => ({
    id: c.id,
    label: c.label,
    blurb: c.blurb,
    articles: c.articles.map(summary)
  }));
  const updated = articles.reduce((m, a) => (a.updated > m ? a.updated : m), '');
  return {
    categories,
    count: articles.length,
    updated,
    ogType: 'website',
    ogImage: undefined
  };
}
