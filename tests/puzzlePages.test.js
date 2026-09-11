import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { puzzleTheme, puzzleDescription } from '../src/lib/puzzle/presentation.js';
import { THEMES } from '../scripts/generate-puzzles.js';
import { loadPuzzlePage } from '../src/lib/server/puzzlePage.js';

let PublicIndex;
beforeAll(async () => {
  const directory = resolve('node_modules/.cache/puzzle-page-tests'); mkdirSync(directory, { recursive: true });
  for (const name of ['JsonLd', 'PublicIndex', 'GameEntryLink']) {
    const { js } = compile(readFileSync(`src/lib/components/${name}.svelte`, 'utf8'), { generate: 'server', filename: `${name}.svelte` });
    writeFileSync(resolve(directory, `${name}.js`), js.code.replace(/from (['"])([^'"]+)\1/g, (match, quote, specifier) => {
      if (specifier.startsWith('$lib/stores/')) return `from '${pathToFileURL(resolve('tests/fixtures/siteState.js')).href}'`;
      const target = specifier.endsWith('.svelte') ? resolve(directory, basename(specifier, '.svelte') + '.js')
        : specifier.startsWith('$lib/') ? resolve('src/lib', specifier.slice(5)) : null;
      return target ? `from '${pathToFileURL(target).href}'` : match;
    }));
  }
  PublicIndex = (await import(pathToFileURL(resolve(directory, 'PublicIndex.js')).href)).default;
});

it('maps every generated theme to a real guide and safely handles a future theme', () => {
  for (const key of THEMES) {
    const theme = puzzleTheme(key);
    expect(theme.url).toMatch(/^\/strategy\//);
    expect(existsSync('src/content' + theme.url + '.md')).toBe(true);
  }
  expect(puzzleTheme('new-idea')).toEqual({ label: 'new idea', url: '/strategy', guideLabel: 'Checkers strategy' });
  expect(puzzleTheme('constructor').url).toBe('/strategy');
});

it('describes the published challenge without including solution moves or promising a game win', () => {
  const text = puzzleDescription({ date: '2026-09-11', sideToMove: 'black', difficulty: 'EASY', theme: 'multi-jump', solution: [{ move: '14x23x30' }] });
  expect(text).toContain('An easy multi-jump puzzle for 11 September 2026: Black to move');
  expect(text).not.toMatch(/14|23|30|wins the game/);
});

it('derives visible and structured breadcrumbs from the same hierarchy while retaining ordinary index pages', () => {
  const props = { title: 'Checkers puzzle', description: 'A puzzle', path: '/puzzle/2026-09-11',
    parents: [{ name: 'Daily Puzzle', path: '/puzzle' }], breadcrumbLabel: '11 September 2026', children: () => {} };
  const { head, body } = render(PublicIndex, { props });
  const schema = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  expect(schema.itemListElement.map(item => [item.position, item.name, item.item])).toEqual([
    [1, 'Home', 'https://purecheckers.com/'], [2, 'Daily Puzzle', 'https://purecheckers.com/puzzle'],
    [3, '11 September 2026', 'https://purecheckers.com/puzzle/2026-09-11']
  ]);
  expect(body).toContain('href="/puzzle"'); expect(body).toContain('aria-current="page"');
  const normal = render(PublicIndex, { props: { title: 'Leaderboard', description: 'Rankings', path: '/leaderboard', children: () => {} } });
  const normalSchema = JSON.parse(normal.head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  expect(normalSchema.itemListElement).toHaveLength(2);
  expect(normalSchema.itemListElement[1].name).toBe('Leaderboard');
});

it('keeps invalid/future dated pages hidden and distinguishes an empty hub from an unavailable API', async () => {
  const context = { params: { date: '2026-02-30' }, url: new URL('https://purecheckers.com/puzzle/2026-02-30'), fetch: vi.fn(), setHeaders: vi.fn() };
  await expect(loadPuzzlePage(context)).rejects.toMatchObject({ status: 404 });
  expect(context.fetch).not.toHaveBeenCalled();
  context.params.date = '2027-01-01'; context.fetch.mockResolvedValue(new Response('{}', { status: 404 }));
  await expect(loadPuzzlePage(context)).rejects.toMatchObject({ status: 404 });
  context.params = {}; context.fetch.mockResolvedValueOnce(new Response('{}', { status: 404 }))
    .mockResolvedValueOnce(Response.json({ puzzles: [] }));
  expect(await loadPuzzlePage(context)).toMatchObject({ puzzle: null, hub: true, archive: [] });
  context.fetch.mockResolvedValue(new Response('{}', { status: 503 }));
  await expect(loadPuzzlePage(context)).rejects.toMatchObject({ status: 503 });
});
