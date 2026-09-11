import { Resvg } from '@resvg/resvg-js';
import { fitSvgText, renderOptions, renderPng } from '../server/og/render.js';
import { previewCards } from './fixtures/previewCards.js';

it.each(previewCards)('%s keeps all rendered content inside the central square crop', (name, source) => {
  const fitted = fitSvgText(source);
  const content = fitted.replace('<rect width="1200" height="630" fill="#1c1917"/>', '');
  const bounds = new Resvg(content, renderOptions).getBBox();
  expect(bounds).toBeDefined();
  expect(bounds.x).toBeGreaterThanOrEqual(285);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(915);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(630);
  expect(fitted).not.toContain('data-fit-width');
  const intended = [...source.matchAll(/<text\b([^>]*)>[^<]*<\/text>/g)];
  const lines = [...fitted.matchAll(/<text\b[^>]*>[^<]*<\/text>/g)];
  expect(lines).toHaveLength(intended.length);
  for (let i = 0; i < lines.length; i++) {
    const allowed = Number(intended[i][1].match(/data-fit-width="([\d.]+)"/)[1]);
    const line = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${lines[i][0]}</svg>`, renderOptions).innerBBox();
    expect(line?.width ?? 0).toBeLessThanOrEqual(allowed + 1); // native path bounds are approximate
  }
  const png = renderPng(source);
  expect(png.readUInt32BE(16)).toBe(1200); expect(png.readUInt32BE(20)).toBe(630);
});

it('fits wide names with visible ellipses without reducing below the declared minimum', () => {
  const source = previewCards.find(([name]) => name === 'game-long-names')[1];
  const fitted = fitSvgText(source);
  expect(fitted).toContain('…');
  expect(fitted).toContain('>Red wins</text>');
  for (const [node, size] of [...fitted.matchAll(/<text[^>]*font-size="([\d.]+)"[^>]*>[^<]*…<\/text>/g)]) {
    expect(Number(size)).toBeGreaterThanOrEqual(22);
    expect(node).not.toContain('undefined');
  }
});

it('keeps escaped usernames as text through fitting, including when truncation cuts near an entity', () => {
  const fitted = fitSvgText(previewCards.find(([name]) => name === 'invite-long-name')[1]);
  expect(fitted).toContain('&lt;'); expect(fitted).toContain('&amp;');
  expect(fitted).not.toContain('<W'); expect(fitted).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  expect(fitted).toContain('>2147483647 coins</text>');
  expect(() => new Resvg(fitted, renderOptions).render()).not.toThrow();
});

it('states registration for wager invitations and omits the default clock', () => {
  const free = previewCards.find(([name]) => name === 'invite-free')[1];
  const wager = previewCards.find(([name]) => name === 'invite-wager')[1];
  expect(free).toContain('No account needed'); expect(free).not.toContain('s per move');
  expect(wager).toContain('Registered account'); expect(wager).toContain('required');
  expect(wager).not.toContain('No account needed'); expect(wager).toContain('90 s per move');
});

it('shows names, reason and moves with signed rating chips only in ranked games', () => {
  const ranked = previewCards.find(([name]) => name === 'game-win')[1];
  expect(ranked).toContain('Chris beat Dana'); expect(ranked).toContain('By resignation'); expect(ranked).toContain('34 moves');
  expect(ranked).toMatch(/fill="#86efac"[^>]*>\+14 ELO/);
  expect(ranked).toMatch(/fill="#fda4af"[^>]*>-14 ELO/);
  const friendly = previewCards.find(([name]) => name === 'game-friendly')[1];
  expect(friendly).not.toContain('ELO');
});
