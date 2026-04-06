// Re-export shared game module so it's accessible via $lib/game.js
// The original lives in /shared/game.js (used by both server and client)
export { CheckersGame, ColonelBot } from '../../shared/game.js';
