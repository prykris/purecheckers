// Client-side shim: re-exports shared game classes as globals for the prototype app.js
// This will be removed when app.js is converted to ES modules in Phase 3
import { CheckersGame, ColonelBot } from '../shared/game.js';
window.CheckersGame = CheckersGame;
window.ColonelBot = ColonelBot;
