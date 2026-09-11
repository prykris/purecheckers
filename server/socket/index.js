import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PROTOCOL_VERSION } from '../../shared/protocol.js';
import { JWT_SECRET } from '../config.js';
import { authorizeAccount, AccountError } from '../services/accounts.js';
import { attachCommandTransport } from './commandRouter.js';
import { connectedUsers } from './connections.js';
import { setupPresence, getStats, broadcastStats } from './presenceHandler.js';
import { setupChatHandler } from './chatHandler.js';
import { createGameActions, activeGames, startMatchmaking, stopMatchmaking } from '../domain/games.js';
import { createRoomActions, gameRooms, sanitizeRoom, broadcastRoomUpdate, tryStartRoom } from '../domain/rooms.js';
import { getSession, getOrCreateSession, handleDisconnect, handleReconnect, setOnPhaseChange, getAllSessions } from '../domain/sessions.js';
import { createNoticeActions } from '../domain/notices.js';
import { buildSyncPayload } from '../domain/snapshots.js';
import { createSessionDispatcher } from '../domain/sessionCommands.js';
import { configureEvents } from '../domain/events.js';
import { configureLifecycle, restoreMembership } from '../domain/lifecycle.js';
import { runGameplayWork } from '../services/gameplayWork.js';
import { enqueueSessionWork } from '../domain/sessionWork.js';

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
  if (!session || session.connectionId !== socket.id || session.reconcilingConnectionId === socket.id) return null;
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
  io.use(async (socket, next) => {
    let payload;
    try {
      payload = jwt.verify(socket.handshake.auth?.token, JWT_SECRET);
    } catch { return next(new Error('Invalid token')); }
    try {
      const user = await authorizeAccount(payload.userId);
      socket.userId = user.id; socket.username = user.username; socket.isGuest = !!user.isGuest;
      next();
    } catch (error) { next(new Error(error instanceof AccountError ? error.message : 'Account lookup unavailable; retry')); }
  });
  io.on('connection', socket => {
    const session = getOrCreateSession(socket.userId, socket.username, socket.isGuest);
    const existing = connectedUsers.get(socket.userId);
    connectedUsers.set(socket.userId, { socketId: socket.id, socket, username: socket.username });
    handleReconnect(socket.userId, socket.id);
    session.reconcilingConnectionId = socket.id;
    if (existing && existing.socketId !== socket.id) {
      existing.socket.emit('session:kicked', { reason: 'Logged in from another device' });
      existing.socket.disconnect(true);
    }
    const actor = { userId: socket.userId, username: socket.username, isGuest: socket.isGuest, connectionId: socket.id };
    const games = createGameActions(actor), rooms = createRoomActions(actor);
    // A finished game accepts idle commands; the server releases it first, as game:leave would.
    const dispatch = createSessionDispatcher(session, { ...games, ...rooms, ...createNoticeActions(session) }, {
      finishedGame: gameId => activeGames.get(gameId)?.game.gameOver === true,
      release: (_session, request) => games['game:leave']({ gameId: session.gameId }, request)
    });
    attachCommandTransport(socket, session, { serverId, publish: emitSyncState,
      dispatch: request => runGameplayWork(() => dispatch(request)) });
    const membership = enqueueSessionWork([session], async () => {
      if (session.connectionId !== socket.id) return;
      await restoreMembership(socket.userId);
      if (session.reconcilingConnectionId === socket.id) session.reconcilingConnectionId = null;
    });
    setupChatHandler(io, socket);
    setupPresence(io, socket);
    // Non-authoritative notifications never mutate gameplay or session state.
    socket.on('room:list', (_data, ack) => {
      if (typeof ack !== 'function') return;
      if (session.connectionId !== socket.id) { ack({ ok: false, error: 'Session replaced' }); return; }
      try { ack({ ok: true, ...rooms['room:list']() }); }
      catch { ack({ ok: false, error: 'Could not load rooms. Please retry.' }); }
    });
    socket.on('emote:send', async (data, ack) => {
      let result;
      if (session.connectionId !== socket.id) result = { ok: false, code: 'SESSION_REPLACED', error: 'This session was replaced.' };
      else {
        try { result = await games['emote:send'](data && typeof data === 'object' ? data : {}); }
        catch (error) {
          console.error('Emote send unavailable:', error.message);
          result = { ok: false, code: 'UNAVAILABLE', error: 'Could not send the emote. Please try again.' };
        }
      }
      if (typeof ack === 'function') ack(result);
    });
    membership.then(() => {
      if (session.connectionId !== socket.id) return;
      emitSyncState(socket, socket.userId);
      const room = gameRooms.get(session.roomId);
      if (room) void tryStartRoom(room).catch(error => console.error('Room start on reconnect failed:', error.message));
    }).catch(error => { console.error('Room reconnect failed:', error.message); if (session.connectionId === socket.id) socket.disconnect(true); });
    socket.on('sync:request', (_data, ack) => {
      membership.then(() => {
        const snapshot = emitSyncState(socket, socket.userId);
        if (typeof ack === 'function') ack(snapshot);
      }).catch(() => { if (typeof ack === 'function') ack(null); });
    });
    socket.on('disconnect', () => {
      if (session.connectionId !== socket.id) return;
      connectedUsers.delete(socket.userId);
      handleDisconnect(socket.userId);
      games.disconnect(); rooms.disconnect();
      if (session.gameId || session.spectatingGameId) publishGame(session.gameId || session.spectatingGameId);
      broadcastStats(io);
    });
  });
}
