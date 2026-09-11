import { DEFAULT_THEME_VARS } from '../../shared/themes.js';

// A rendering effect of the accepted appearance projection, with no saved
// selection of its own. Account replacement/disposal restores the basic theme.
export function renderTheme(theme, root = document.documentElement) {
  for (const [key, value] of Object.entries(theme?.vars ?? DEFAULT_THEME_VARS)) root.style.setProperty(key, value);
}
