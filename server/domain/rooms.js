import { randomInt } from 'node:crypto';
import prisma from '../db.js';
import QRCode from 'qrcode';
import { reject } from './sessionCommands.js';
import { resetReadiness, removeMember, canStartRoom } from './roomRules.js';
import { publishUser, broadcast, notifyUser } from './events.js';
import { createGameDirect } from './games.js';
import { getBotUser } from '../services/botPlayer.js';
import { TURN_TIME } from '../../shared/constants.js';
import { SITE_URL } from '../config.js';
import { getSession, setPhase, forceIdle } from './sessions.js';

export const gameRooms = new Map();
let nextRoomId = Date.now();

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join(''); }
  while (findRoomByCode(code));
  return code;
}
export function findRoomByCode(code) { return [...gameRooms.values()].find(room => room.joinCode === code) || null; }

function playerRecord(user, ready = false) {
  return { userId: user.id, username: user.username, elo: user.elo, isGuest: !!user.isGuest, isBot: !!user.isBot, ready: !!user.isBot || ready, online: true };
}
function newRoom(players, settings) {
  return { id: nextRoomId++, hostId: players[0].userId, hostName: players[0].username, joinCode: genCode(),
    settings, players, spectators: [], status: 'waiting', gameId: null, createdAt: Date.now() };
}
function currentActor(actor, phase) {
  const session = getSession(actor.userId);
  if (session?.connectionId !== actor.connectionId || session.phase !== phase) reject('Your session changed. Please try again.');
  return session;
}
function waitingRoom(actor, roomId) {
  const session = currentActor(actor, 'in-room');
  const room = gameRooms.get(roomId);
  if (!room || session.roomId !== roomId) reject('Not in this room');
  if (room.status !== 'waiting') reject('Game is starting or already active');
  return room;
}
function installRoom(room) {
  gameRooms.set(room.id, room);
  for (const player of room.players) if (!player.isBot) setPhase(player.userId, 'in-room', { roomId: room.id });
  broadcastRoomUpdate(room);
}

export function sanitizeRoom(room) {
  const result = {
    id: room.id,
    hostId: room.hostId,
    hostName: room.hostName,
    joinCode: room.joinCode,
    settings: {
      buyIn: room.settings.buyIn,
      turnTimer: room.settings.turnTimer,
      isPrivate: room.settings.isPrivate,
      allowSpectators: room.settings.allowSpectators,
    },
    players: room.players.map(p => ({ userId: p.userId, username: p.username, elo: p.elo, ready: p.ready, online: p.online !== false, isGuest: p.isGuest || false, isBot: p.isBot || false })),
    spectators: room.spectators.map(s => ({ userId: s.userId, username: s.username })),
    status: room.status,
    gameId: room.gameId || null,
    createdAt: room.createdAt,
    qrDataUrl: room.qrDataUrl || null,
    effectiveMode: room.players.some(p => p.isGuest || p.isBot) ? 'FRIENDLY' : 'RANKED',
  };
  result.joinUrl = `${SITE_URL}/join/${room.joinCode}`;
  return result;
}

export function broadcastRoomUpdate(room) {
  // Private rooms are never announced in the public lobby.
  if (!room.settings.isPrivate) broadcast('room:list-update', { room: sanitizeRoom(room) });
  for (const member of [...room.players, ...room.spectators]) publishUser(member.userId);
}

