/**
 * Phantom Player Manager — entry point.
 *
 * Standalone process that creates and manages phantom players.
 * Registers/logs in via HTTP, connects via socket.io, delegates
 * behavior to the reactive Brain.
 *
 * Usage: cd phantom && npm install && node index.js
 */

import 'dotenv/config';
import { PhantomPlayer } from './player.js';
import { Brain } from './brain.js';
import { PROFILES, rand } from './personality.js';
import { warmup, setPhantomNames } from './chat.js';

// ---- Config ----

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const ACTIVE_COUNT = parseInt(process.env.ACTIVE_COUNT || '3', 10);
const ENABLED = process.env.ENABLED !== 'false';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

if (!ENABLED) {
  console.log('[PhantomManager] Disabled via ENABLED=false');
  process.exit(0);
}

// ---- Auth ----

/**
 * Register a phantom account, or login if it already exists.
 * Returns a JWT token.
 */
async function authenticate(profile) {
  // Try register first
  try {
    const res = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: profile.username,
        email: profile.email,
        password: profile.password,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[Auth] Registered ${profile.username}`);
      return data.token;
    }

    // 409 = already exists, try login
    if (res.status === 409) {
      return await login(profile);
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Register failed: ${res.status}`);
  } catch (err) {
    if (err.message?.includes('fetch')) {
      throw new Error(`Cannot reach server at ${SERVER_URL} — is it running?`);
    }
    throw err;
  }
}

async function login(profile) {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: profile.email,
      password: profile.password,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`[Auth] Logged in ${profile.username}`);
    return data.token;
  }

  const err = await res.json().catch(() => ({}));
  throw new Error(`Login failed for ${profile.username}: ${err.error || res.status}`);
}

// ---- PhantomManager ----

class PhantomManager {
  constructor() {
    this.phantoms = new Map();    // username → PhantomPlayer
    this.tokens = new Map();      // username �� JWT
    this.brain = null;
    this.rotationInterval = null;
    this.shuttingDown = false;
  }

  async start() {
    console.log(`[PhantomManager] Starting with ${PROFILES.length} profiles, ${ACTIVE_COUNT} active target`);
    console.log(`[PhantomManager] Server: ${SERVER_URL}`);

    // Authenticate all profiles
    for (const profile of PROFILES) {
      try {
        const token = await authenticate(profile);
        this.tokens.set(profile.username, token);

        const player = new PhantomPlayer(profile, token, SERVER_URL);
        player.chatConfig = { ollamaUrl: OLLAMA_URL, ollamaModel: OLLAMA_MODEL };
        this.phantoms.set(profile.username, player);
      } catch (err) {
        console.error(`[PhantomManager] Failed to auth ${profile.username}: ${err.message}`);
      }
    }

    if (this.phantoms.size === 0) {
      console.error('[PhantomManager] No phantoms authenticated, exiting');
      process.exit(1);
    }

    console.log(`[PhantomManager] ${this.phantoms.size} phantoms ready`);

    // Let chat module know which usernames are phantoms (for friend tagging)
    setPhantomNames([...this.phantoms.keys()]);

    // Warm up LLM model so first chat isn't slow
    await warmup({ ollamaUrl: OLLAMA_URL, ollamaModel: OLLAMA_MODEL });

    // Create brain
    this.brain = new Brain(this.phantoms, {
      ollamaUrl: OLLAMA_URL,
      ollamaModel: OLLAMA_MODEL,
      activeCount: ACTIVE_COUNT,
    });
    this.brain.start();

    // Bring initial batch online with staggered timing
    await this._bringOnline(ACTIVE_COUNT);

    // Rotation loop: maintain active count, cycle phantoms
    this.rotationInterval = setInterval(() => this._rotationCheck(), 30000);
  }

  async _bringOnline(count) {
    // Filter out phantoms that are currently on a forced break
    const eligible = [...this.phantoms.values()]
      .filter(p => !p.connected)
      .filter(p => !this.brain.isOnBreak(p.name));

    if (eligible.length === 0) {
      console.log('[PhantomManager] No eligible phantoms to bring online (all on break)');
      return;
    }

    // Shuffle so we don't always pick the same phantom first
    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const toConnect = shuffled.slice(0, count);

    for (let i = 0; i < toConnect.length; i++) {
      if (this.shuttingDown) break;
      const player = toConnect[i];

      // Stagger connections
      if (i > 0) {
        await sleep(rand(5000, 15000));
      }

      try {
        await player.connect();
        this.brain.onPhantomOnline(player);
      } catch (err) {
        console.error(`[PhantomManager] ${player.name} connection failed: ${err.message}`);
      }
    }
  }

  _rotationCheck() {
    if (this.shuttingDown) return;

    const online = [...this.phantoms.values()].filter(p => p.connected);
    const onlineIdle = online.filter(p => p.isIdle);

    // Check for phantoms whose session expired and are idle — disconnect them
    for (const player of onlineIdle) {
      if (this.brain.isSessionExpired(player.name)) {
        console.log(`[PhantomManager] ${player.name} session expired, taking offline`);
        this.brain.onPhantomOffline(player);
        player.disconnect();
      }
    }

    // If below active count, bring more online
    const currentOnline = [...this.phantoms.values()].filter(p => p.connected).length;
    if (currentOnline < ACTIVE_COUNT) {
      const needed = ACTIVE_COUNT - currentOnline;
      console.log(`[PhantomManager] ${currentOnline}/${ACTIVE_COUNT} online, bringing ${needed} more`);
      this._bringOnline(needed);
    }
  }

  async stop() {
    this.shuttingDown = true;
    console.log('[PhantomManager] Shutting down...');

    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }

    if (this.brain) {
      this.brain.stop();
    }

    // Disconnect all phantoms
    for (const player of this.phantoms.values()) {
      if (player.connected) {
        player.disconnect();
      }
    }

    console.log('[PhantomManager] Shutdown complete');
  }
}

// ---- Utility ----

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Main ----

const manager = new PhantomManager();

process.on('SIGINT', async () => {
  await manager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await manager.stop();
  process.exit(0);
});

manager.start().catch((err) => {
  console.error('[PhantomManager] Fatal error:', err);
  process.exit(1);
});
