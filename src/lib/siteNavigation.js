import { projectNavigation } from './navigationPolicy.js';

export const AUTH_PATHS = Object.freeze({ guest: '/auth', login: '/login', register: '/register', recovery: '/forgot-password' });
export function safeReturnTo(value, fallback = '/lobby') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://purecheckers.local');
    if (url.origin !== 'https://purecheckers.local' || Object.values(AUTH_PATHS).includes(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}
export function authHref(view = 'guest', returnTo = '/lobby', language = 'en') {
  const query = new URLSearchParams({ returnTo: safeReturnTo(returnTo) });
  if (language === 'es') query.set('lang', 'es');
  return `${AUTH_PATHS[view] || AUTH_PATHS.guest}?${query}`;
}
export function gameEntry(identity, session, language = 'en') {
  if (!identity) return { href: authHref('guest', '/lobby', language), label: language === 'es' ? 'Jugar gratis' : 'Play free' };
  const snapshot = session?.status === 'ready' ? session.snapshot : null;
  if (!snapshot) return { href: '/lobby', label: language === 'es' ? 'Volver al juego' : 'Return to game' };
  const labels = language === 'es'
    ? { 'in-game': 'Continuar partida', 'in-room': 'Volver a la sala', matchmaking: 'Volver a la búsqueda', spectating: 'Seguir observando', idle: 'Jugar' }
    : { 'in-game': 'Continue game', 'in-room': 'Return to room', matchmaking: 'Resume search', spectating: 'Continue watching', idle: 'Play' };
  return { href: projectNavigation(snapshot, { kind: 'session' }).url, label: labels[snapshot.phase] || labels.idle };
}
