import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'node:url';
const fontFiles = [400, 500, 600, 700].map(weight => fileURLToPath(new URL(`../../src/static/fonts/poppins-${weight}.ttf`, import.meta.url)));
export const renderOptions = { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Poppins' } };
const escape = value => value.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const unescape = value => value.replace(/&(lt|gt|amp|quot|apos);/g, (_, entity) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" })[entity]);
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

// Only templates emit these bounded, plain-text SVG nodes. Font measurement
// stays in the raster worker, not the socket/server event loop.
export function fitSvgText(svg) {
  return svg.replace(/<text\b([^>]*)>([^<]*)<\/text>/g, (original, attributes, encoded) => {
    const width = Number(attributes.match(/data-fit-width="([\d.]+)"/)?.[1]);
    if (!width) return original;
    const size = Number(attributes.match(/font-size="([\d.]+)"/)[1]);
    const minimum = Number(attributes.match(/data-min-size="([\d.]+)"/)?.[1] ?? size);
    const attrs = attributes.replace(/ data-(?:fit-width|min-size)="[\d.]+"/g, '');
    const node = (value, fontSize) => `<text${attrs.replace(/font-size="[\d.]+"/, `font-size="${fontSize}"`)}>${value}</text>`;
    const measure = (value, fontSize) => new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${node(value, fontSize)}</svg>`, renderOptions).innerBBox()?.width ?? 0;
    const actual = measure(encoded, size);
    if (actual <= width) return node(encoded, size);
    const fitted = Math.floor(size * width / actual * 10) / 10;
    if (fitted >= minimum) return node(encoded, fitted);
    const characters = [...segmenter.segment(unescape(encoded))].map(part => part.segment);
    let low = 0, high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (measure(escape(characters.slice(0, middle).join('') + '…'), minimum) <= width) low = middle;
      else high = middle - 1;
    }
    return node(escape(characters.slice(0, low).join('') + '…'), minimum);
  });
}
export function renderPng(svg) {
  return new Resvg(fitSvgText(svg), { ...renderOptions, fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
