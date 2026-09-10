// Keys are permanent account identities. Names, ratings and search depth are defaults.
export const BOT_REGISTRY = Object.freeze({
  easy: Object.freeze({ key: 'easy', username: 'Bot Easy', initialElo: 600, depth: 2 }),
  medium: Object.freeze({ key: 'medium', username: 'Bot Medium', initialElo: 1000, depth: 4 }),
  hard: Object.freeze({ key: 'hard', username: 'Bot Hard', initialElo: 1400, depth: 6 }),
});
export function getBotDefinition(key) {
  return typeof key === 'string' && Object.hasOwn(BOT_REGISTRY, key) ? BOT_REGISTRY[key] : null;
}
