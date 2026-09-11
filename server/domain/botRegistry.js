// Keys are permanent account identities. Names, ratings and search depth are defaults.
// displayName, tagline and avatar are presentation only: the account username is never
// renamed by the registry, and chat, emotes and rosters show the display name.
export const BOT_REGISTRY = Object.freeze({
  easy: Object.freeze({ key: 'easy', username: 'Bot Easy', initialElo: 600, depth: 2,
    displayName: 'Pip', tagline: 'learning the ropes', avatar: '🐣' }),
  medium: Object.freeze({ key: 'medium', username: 'Bot Medium', initialElo: 1000, depth: 4,
    displayName: 'Marge', tagline: 'solid and patient', avatar: '🦉' }),
  hard: Object.freeze({ key: 'hard', username: 'Bot Hard', initialElo: 1400, depth: 6,
    displayName: 'The Colonel', tagline: 'does not forgive blunders', avatar: '🎖️' }),
});
export function getBotDefinition(key) {
  return typeof key === 'string' && Object.hasOwn(BOT_REGISTRY, key) ? BOT_REGISTRY[key] : null;
}
export function getBotDisplayName(key) {
  return getBotDefinition(key)?.displayName || 'Bot';
}
