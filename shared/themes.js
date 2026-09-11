export const DEFAULT_THEME_VARS = Object.freeze({
  '--bg': '#1c1917', '--bg-subtle': '#231f1b', '--surface': '#292524', '--surface2': '#3d3530',
  '--accent': '#ef4444', '--accent2': '#a855f7', '--text': '#fafaf9', '--text-dim': '#a8a29e',
  '--board-light': '#d4a76a', '--board-dark': '#7c5e3c', '--gold': '#fbbf24', '--success': '#22c55e', '--warning': '#f59e0b'
});

// Catalogue data supplies colours only, never arbitrary CSS or URLs. Missing
// optional colours inherit the basic theme, so switching always clears old values.
export function normalizeTheme(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length) return null;
  if (Object.entries(data).some(([key, value]) => !Object.hasOwn(DEFAULT_THEME_VARS, key) ||
      typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))) return null;
  return { ...DEFAULT_THEME_VARS, ...data };
}
