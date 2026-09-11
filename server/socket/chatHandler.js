import { CHAT_EVENTS } from '../../shared/chat.js';
import prisma from '../db.js';
import { connectedUsers } from './connections.js';
import { getSession } from '../domain/sessions.js';
import { activeGames } from '../domain/games.js';
import { createChatService } from '../services/chat.js';

const chat = createChatService({ db: prisma, getSession, getGame: id => activeGames.get(id), getConnections: () => connectedUsers });

export function setupChatHandler(io, socket) {
  socket.join('chat:global');
  const actor = { userId: socket.userId, connectionId: socket.id };
  for (const [event, operation] of [[CHAT_EVENTS.send, 'send'], [CHAT_EVENTS.history, 'history']]) {
    socket.on(event, async (payload, ack) => {
      if (typeof ack !== 'function') return;
      try {
        const result = await chat[operation](actor, payload);
        if (result.ok && result.created) io.to('chat:' + result.message.channelId).emit(CHAT_EVENTS.message, result.message);
        const { created, ...response } = result;
        ack(response);
      } catch (error) {
        console.error(event + ' failed:', error?.message || error);
        ack({ ok: false, code: 'unavailable', error: 'Chat is temporarily unavailable. Try again.' });
      }
    });
  }
}
