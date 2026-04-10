/**
 * Phantom chat generation.
 *
 * Primary: local Ollama LLM for contextual, personality-aware messages.
 * Fallback: categorized template pool when Ollama is unavailable.
 */

const OLLAMA_TIMEOUT = 15000; // gemma4 needs ~9s on cold start, ~1s after

// ---- Template fallback (grouped by context + tone) ----

const TEMPLATES = {
  just_joined: {
    friendly:     ['hey everyone', 'hi all', 'heyyy', 'whats good', 'back again lol'],
    competitive:  ['whos next', 'ready to play', 'looking for a challenge', 'im back'],
    chill:        ['hey', 'yo', 'sup', 'whats up'],
    troll:        ['did yall miss me', 'the king is back', 'prepare yourselves', 'ez games incoming'],
  },
  won_game: {
    friendly:     ['gg!', 'that was fun', 'good game', 'close one!', 'gg thanks for the game'],
    competitive:  ['gg', 'too easy', 'another W', 'lets goo', 'on a roll'],
    chill:        ['gg', 'nice game', 'was fun', 'gg wp'],
    troll:        ['gg ez', 'not even close', 'get rekt lol', 'too easy gg', 'yawn'],
  },
  lost_game: {
    friendly:     ['gg wp', 'nice game!', 'you played well', 'almost had it', 'good moves'],
    competitive:  ['gg', 'rematch?', 'next time', 'ill be back', 'lucky game'],
    chill:        ['gg', 'nice', 'wp', 'ah well gg'],
    troll:        ['whatever', 'lag', 'i wasnt trying', 'rigged', 'ok that was bs lol'],
  },
  idle_bored: {
    friendly:     ['anyone wanna play?', 'looking for a game', 'who wants to play?', 'bored lol'],
    competitive:  ['whos up for a match', 'challenge me', 'need an opponent', 'someone play me'],
    chill:        ['anyone playing?', 'any games?', 'kinda bored', 'one more game?'],
    troll:        ['this place is dead', 'hello?? anyone??', 'where is everyone', 'bored af'],
  },
  responding: {
    friendly:     ['lol', 'nice', 'haha', 'for real', 'true', 'yeah', 'right?'],
    competitive:  ['facts', 'true', 'lets go then', 'bet', 'same'],
    chill:        ['lol', 'yeah', 'haha true', 'nice', 'fr'],
    troll:        ['lmao', 'sure buddy', 'cope', 'ok', 'lol whatever', 'bruh'],
  },
  leaving: {
    friendly:     ['gotta go, bye!', 'later everyone', 'see ya!', 'bye bye', 'have fun yall'],
    competitive:  ['im out', 'gotta run', 'later', 'peace'],
    chill:        ['later', 'peace', 'brb', 'gotta go'],
    troll:        ['im bored bye', 'this was mid', 'later losers', 'peace out'],
  },
  in_game: {
    friendly:     ['nice move', 'ooh good one', 'haha didnt see that', 'well played', 'oooo'],
    competitive:  ['hmm interesting', 'saw that coming', 'not bad', 'watch this', 'calculated'],
    chill:        ['oh', 'hm', 'nice', 'oops', 'lol ok'],
    troll:        ['really?', 'lol', 'bruh', 'you serious?', 'thats it?', 'yikes'],
  },
  mention_reply: {
    friendly:     ['hey!', 'whats up?', 'yeah?', 'haha hey', 'you called?'],
    competitive:  ['what', 'sup', 'want a rematch?', 'im right here', 'bring it'],
    chill:        ['yo', 'hey', 'whats good', 'yeah?'],
    troll:        ['what do you want', 'dont @ me', 'lol what', 'oh no not again', 'miss me?'],
  },
};

/**
 * Pick a random template for a given context and tone.
 */
