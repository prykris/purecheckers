export const CHAT_EVENTS = { send: 'chat:v2:send', history: 'chat:v2:history', message: 'chat:v2:message' };
export const CHAT_PAGE_SIZE = 50;
export const CHAT_MAX_LENGTH = 300;
export const CHAT_RATE_MS = 1000;

export function parseChatChannel(value) {
  if (value === 'global') return { type: 'global', id: null };
  const match = typeof value === 'string' && /^(room|game):([1-9]\d*)$/.exec(value);
  if (!match || !Number.isSafeInteger(Number(match[2]))) return null;
  return { type: match[1], id: Number(match[2]) };
}

export function validChatMessageId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Render every segment as text. Chat content is never HTML.
export function mentionSegments(content) {
  return String(content ?? '').split(/(@[\p{L}\p{N}_]+)/u).filter(Boolean)
    .map(text => ({ text, mention: text.startsWith('@') }));
}
