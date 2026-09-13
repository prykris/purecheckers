// The layout owns geometry; renderers receive an edge length in CSS pixels.
export function tableLayout(width, height, { finished = false, focused = false } = {}) {
  const w = Math.max(1, Number.isFinite(width) ? width : 1);
  const h = Math.max(1, Number.isFinite(height) ? height : 1);
  const sidebar = Math.max(260, Math.min(360, w * .28));
  const stackedBoard = Math.min(w - 38, h - 320);
  // A sidebar earns its space only when it preserves the vertical layout's board size.
  const fitsSidebar = w - sidebar - 62 >= stackedBoard;
  const mode = focused
    ? (w > h * 1.2 ? 'landscape' : 'roomy')
    : w > h * 1.2 ? 'landscape'
    : w >= 900 && h >= 650 && fitsSidebar ? 'desktop'
    : w >= 600 && h >= 650 ? 'stacked'
    : h - w < 190 ? 'focus' : h - w < 340 ? 'compact' : 'roomy';
  const rail = finished ? 0 : 84;
  // Collapse secondary content first, then reserve the minimum usable controls.
  const portraitChrome = mode === 'focus' ? 140 : 190;
  const replaySize = ['desktop', 'landscape'].includes(mode)
    ? Math.min(h - 74, w - (mode === 'desktop' ? sidebar + 62 : 226))
    : Math.min(w - (mode === 'stacked' ? 38 : 6), h - 350);
  const available = focused
    ? mode === 'landscape' ? Math.min(h - 6, w - 106) : Math.min(w - 6, h - 50)
    : finished ? replaySize
    : mode === 'desktop' ? Math.min(w - sidebar - 62, h - 150)
    : mode === 'stacked' ? stackedBoard
    : mode === 'landscape' ? Math.min(h - 6, w - rail - 226) : Math.min(w - 6, h - portraitChrome);
  return { mode, board: Math.max(1, Math.floor(available)), rail };
}
