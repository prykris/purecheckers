import { DEFAULT_PIECE_SKIN, normalizePieceSkin, pieceSkinCss } from '../shared/pieceSkins.js';
import { drawCanvasPiece } from '../src/lib/canvasPiece.js';

it('copies only supported drawing fields and rejects unsafe or incomplete palettes', () => {
  const input = structuredClone(DEFAULT_PIECE_SKIN);
  input.red.glow = true; input.black.highlight = 'rgba(255,255,255,0.35)'; input.url = 'ignored';
  const result = normalizePieceSkin(input);
  expect(result.url).toBeUndefined(); expect(result.red.glow).toBe(true); expect(result.black.highlight).toBe('rgba(255,255,255,0.35)');
  input.red.gradStops[0] = '#000000'; expect(result.red.gradStops[0]).toBe('#f87171'); expect(Object.isFrozen(result.red.gradStops)).toBe(true);
  for (const patch of [{ base: 'url(https://example.test)' }, { gradStops: ['#ffffff'] }, { gradStops: ['#ffffff', '#ffffff', 'var(--color)'] },
    { stroke: null }, { glow: 'yes' }, { highlight: 'rgba(255,255,255,2)' }, { highlight: 'red; color: transparent' }]) {
    expect(normalizePieceSkin({ ...DEFAULT_PIECE_SKIN, red: { ...DEFAULT_PIECE_SKIN.red, ...patch } })).toBeNull();
  }
});

function canvas() {
  const gradients = [], styles = [], calls = [];
  const gradient = () => { const stops = []; gradients.push(stops); return { addColorStop: (offset, color) => stops.push([offset, color]) }; };
  const state = { globalAlpha: 0.8, shadowBlur: 0, shadowColor: 'none' }, stack = [];
  const api = { createRadialGradient: gradient, createLinearGradient: gradient, save: () => stack.push({ ...state }), restore: () => Object.assign(state, stack.pop()) };
  const ctx = new Proxy(api, {
    set(_target, key, value) { state[key] = value; styles.push([key, value]); return true; },
    get(target, key) { return key in target ? target[key] : key in state ? state[key] : (...args) => calls.push([key, ...args]); }
  });
  return { ctx, gradients, styles, calls, state };
}

it.each(['red', 'black'])('uses the selected %s palette for a moving/captured king and restores canvas effects', color => {
  const skin = normalizePieceSkin({ ...DEFAULT_PIECE_SKIN, [color]: { ...DEFAULT_PIECE_SKIN[color], base: '#00ffcc', glow: true, gradStops: ['#33ffdd', '#00ffcc', '#00ccaa'] } });
  const h = canvas();
  drawCanvasPiece(h.ctx, 60, skin, 35, 45, color, true, 0.4, 0.75);
  expect(h.gradients[0]).toEqual([[0, '#33ffdd'], [0.7, '#00ffcc'], [1, '#00ccaa']]);
  expect(h.gradients[1]).toEqual([[0, '#ffe066'], [1, '#b8860b']]); // crown remains recognizable
  expect(h.styles).toContainEqual(['globalAlpha', 0.4]); expect(h.styles).toContainEqual(['shadowColor', '#00ffcc']);
  expect(h.calls).toContainEqual(['scale', 0.75, 0.75]);
  expect(h.state).toMatchObject({ globalAlpha: 0.8, shadowBlur: 0, shadowColor: 'none' });
});

it('uses the same gradient stops and glow policy for CSS replays', () => {
  const skin = normalizePieceSkin({ ...DEFAULT_PIECE_SKIN, red: { ...DEFAULT_PIECE_SKIN.red, glow: true } });
  const css = pieceSkinCss(skin);
  expect(css).toContain('#f87171 0%,#ef4444 70%,#dc2626 100%');
  expect(css).toContain(',0 0 8px #b91c1c');
  expect(css).not.toContain(',0 0 8px #1a1a1a');
});