function pickTemplate(context, tone) {
  const category = TEMPLATES[context];
  if (!category) return null;
  const pool = category[tone] || category.chill;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---- Output validation ----

const REJECT_PATTERNS = [
  /\bai\b/i, /\bbot\b/i, /\bartificial/i, /\blanguage model/i, /\bllm\b/i,
  /\bmachine learning/i, /\bneural/i, /\btrained\b/i, /\bprogrammed/i,
  /\bI am an?\b/i, /\bI'm an?\s+(AI|bot|assistant)/i,
  /\busername is\b/i, /\bmy name is\b/i,  // self-introduction spam
  /\bwelcome to\b/i, /\bgreetings\b/i,    // overly formal
  /#\w+/, /@\w+/,                          // hashtags, @mentions
  /https?:\/\//,                           // URLs
  /\bfeel free\b/i, /\bhow are you\b/i,   // assistant-speak
  /\bI don't need\b/i, /\bplease stop\b/i,
  /😊/, /🤗/,                              // assistant-typical emojis
];

/**
 * Validate LLM output. Returns cleaned text or null if rejected.
 */
function validateMessage(text) {
  if (!text || text.length === 0) return null;

  // Strip surrounding quotes
  text = text.replace(/^["']|["']$/g, '').trim();

  // Take only the first line (reject multi-line essays)
  text = text.split('\n')[0].trim();

  // Hard length limit
  if (text.length > 80) text = text.slice(0, 80).trim();
  if (text.length < 2) return null;

  // Reject patterns that scream "AI"
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(text)) return null;
  }

  // Reject if too many capital letters (formal tone)
  const caps = (text.match(/[A-Z]/g) || []).length;
  if (caps > text.length * 0.4 && text.length > 5) return null;

  // Reject if it has too many sentences (should be 1, max 2)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 2) return null;

  return text;
}

// ---- LLM generation via Ollama ----

const SYSTEM_PROMPT = `You are a real person chatting in a small online game's chat. You're not an assistant. You don't help people. You're just hanging out.

RULES:
- MAX 60 characters
- One message only, no quotes
- Respond naturally to what people are saying, like texting a friend
- You can talk about anything, not just the game
- Lowercase, casual, abbreviations ok
- If someone says something funny, laugh. If someone asks you something, answer like a normal person
- NEVER say you're an AI, bot, or assistant
- NEVER introduce yourself or describe yourself`;


// Set of all phantom usernames — populated at startup
let phantomNames = new Set();

/**
 * Call once at init to let the chat module know which names are phantoms.
 */
export function setPhantomNames(names) {
  phantomNames = new Set(names);
}

function buildUserPrompt(personality, context, recentMessages, banterContext, playerState) {
  let parts = [];

  parts.push(`Your name: ${personality.username}`);
  parts.push(`Your vibe: ${personality.tone}`);

  if (playerState) {
    parts.push(`What you're doing: ${playerState}`);
  }

  if (banterContext) {
    parts.push(banterContext);
  }

  if (context && context !== 'responding') {
    parts.push(`Context: ${context}`);
  }

  if (recentMessages && recentMessages.length > 0) {
    parts.push(`Chat:`);
    for (const msg of recentMessages.slice(-6)) {
      const isFriend = phantomNames.has(msg.username) && msg.username !== personality.username;
      const prefix = isFriend ? '(friend) ' : '';
      parts.push(`  ${prefix}${msg.username}: ${msg.content}`);
    }
  }

  parts.push(`\n${personality.username}:`);
  return parts.join('\n');
}

/**
 * Generate a chat message via Ollama.
 * Returns null on failure (caller should fall back to template).
 */
async function generateWithLLM(personality, context, recentMessages, config, banterContext, playerState) {
  if (!config.ollamaUrl || !config.ollamaModel) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

  try {
    const res = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: buildUserPrompt(personality, context, recentMessages, banterContext, playerState),
        system: SYSTEM_PROMPT,
        stream: false,
        options: {
          temperature: 0.9,
          top_p: 0.95,
          num_predict: 40,
        },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const raw = (data.response || '').trim();
    return validateMessage(raw);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---- Public API ----

let ollamaAvailable = null; // null = untested, true/false = cached result
let ollamaCheckTime = 0;
const OLLAMA_RECHECK_INTERVAL = 60000; // recheck every 60s

async function isOllamaUp(config) {
  const now = Date.now();
  if (ollamaAvailable !== null && now - ollamaCheckTime < OLLAMA_RECHECK_INTERVAL) {
    return ollamaAvailable;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    ollamaAvailable = res.ok;
  } catch {
    ollamaAvailable = false;
  }
  ollamaCheckTime = now;
  return ollamaAvailable;
}

/**
 * Generate a chat message for a phantom.
 *
 * @param {object} personality - phantom personality profile
 * @param {string} context - situation key: 'just_joined', 'won_game', 'lost_game', 'idle_bored', 'responding', 'leaving'
 * @param {object[]} recentMessages - last few global chat messages [{username, content}]
 * @param {object} config - { ollamaUrl, ollamaModel }
 * @returns {Promise<string|null>} message text, or null if chat should be skipped
 */
/**
 * @param {object} personality
 * @param {string} context - situation key
 * @param {object[]} recentMessages
 * @param {object} config
 * @param {string} [banterContext] - extra context about opponent/game history
 * @param {string} [playerState] - what the phantom is currently doing
 */
export async function generateChat(personality, context, recentMessages, config, banterContext, playerState) {
  // Try LLM first — always attempt if available
  if (await isOllamaUp(config)) {
    const llmMessage = await generateWithLLM(personality, context, recentMessages, config, banterContext, playerState);
    if (llmMessage) return llmMessage;
  }

  // Fallback to templates only when LLM is down or rejected by validation
  return pickTemplate(context, personality.tone);
}

/**
 * Warm up the Ollama model so the first real request isn't slow.
 * Call once at startup.
 */
export async function warmup(config) {
  if (!config.ollamaUrl || !config.ollamaModel) return;
  console.log(`[Chat] Warming up ${config.ollamaModel}...`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    await fetch(`${config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: 'hi',
        stream: false,
        options: { num_predict: 1 },
      }),
    });
    clearTimeout(timeout);
    console.log(`[Chat] ${config.ollamaModel} warmed up`);
  } catch {
    console.log(`[Chat] Warmup failed — will use templates`);
  }
}
