import { readFile } from 'node:fs/promises';

export async function readContentManifest() {
  if (process.env.NODE_ENV !== 'production') {
    const { generateContentManifest } = await import('../../scripts/content-manifest.js');
    return generateContentManifest();
  }
  return JSON.parse(await readFile(new URL('../../.generated/content.json', import.meta.url), 'utf8'));
}
