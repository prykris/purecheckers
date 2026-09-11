// Catalogue data is presentation only. Keep a bounded, explicit canvas format;
// arbitrary CSS, URLs and missing gradients never reach the renderer.
const hex = /^#[0-9a-f]{6}$/i;
const whiteHighlight = /^rgba\(255,\s*255,\s*255,\s*(0(?:\.\d{1,3})?|1(?:\.0{1,3})?)\)$/;
const side = (base, gradStops, stroke, highlight, ring) => Object.freeze({ base, gradStops: Object.freeze(gradStops), stroke, highlight, ring, glow: false });
export const DEFAULT_PIECE_SKIN = Object.freeze({
  red: side('#b91c1c', ['#f87171', '#ef4444', '#dc2626'], '#991b1b', 'rgba(255,255,255,0.15)', 'rgba(252,165,165,0.3)'),
  black: side('#1a1a1a', ['#57534e', '#3d3530', '#1c1917'], '#44403c', 'rgba(255,255,255,0.08)', 'rgba(168,162,158,0.2)')
});

export function normalizePieceSkin(data) {
  const skin = {};
  for (const color of ['red', 'black']) {
    const value = data?.[color];
    if (!value || typeof value.base !== 'string' || typeof value.stroke !== 'string' || !hex.test(value.base) || !hex.test(value.stroke) || !Array.isArray(value.gradStops) || value.gradStops.length !== 3 || !value.gradStops.every(v => typeof v === 'string' && hex.test(v))) return null;
    if (value.glow !== undefined && typeof value.glow !== 'boolean') return null;
    if (value.highlight !== undefined && (typeof value.highlight !== 'string' || (!hex.test(value.highlight) && !whiteHighlight.test(value.highlight)))) return null;
    skin[color] = Object.freeze({ base: value.base, stroke: value.stroke, gradStops: Object.freeze([...value.gradStops]),
      glow: value.glow === true, highlight: value.highlight ?? DEFAULT_PIECE_SKIN[color].highlight, ring: DEFAULT_PIECE_SKIN[color].ring });
  }
  return Object.freeze(skin);
}

// CSS boards consume the same normalized palette as the canvas painter.
export function pieceSkinCss(skin) {
  return ['red', 'black'].map(color => {
    const p = skin[color];
    return `--${color}-piece:radial-gradient(circle at 35% 35%,${p.gradStops[0]} 0%,${p.gradStops[1]} 70%,${p.gradStops[2]} 100%);--${color}-stroke:${p.stroke};--${color}-shadow:0 2px 4px rgba(0,0,0,0.4)${p.glow ? `,0 0 8px ${p.base}` : ''}`;
  }).join(';');
}
