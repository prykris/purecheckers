import { error } from '@sveltejs/kit';
import { articles, getArticle, related, prevNext, summary } from '$lib/content/strategy.js';

export const prerender = true;

export function entries() {
  return articles.map(a => ({ slug: a.slug }));
}

export function load({ params }) {
  const article = getArticle(params.slug);
  if (!article) error(404, 'Article not found');
  const { prev, next } = prevNext(params.slug);
  return {
    article,
    related: related(params.slug, 3).map(summary),
    prev: summary(prev),
    next: summary(next),
    // Read by the marketing layout for og:type / og:image. ogImage stays
    // undefined so the layout falls back to the site image.
    ogType: 'article',
    ogImage: article.ogImage
  };
}
