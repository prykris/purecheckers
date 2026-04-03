/**
 * Bot personality-driven emote system.
 *
 * Bots react to game moments — blunders, brilliant moves, captures, kings.
 * Emotes are rare (cooldown + probability), not every turn.
 */

const COOLDOWN_MS = 20000; // 20 seconds between emotes

const PERSONALITIES = {
  easy: {
    chattiness: 0.3,
    emotes: {
      playerBlunder:  { emoji: '😬', label: 'Oops' },
      playerBest:     { emoji: '👏', label: 'Nice!' },
      botCapture:     { emoji: '🤝', label: 'GG' },
      botKinged:      { emoji: '👑', label: 'King move' },
      botWinning:     { emoji: '👋', label: 'Hi!' },
    }
  },
  medium: {
    chattiness: 0.5,
    emotes: {
      playerBlunder:  { emoji: '🤔', label: 'Hmm...' },
      playerBest:     { emoji: '👏', label: 'Nice!' },
      botCapture:     { emoji: '🔥', label: 'On fire!' },
      botKinged:      { emoji: '👑', label: 'King move' },
      botWinning:     { emoji: '😂', label: 'Haha' },
    }
  },
  hard: {
    chattiness: 0.4,
    emotes: {
      playerBlunder:  { emoji: '😂', label: 'Haha' },
      playerBest:     { emoji: '🤔', label: 'Hmm...' },
      botCapture:     { emoji: '🔥', label: 'On fire!' },
      botKinged:      { emoji: '👑', label: 'King move' },
      botWinning:     { emoji: '😂', label: 'Haha' },
    }
  },
};

// Per-game cooldown tracking: gameId -> lastEmoteTime
const lastEmoteTimes = new Map();

/**
 * Decide if the bot should send an emote for a given trigger.
 * @param {string} trigger - 'playerBlunder' | 'playerBest' | 'botCapture' | 'botKinged' | 'botWinning'
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @param {number} gameId - for cooldown tracking
 * @returns {{ emoji: string, label: string } | null}
 */
export function shouldEmote(trigger, difficulty, gameId) {
  const personality = PERSONALITIES[difficulty];
  if (!personality) return null;

  const emote = personality.emotes[trigger];
  if (!emote) return null;

  // Cooldown check
  const now = Date.now();
  const lastTime = lastEmoteTimes.get(gameId) || 0;
  if (now - lastTime < COOLDOWN_MS) return null;

  // Probability roll
  if (Math.random() > personality.chattiness) return null;

  lastEmoteTimes.set(gameId, now);
  return emote;
}

/**
 * Determine triggers from a bot's move result.
 * @param {object} moveResult - { captured, promoted, chainContinues }
 * @param {object} game - current game state after move
 * @param {string} botColor - the bot's color
 * @returns {string[]} array of trigger names
 */
export function getMoveTriggers(moveResult, game, botColor) {
  const triggers = [];

  if (moveResult.captured.length >= 2) triggers.push('botCapture');
  else if (moveResult.captured.length === 1 && Math.random() < 0.3) triggers.push('botCapture');

  if (moveResult.promoted) triggers.push('botKinged');

  // Check if bot is winning big
  const score = game.evaluate(botColor);
  if (score > 8) triggers.push('botWinning');

  return triggers;
}

/**
 * Determine triggers from a player's move analysis.
 * @param {{ rating: string, scoreDiff: number }} analysis
 * @returns {string[]}
 */
export function getAnalysisTriggers(analysis) {
  const triggers = [];
  if (analysis.rating === 'blunder' && analysis.scoreDiff >= 3) triggers.push('playerBlunder');
  if (analysis.rating === 'best') triggers.push('playerBest');
  return triggers;
}

/**
 * Clean up cooldown tracking for a finished game.
 */
export function cleanupGame(gameId) {
  lastEmoteTimes.delete(gameId);
}
