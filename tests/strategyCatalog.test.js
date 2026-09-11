import { readdir, readFile } from 'node:fs/promises';
import { compile } from 'mdsvex';
import { parse } from 'svelte/compiler';
import { buildIndex, validateFrontmatter, related, prevNext, articlesByCategory } from '../src/lib/content/strategyCatalog.js';
import { strategyIntro } from '../scripts/strategy-intro.js';

const metadata = overrides => ({ title: 'Test guide', description: 'Guide description', category: 'rules',
  published: '2024-02-29', updated: '2024-03-01', primaryQuery: 'checkers rules',
  secondaryQueries: [], related: [], faq: [], ...overrides });
const module = (overrides = {}) => ({ metadata: metadata(overrides) });

it.each([
  { published: '2023-02-29' }, { updated: '2024-04-31' }, { updated: '2024-13-01' },
  { updated: '2024-02-28' }, { category: 'unknown' }, { related: ['self'] },
  { secondaryQueries: [''] }, { related: ['other', 'other'] },
  { lang: 'es' }, { lang: '' }, { translationOf: 'rules' },
  { ogImage: 'javascript:alert(1)' }, { ogImage: '//elsewhere.test/card.png' },
  { ogImage: '/\\elsewhere.test/card.png' }, { ogImage: 'https://user:pass@example.test/a.png' },
  { ogImage: '' }, { ogImage: 'card.png' },
  { faq: [{ q: 'Question', a: 'Answer' }] },
  { faq: [{ q: 'Question', a: 'Answer' }, { q: 'question ', a: 'Answer' }, { q: 'Third', a: 'Answer' }] }
])('rejects invalid publication metadata: %j', overrides => {
  expect(() => validateFrontmatter('self', metadata(overrides))).toThrow('Strategy article');
});

it('accepts real leap dates and supported image locations without changing metadata', () => {
  for (const ogImage of [undefined, '/og-image.png', 'https://example.test/card.png?v=1']) {
    const value = metadata({ ogImage, lang: 'en' });
    expect(validateFrontmatter('rules', value)).toBe(true);
    expect(value).toEqual(metadata({ ogImage, lang: 'en' }));
  }
});

it('fails missing related targets, duplicate slugs and invalid URL slugs before publication', () => {
  expect(() => buildIndex({ 'one.md': module({ related: ['missing'] }) })).toThrow('unknown related article');
  expect(() => buildIndex({ '/a/one.md': module(), '/b/one.md': module() })).toThrow('duplicate slug');
  expect(() => buildIndex({ 'bad slug.md': module() })).toThrow('slug must');
});

it('uses deterministic category/date/slug navigation and fills related cards without duplicates or self', () => {
  const list = buildIndex({
    'z-opening.md': module({ category: 'openings', published: '2023-01-01' }),
    'b-rules.md': module({ related: ['z-opening', 'a-rules'] }),
    'a-rules.md': module(), 'c-tactics.md': module({ category: 'tactics' })
  });
  expect(list.map(a => a.slug)).toEqual(['a-rules', 'b-rules', 'z-opening', 'c-tactics']);
  expect(related('b-rules', 3, list).map(a => a.slug)).toEqual(['z-opening', 'a-rules', 'c-tactics']);
  expect(prevNext('a-rules', list)).toEqual({ prev: null, next: list[1] });
  expect(prevNext('c-tactics', list)).toEqual({ prev: list[2], next: null });
  expect(prevNext('missing', list)).toEqual({ prev: null, next: null });
  expect(articlesByCategory(list).map(c => c.id)).toEqual(['rules', 'openings', 'tactics']);
});

it('validates the complete real catalogue and compiles each introduction with one shared CTA', async () => {
  const modules = {}, raws = {};
  for (const filename of (await readdir('src/content/strategy')).filter(name => name.endsWith('.md'))) {
    const path = 'src/content/strategy/' + filename;
    raws[path] = await readFile(path, 'utf8');
    const result = await compile(raws[path], { extensions: ['.md'], filename: path, remarkPlugins: [strategyIntro] });
    modules[path] = { metadata: result.data.fm };
    // Actual mdsvex output must also be valid Svelte with existing imports.
    const ast = parse(result.code, { modern: true });
    expect(ast.instance.content.body.filter(node => node.type === 'ImportDeclaration'
      && node.source.value === '$lib/components/ArticlePlayLink.svelte')).toHaveLength(1);
    expect(result.code.match(/<StrategyIntroPlay /g)).toHaveLength(1);
    expect(result.code.indexOf('<StrategyIntroPlay ')).toBeLessThan(result.code.indexOf('<h2'));
  }
  const articles = buildIndex(modules, raws);
  expect(articles).toHaveLength(12);
  for (const article of articles) {
    expect(article.readingTime).toBeGreaterThan(1);
    expect(related(article.slug, 3, articles)).toHaveLength(3);
  }
});

it('scopes CTA insertion to strategy articles and rejects an absent introduction', async () => {
  const intro = 'A useful introduction.\n\n## Next section\n\nMore detail.';
  const article = await compile(intro, { extensions: ['.md'], filename: 'C:\\repo\\src\\content\\strategy\\example.md', remarkPlugins: [strategyIntro] });
  expect(() => parse(article.code, { modern: true })).not.toThrow();
  expect(article.code.indexOf('A useful introduction.')).toBeLessThan(article.code.indexOf('<StrategyIntroPlay '));
  const other = await compile(intro, { extensions: ['.md'], filename: 'src/content/blog/example.md', remarkPlugins: [strategyIntro] });
  expect(other.code).not.toContain('StrategyIntroPlay');
  await expect(compile('## No intro', { extensions: ['.md'], filename: 'src/content/strategy/example.md', remarkPlugins: [strategyIntro] })).rejects.toThrow('needs an introduction');
});
