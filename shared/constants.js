// ============================================================
// Centralized config — all tunable values in one place
// ============================================================

// ---- Game ----
export const TURN_TIME = 60;
export const BOARD_SIZE = 8;
export const DRAW_REPETITION_COUNT = 3;     // 3-fold repetition → forced draw
export const DRAW_NO_CAPTURE_MOVES = 50;    // 50 half-moves (25 full) without capture → forced draw
export const DRAW_OFFER_COOLDOWN_MS = 30000; // 30s cooldown between draw offers

// ---- ELO ----
export const ELO_START = 1000;
export const ELO_K_NEW = 32;
export const ELO_K_EXPERIENCED = 16;
export const ELO_NEW_THRESHOLD = 30;  // games before K drops

// ---- Matchmaking ----
export const MATCHMAKING_BASE_WINDOW = 100;
export const MATCHMAKING_WINDOW_GROWTH = 50;  // per 10 seconds
export const MATCHMAKING_MAX_WINDOW = 500;

// ---- Economy: Faucets (coins entering) ----
export const STARTER_COINS = 5;           // given on registration
export const COINS_RANKED_WIN = 10;       // base reward for ranked win
export const COINS_BOT_WIN = 5;           // reward for beating the bot
export const COINS_LOSS = 2;              // consolation for losing
export const DAILY_BOUNTY_AMOUNT = 2;     // first win of day (from vault)

// ---- Economy: ELO Milestones (one-time, paid from vault) ----
export const ELO_MILESTONES = [
  { elo: 1200, reward: 10, name: 'Bronze' },
  { elo: 1400, reward: 20, name: 'Silver' },
  { elo: 1600, reward: 35, name: 'Gold' },
  { elo: 1800, reward: 50, name: 'Platinum' },
  { elo: 2000, reward: 75, name: 'Diamond' },
];

// ---- Economy: Circulation (tax + vault) ----
export const RANKED_TAX_RATE = 0.05;      // 5% of pot goes to vault
export const SHOP_BURN_RATE = 0.70;       // 70% of purchase destroyed
export const SHOP_VAULT_RATE = 0.30;      // 30% of purchase to vault

// ---- Economy: Anti-Fraud ----
export const MAX_DAILY_WINS_VS_SAME = 0;  // 0 = disabled. Set >0 to enable diminishing returns
export const MIN_WAGER_MOVES = 10;        // minimum moves for valid wager
export const MIN_WAGER_DURATION_MS = 2 * 60 * 1000;  // 2 minutes
