import { CHAT_MAX_LENGTH, CHAT_PAGE_SIZE, CHAT_RATE_MS, parseChatChannel, validChatMessageId } from '../../shared/chat.js';

const failure = (code, error, extra = {}) => ({ ok: false, code, error, ...extra });
// Keep persisted text safe for a previous server during a rolling deployment.
// The versioned chat wire format and all current UI render plain text.
export const encodeChatText = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const chatMessageView = row => ({ ...row, content: row.content.replace(/&(amp|lt|gt);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>' })[entity]) });

export function chatAccess(session, actor, channelId) {
  const channel = parseChatChannel(channelId);
  if (!channel || !session || session.connectionId !== actor.connectionId) return false;
  if (channel.type === 'global') return true;
  if (channel.type === 'room') return (session.phase === 'in-room' && session.roomId === channel.id)
    || (session.phase === 'spectating' && session.spectatingRoomId === channel.id);
  return (session.phase === 'in-game' && session.gameId === channel.id)
    || (session.phase === 'spectating' && session.spectatingGameId === channel.id);
}

export function createChatService({ db, getSession, getGame, getConnections, now = Date.now }) {
  const canAccess = (actor, channelId) => chatAccess(getSession(actor.userId), actor, channelId);
  function metadata(actor, channelId, content) {
    const names = new Set([...content.matchAll(/@([\p{L}\p{N}_]+)/gu)].map(m => m[1].toLowerCase()));
    const mentions = new Set([...getConnections()].filter(([, c]) => names.has(c.username?.toLowerCase())).map(([id]) => id));
    const channel = parseChatChannel(channelId), game = channel.type === 'game' ? getGame(channel.id) : null;
    const spectator = channel.type === 'game' && getSession(actor.userId)?.phase === 'spectating';
    if (game) {
      if (spectator) { mentions.delete(game.redUserId); mentions.delete(game.blackUserId); }
      else { const opponent = game.getOpponentId(actor.userId); if (opponent) mentions.add(opponent); }
    }
    mentions.delete(actor.userId);
    return { mentions: [...mentions], spectator };
  }
  return {
    canAccess,
    async send(actor, payload) {
      const { channelId, clientMessageId } = payload ?? {};
      const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
      if (!parseChatChannel(channelId) || !validChatMessageId(clientMessageId) || !content || content.length > CHAT_MAX_LENGTH)
        return failure('invalid', 'Enter a message of 1–300 characters.');
      if (!canAccess(actor, channelId)) return failure('forbidden', 'You no longer have access to this chat.');
      return db.$transaction(async tx => {
        // One durable idempotency/rate policy, including simultaneous retries and reconnects.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(73190604, ${actor.userId}::integer)`;
        if (!canAccess(actor, channelId)) return failure('forbidden', 'You no longer have access to this chat.');
        const previous = await tx.chatMessage.findUnique({ where: { senderId_clientMessageId: { senderId: actor.userId, clientMessageId } } });
        if (previous) return previous.channelId === channelId && previous.content === encodeChatText(content)
          ? { ok: true, message: chatMessageView(previous), created: false }
          : failure('conflict', 'This message identifier was already used.');
        const latest = await tx.chatMessage.findFirst({ where: { senderId: actor.userId, channelId }, orderBy: { id: 'desc' }, select: { createdAt: true } });
        const retryAfterMs = latest ? latest.createdAt.getTime() + CHAT_RATE_MS - now() : 0;
        if (retryAfterMs > 0) return failure('rate_limited', 'Please wait a moment before sending again.', { retryAfterMs });
        const message = await tx.chatMessage.create({ data: { channelId, clientMessageId, content: encodeChatText(content),
          senderId: actor.userId, username: getSession(actor.userId).username, ...metadata(actor, channelId, content) } });
        return { ok: true, message: chatMessageView(message), created: true };
      });
    },
    async history(actor, payload) {
      const { channelId, beforeId } = payload ?? {};
      if (!parseChatChannel(channelId) || (beforeId !== undefined && (!Number.isSafeInteger(beforeId) || beforeId < 1)))
        return failure('invalid', 'Invalid chat history request.');
      if (!canAccess(actor, channelId)) return failure('forbidden', 'You no longer have access to this chat.');
      const rows = await db.chatMessage.findMany({ where: { channelId, ...(beforeId ? { id: { lt: beforeId } } : {}) },
        orderBy: { id: 'desc' }, take: CHAT_PAGE_SIZE + 1 });
      if (!canAccess(actor, channelId)) return failure('forbidden', 'You no longer have access to this chat.');
      return { ok: true, messages: rows.slice(0, CHAT_PAGE_SIZE).reverse().map(chatMessageView), hasMore: rows.length > CHAT_PAGE_SIZE };
    }
  };
}
