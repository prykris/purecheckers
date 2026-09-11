export const BOT_DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
export const botDifficultyLabel = value => ({ easy: 'Easy', medium: 'Medium', hard: 'Hard' })[value] || 'Medium';

// Validate the presentation the picker actually consumes. A partial/duplicate
// roster must not silently associate a bot name or rating with another level.
export function parseBotRoster(value) {
  const rows = value?.bots;
  if (!Array.isArray(rows) || rows.length !== BOT_DIFFICULTIES.length) throw Error('Invalid bot roster');
  const seen = new Set();
  const roster = rows.map(row => {
    if (!row || !BOT_DIFFICULTIES.includes(row.difficulty) || row.key !== row.difficulty || seen.has(row.difficulty) ||
        typeof row.displayName !== 'string' || !row.displayName.trim() || row.displayName.length > 40 ||
        !Number.isSafeInteger(row.rating) || row.rating < 0) throw Error('Invalid bot roster');
    seen.add(row.difficulty);
    return { difficulty: row.difficulty, displayName: row.displayName, rating: row.rating };
  });
  return BOT_DIFFICULTIES.map(difficulty => roster.find(bot => bot.difficulty === difficulty));
}