export function createRoomActions(actor) {
  return {
    async 'room:create'({ buyIn = 0, turnTimer = TURN_TIME, isPrivate = false, allowSpectators = true }) {
      if (!Number.isSafeInteger(buyIn) || buyIn < 0 || ![0, 30, 60, 90].includes(turnTimer) || typeof isPrivate !== 'boolean' || typeof allowSpectators !== 'boolean') reject('Invalid room settings');
      const host = await prisma.user.findUnique({ where: { id: actor.userId } });
      currentActor(actor, 'idle');
      if (!host || host.coins < buyIn) reject('Cannot afford buy-in');
      if (host.isGuest && buyIn > 0) reject('Wagers require registered players');
      const room = newRoom([playerRecord(host)], { buyIn, turnTimer, isPrivate, allowSpectators });
      try { room.qrDataUrl = await QRCode.toDataURL(SITE_URL + '/join/' + room.joinCode, { width: 200, margin: 1 }); } catch { room.qrDataUrl = null; }
      currentActor(actor, 'idle');
      installRoom(room);
    },
    'room:list'({ filter } = {}) {
      let rooms = [...gameRooms.values()].filter(room => !room.settings.isPrivate).map(sanitizeRoom);
      if (filter === 'free') rooms = rooms.filter(room => room.settings.buyIn === 0);
      if (filter === 'available') rooms = rooms.filter(room => room.status === 'waiting' && room.players.length < 2);
      rooms.sort((a, b) => Number(b.status === 'waiting') - Number(a.status === 'waiting') || a.createdAt - b.createdAt);
      notifyUser(actor.userId, 'room:list', { rooms });
    },
    async 'room:join'({ roomId, code }) {
      const room = roomId ? gameRooms.get(roomId) : findRoomByCode(code);
      if (!room || (room.settings.isPrivate && code !== room.joinCode)) reject('Room not found');
      const user = await prisma.user.findUnique({ where: { id: actor.userId } });
      currentActor(actor, 'idle');
      if (gameRooms.get(room.id) !== room || room.status !== 'waiting' || room.players.length >= 2) reject('Room is no longer available');
      if (!user || user.coins < room.settings.buyIn) reject('Cannot afford buy-in');
      if (user.isGuest && room.settings.buyIn > 0) reject('Wagers require registered players');
      room.players.push(playerRecord(user));
      resetReadiness(room);
      setPhase(actor.userId, 'in-room', { roomId: room.id });
      broadcastRoomUpdate(room);
    },
    'room:ready'({ roomId, ready }) {
      const room = waitingRoom(actor, roomId);
      const player = room.players.find(player => player.userId === actor.userId && !player.isBot);
      if (!player || typeof ready !== 'boolean') reject('Invalid readiness request');
      player.ready = ready;
      broadcastRoomUpdate(room);
      return startRoomGame(room);
    },
    'room:leave'({ roomId }) {
      const session = getSession(actor.userId);
      const owned = session.phase === 'in-room' ? session.roomId : session.spectatingRoomId;
      if (owned !== roomId) reject('Not in this room');
      const room = gameRooms.get(owned);
      if (session.phase === 'in-room' && room?.status !== 'waiting') reject('Game is starting or already active');
      leaveRoom(room, actor.userId);
    },
    'room:kick'({ roomId, userId }) {
      const room = waitingRoom(actor, roomId);
      if (room.hostId !== actor.userId || userId === actor.userId) reject('Only the host can remove other members');
      if (![...room.players, ...room.spectators].some(player => player.userId === userId)) reject('Member not found');
      leaveRoom(room, userId);
    },
    'room:spectate'({ roomId, code }) {
      currentActor(actor, 'idle');
      const room = gameRooms.get(roomId);
      if (!room || (room.settings.isPrivate && code !== room.joinCode)) reject('Room not found');
      if (!room.settings.allowSpectators) reject('Spectators not allowed');
      room.spectators.push({ userId: actor.userId, username: actor.username });
      setPhase(actor.userId, 'spectating', { spectatingRoomId: room.id, spectatingGameId: room.gameId });
      broadcastRoomUpdate(room);
    },
    async 'bot:play'({ difficulty = 'medium' }) {
      const [host, bot] = await Promise.all([prisma.user.findUnique({ where: { id: actor.userId } }), getBotUser(difficulty)]);
      currentActor(actor, 'idle');
      if (!host || !bot) reject('Bot is unavailable');
      const room = newRoom([playerRecord(host, true), playerRecord(bot)], { buyIn: 0, turnTimer: TURN_TIME, isPrivate: false, allowSpectators: true });
      installRoom(room);
      return startRoomGame(room);
    },
    async 'bot:join'({ roomId, difficulty = 'medium' }) {
      let room = waitingRoom(actor, roomId);
      if (room.hostId !== actor.userId || room.players.length !== 1 || room.settings.buyIn !== 0) reject('A bot requires a free room with one host');
      const bot = await getBotUser(difficulty);
      room = waitingRoom(actor, roomId);
      if (!bot) reject('Bot is unavailable');
      if (room.hostId !== actor.userId || room.players.length !== 1) reject('Room membership changed');
      room.players.push(playerRecord(bot));
      broadcastRoomUpdate(room);
      return startRoomGame(room);
    },
    disconnect() {
      for (const room of gameRooms.values()) {
        const spectatorIndex = room.spectators.findIndex(player => player.userId === actor.userId);
        if (spectatorIndex >= 0) room.spectators.splice(spectatorIndex, 1);
        const player = room.players.find(player => player.userId === actor.userId);
        if (player && room.status !== 'playing') { player.online = false; player.ready = false; }
        if (player || spectatorIndex >= 0) broadcastRoomUpdate(room);
      }
    }
  };
}

