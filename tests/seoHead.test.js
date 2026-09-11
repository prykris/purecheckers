// SEO head checks that need no server or database: the robots.txt rules that
// other plans depend on, and the "<" escape in the JsonLd component, which is
// the only thing standing between a username like "</script>" and an injected
// element in every player and game page.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('robots.txt', () => {
  const lines = readFileSync(resolve(root, 'src/static/robots.txt'), 'utf8')
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  it('keeps replay pages crawlable and blocks the SPA game screen', () => {
    expect(lines).toContain('Disallow: /game$');
    expect(lines).toContain('Disallow: /game?');
    expect(lines).toContain('Allow: /game/');
    expect(lines).not.toContain('Disallow: /game');
  });

  it('allows /join/ link cards and blocks the in-app /invite/ route and the API', () => {
    expect(lines).toContain('Disallow: /invite/');
    expect(lines).toContain('Disallow: /api/');
    expect(lines.some(l => /^Disallow: \/join/.test(l))).toBe(false);
  });

  it('does not block /auth (noindexed by the hooks header instead) or /_app/', () => {
    expect(lines.some(l => /^Disallow: \/auth/.test(l))).toBe(false);
    expect(lines.some(l => /_app/.test(l))).toBe(false);
  });

  it('points at the sitemap', () => {
    expect(lines).toContain('Sitemap: https://purecheckers.com/sitemap.xml');
  });
});

describe('JsonLd component', () => {
  let JsonLd;

  beforeAll(async () => {
    // vitest.config.js has no Svelte plugin (the suite is server-side), so
    // compile the component here and load it from node_modules/.cache, where
    // vite-node leaves it to Node and the bare "svelte/internal/server" import
    // resolves normally.
    const src = readFileSync(resolve(root, 'src/lib/components/JsonLd.svelte'), 'utf8');
    const { js } = compile(src, { generate: 'server', filename: 'JsonLd.svelte' });
    const dir = resolve(root, 'node_modules/.cache/seo-head-test');
    mkdirSync(dir, { recursive: true });
    const out = resolve(dir, 'JsonLd.js');
    writeFileSync(out, js.code);
    // Cache-bust so an edited component is recompiled within a watch session.
    JsonLd = (await import(`${pathToFileURL(out).href}?v=${Date.now()}`)).default;
  });

  it('emits one ld+json script that parses back to the input', () => {
    const data = { '@context': 'https://schema.org', '@type': 'Person', name: 'Quick Crown 35' };
    const { head } = render(JsonLd, { props: { data } });
    const blocks = head.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g);
    expect(blocks).toHaveLength(1);
    const json = blocks[0].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(JSON.parse(json)).toEqual(data);
  });

  it('escapes "<" so a hostile username cannot close the script tag', () => {
    const name = '</script><script>alert(1)</script>';
    const { head } = render(JsonLd, { props: { data: { '@type': 'Person', name } } });
    expect(head.match(/<script/g)).toHaveLength(1);
    expect(head.match(/<\/script>/g)).toHaveLength(1);
    expect(head).not.toContain('alert(1)</script>');
    expect(head).toContain('\\u003c/script>');
    const json = head.replace(/^[\s\S]*?<script type="application\/ld\+json">/, '').replace(/<\/script>[\s\S]*$/, '');
    expect(JSON.parse(json).name).toBe(name);
  });
});
