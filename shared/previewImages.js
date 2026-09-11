// Bump whenever rendered card content or layout changes. Both advertised URLs
// and the renderer's cache identity must use the same version.
export const PREVIEW_TEMPLATE_VERSION = 3;

export function previewImageUrl(kind, identity, { revision } = {}) {
  const url = new URL(`https://purecheckers.com/og/${kind}/${encodeURIComponent(identity)}.png`);
  if (revision !== undefined) url.searchParams.set('v', revision);
  url.searchParams.set('t', PREVIEW_TEMPLATE_VERSION);
  return url.href;
}
