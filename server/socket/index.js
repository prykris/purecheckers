import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PROTOCOL_VERSION } from '../../shared/protocol.js';
import { JWT_SECRET } from '../config.js';
import { attachCommandTransport } from './commandRouter.js';
import { connectedUsers } from './connections.js';
import { setupPresence, getStats, broadcastStats } from './presenceHandler.js';
import { setupChatHandler } from './chatHandler.js';
import { createGameActions, activeGames, startMatchmaking, stopMatchmaking } from '../domain/games.js';
import { createRoomActions, gameRooms, sanitizeRoom, broadcastRoomUpdate } from '../domain/rooms.js';
import { getSession, getOrCreateSession, handleDisconnect, handleReconnect, setOnPhaseChange, getAllSessions } from '../domain/sessions.js';
import { buildSyncPayload } from '../domain/snapshots.js';
import { createSessionDispatcher } from '../domain/sessionCommands.js';
import { configureEvents } from '../domain/events.js';
import { configureLifecycle, restoreMembership } from '../domain/lifecycle.js';

export const serverId = randomUUID();

function reconcileSubscriptions(socket, session) {
  const channels = new Set();
  const roomId = session.phase === 'in-room' ? session.roomId : session.spectatingRoomId;
  const gameId = session.phase === 'in-game' ? session.gameId : session.spectatingGameId;
  if (roomId) { channels.add('room:' + roomId); channels.add('chat:room:' + roomId); }
  if (gameId) { channels.add('game:' + gameId); channels.add('chat:game:' + gameId); }
  for (const name of socket.rooms) {
    if (/^(room:|game:|chat:room:|chat:game:)/.test(name) && !channels.has(name)) socket.leave(name);
  }
  for (const name of channels) socket.join(name);
}

export function emitSyncState(socket, userId) {
  const session = getSession(userId);
  if (!session || session.connectionId !== socket.id) return null;
  reconcileSubscriptions(socket, session);
  const payload = buildSyncPayload(userId, { gameRooms, activeGames, getPresenceStats: getStats, sanitizeRoom });
  Object.assign(payload, {
    protocolVersion: PROTOCOL_VERSION, serverId, serverTime: Date.now(), connectionId: socket.id,
    sequence: session.snapshotSequence = (session.snapshotSequence || 0) + 1,
    context: { gameId: session.gameId, roomId: session.roomId, spectatingRoomId: session.spectatingRoomId }
  });
  socket.emit('sync:state', payload);
  return payload;
}

function publishUser(userId) {
  const connection = connectedUsers.get(userId);
  if (connection) emitSyncState(connection.socket, userId);
}
function publishGame(gameId) {
  for (const session of getAllSessions().values()) {
    if (session.gameId === gameId || session.spectatingGameId === gameId) publishUser(session.userId);
  }
}

export function setupSocket(io) {
  configureEvents({ publishUser, publishGame,
    broadcast: (event, data) => io.emit(event, data),
    notifyChannel: (channel, event, data) => io.to(channel).emit(event, data),
    notifyUser: (userId, event, data) => connectedUsers.get(userId)?.socket.emit(event, data)
  });
  configureLifecycle();
  setOnPhaseChange(() => broadcastStats(io));
  startMatchmaking();
  io.engine.on('close', stopMatchmaking);
  io.use((socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, JWT_SECRET);
      socket.userId = payload.userId; socket.username = payload.username; socket.isGuest = !!payload.isGuest;
      next();
    } catch { next(new Error('Invalid token')); }
  });
  io.on('connection', socket => {
    const session = getOrCreateSession(socket.userId, socket.username, socket.isGuest);
    const existing = connectedUsers.get(socket.userId);
    connectedUsers.set(socket.userId, { socketId: socket.id, socket, username: socket.username });
    handleReconnect(socket.userId, socket.id);
    if (existing && existing.socketId !== socket.id) {
      existing.socket.emit('session:kicked', { reason: 'Logged in from another device' });
      existing.socket.disconnect(true);
    }
    const actor = { userId: socket.userId, username: socket.username, isGuest: socket.isGuest, connectionId: socket.id };
    const games = createGameActions(actor), rooms = createRoomActions(actor);
    attachCommandTransport(socket, session, { serverId, publish: emitSyncState, dispatch: createSessionDispatcher(session, { ...games, ...rooms }) });
    restoreMembership(socket.userId);
    if (session.roomId && gameRooms.has(session.roomId)) broadcastRoomUpdate(gameRooms.get(session.roomId));
    setupChatHandler(io, socket);
    setupPresence(io, socket);
    // Non-authoritative notifications never mutate gameplay or session state.
    for (const [event, action] of [['room:list', rooms['room:list']], ['emote:send', games['emote:send']]]) {
      socket.on(event, data => {
        if (session.connectionId !== socket.id) return;
        try { action(data && typeof data === 'object' ? data : {}); } catch (error) { console.error(event, error); }
      });
    }
    emitSyncState(socket, socket.userId);
    socket.on('sync:request', (_data, ack) => {
      const snapshot = emitSyncState(socket, socket.userId);
      if (typeof ack === 'function') ack(snapshot);
    });
    socket.on('disconnect', () => {
      if (session.connectionId !== socket.id) return;
      connectedUsers.delete(socket.userId);
      handleDisconnect(socket.userId);
      games.disconnect(); rooms.disconnect();
      if (session.gameId) publishGame(session.gameId);
      broadcastStats(io);
    });
  });
}
