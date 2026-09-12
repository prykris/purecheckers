// The layout owns geometry; renderers receive an edge length in CSS pixels.
export function tableLayout(width, height, { finished = false, focused = false } = {}) {
  const w = Math.max(1, Number.isFinite(width) ? width : 1);
  const h = Math.max(1, Number.isFinite(height) ? height : 1);
  const mode = w > h * 1.2 ? 'landscape' : h - w < 190 ? 'focus' : h - w < 340 ? 'compact' : 'roomy';
  const rail = finished ? 0 : 84;
  // Collapse secondary content first, then reserve the minimum usable controls.
  const portraitChrome = finished ? (mode === 'focus' ? 190 : 220) : (mode === 'focus' ? 140 : 190);
  const available = focused
    ? mode === 'landscape' ? Math.min(h - 6, w - 106) : Math.min(w - 6, h - 50)
    : mode === 'landscape' ? Math.min(h - 6, w - rail - 226) : Math.min(w - 6, h - portraitChrome);
  return { mode, board: Math.max(1, Math.floor(available)), rail };
}