async function startRoomGame(room) {
  if (!canStartRoom(room)) return;
  room.status = 'starting'; // Synchronous reservation before any database operation.
  broadcastRoomUpdate(room);
  let debited = false;
  try {
    if (room.settings.buyIn > 0) {
      await prisma.$transaction(async tx => {
        for (const player of room.players) {
          const debit = await tx.user.updateMany({ where: { id: player.userId, coins: { gte: room.settings.buyIn }, isGuest: false, isBot: false }, data: { coins: { decrement: room.settings.buyIn } } });
          if (debit.count !== 1) throw new Error('Insufficient balance');
        }
      });
      debited = true;
    }
    const players = Math.random() < 0.5 ? room.players : [...room.players].reverse();
    const mode = players.some(player => player.isGuest || player.isBot) ? 'FRIENDLY' : 'RANKED';
    const game = await createGameDirect(players[0].userId, players[1].userId, mode, room.settings.buyIn, room.settings.turnTimer);
    room.gameId = game.id;
    room.status = 'playing';
    for (const spectator of room.spectators) setPhase(spectator.userId, 'spectating', { spectatingRoomId: room.id, spectatingGameId: game.id });
    broadcastRoomUpdate(room);
  } catch (error) {
    if (debited) await prisma.$transaction(room.players.map(player => prisma.user.update({ where: { id: player.userId }, data: { coins: { increment: room.settings.buyIn } } })));
    room.status = 'waiting';
    resetReadiness(room);
    broadcastRoomUpdate(room);
    console.error('Room start failed:', error);
    reject('Game could not start. Ready again to retry.');
  }
}

export async function createQuickPlayRoom(playerA, playerB) {
  const players = [playerA, playerB];
  if (!players.every(player => getSession(player.userId)?.phase === 'matchmaking' && getSession(player.userId)?.connectionId)) {
    // Pairing consumed these entries. Restore any remaining searcher to an actionable state.
    for (const player of players) if (getSession(player.userId)?.phase === 'matchmaking') { forceIdle(player.userId); publishUser(player.userId); }
    return;
  }
  const room = newRoom(players.map(player => ({ ...player, username: getSession(player.userId).username, ready: true, online: true, isBot: false })),
    { buyIn: 0, turnTimer: TURN_TIME, isPrivate: false, allowSpectators: true });
  installRoom(room);
  await startRoomGame(room);
}

export function leaveRoom(room, userId) {
  forceIdle(userId);
  publishUser(userId);
  if (!room) return;
  const members = [...room.players, ...room.spectators];
  if (!removeMember(room, userId).closed) return broadcastRoomUpdate(room);
  gameRooms.delete(room.id);
  for (const member of members) {
    const session = getSession(member.userId);
    if (session?.roomId === room.id || session?.spectatingRoomId === room.id) { forceIdle(member.userId); publishUser(member.userId); }
  }
  if (!room.settings.isPrivate) broadcast('room:list-update', { room: { id: room.id, closed: true } });
}
