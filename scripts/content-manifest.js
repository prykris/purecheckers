import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { compile } from 'mdsvex';
import { buildIndex } from '../src/lib/content/strategyCatalog.js';

export const manifestUrl = new URL('../.generated/content.json', import.meta.url);

// Use the same frontmatter compiler as article pages; no second YAML parser or
// hand-maintained URL list. The production server consumes only this JSON.
export async function generateContentManifest() {
  const dir = new URL('../src/content/strategy/', import.meta.url);
  const modules = {}, raws = {};
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith('.md')) continue;
    raws[file] = await readFile(new URL(file, dir), 'utf8');
    const result = await compile(raws[file]);
    modules[file] = { metadata: result.data.fm };
  }
  const articles = buildIndex(modules, raws).map(article => ({ path: article.url, updated: article.updated }));
  await mkdir(new URL('../.generated/', import.meta.url), { recursive: true });
  await writeFile(manifestUrl, JSON.stringify({ articles }));
  return { articles };
}
