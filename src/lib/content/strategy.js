// Svelte-facing catalogue: the shared contract also runs in the Node build tool.
import * as catalog from './strategyCatalog.js';
export * from './strategyCatalog.js';

const modules = import.meta.glob('/src/content/strategy/*.md', { eager: true });
const raws = import.meta.glob('/src/content/strategy/*.md', { eager: true, query: '?raw', import: 'default' });
export const articles = catalog.buildIndex(modules, raws);
export const getArticle = (slug, list = articles) => catalog.getArticle(slug, list);
export const related = (slug, n = 3, list = articles) => catalog.related(slug, n, list);
export const prevNext = (slug, list = articles) => catalog.prevNext(slug, list);
export const articlesByCategory = (list = articles) => catalog.articlesByCategory(list);
