import prisma from '../db.js';
import { AdminActionError } from '../../shared/adminActions.js';
import { assertActiveAccount } from './accounts.js';
import { readPuzzleBuffer } from './puzzleBuffer.js';
import { gameLogEntry } from './gameLog.js';
import { gameParticipants } from './publicGames.js';
import { getStats } from '../socket/presenceHandler.js';
import { playerActivity } from './playerStats.js';

const identity = { id: true, username: true, isAdmin: true, isBot: true, isGuest: true };
export const adminPlayerFields = { ...identity, email: true, elo: true, peakElo: true, coins: true, gamesPlayed: true, wins: true, losses: true, profilePublic: true, createdAt: true, guestRetiredAt: true };
const positive = value => { if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new AdminActionError('Invalid record ID'); return Number(value); };
const exists = value => { if (!value) throw new AdminActionError('Record not found', 404); return value; };
const pageSize = 25;
function puzzleDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AdminActionError('Search puzzles by YYYY-MM-DD');
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AdminActionError('Invalid puzzle date');
  return date;
}
function pageQuery(query) {
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new AdminActionError('Invalid page');
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100)) throw new AdminActionError('Search must be at most 100 characters');
  return { skip: offset, take: pageSize + 1 };
}
function page(rows, query) { return { rows: rows.slice(0, pageSize), nextOffset: rows.length > pageSize ? (Number(query.offset) || 0) + pageSize : null }; }

// Every request checks current database authority, independently of UI visibility or JWT metadata.
export async function readAdmin(actorId, section, id, query = {}) {
  return prisma.$transaction(async db => {
    const actor = assertActiveAccount(await db.user.findUnique({ where: { id: actorId } }));
    if (!actor.isAdmin) throw new AdminActionError('Admin access required', 403);
    const paging = pageQuery(query);
    const q = query.q?.trim() || '';
    const target = query.userId ? positive(query.userId) : null;
    let result;
    if (section === 'overview') {
      const [players, rooms, games, settlements, buffer, recentActions] = await Promise.all([
        db.user.count({ where: { isBot: false, guestRetiredAt: null } }),
        db.roomRecord.count({ where: { status: { not: 'CLOSED' } } }),
        db.gameRun.count({ where: { status: 'OPEN' } }),
        db.gameSettlementJob.count({ where: { completedAt: null } }),
        readPuzzleBuffer(db),
        db.adminOperation.findMany({ orderBy: { id: 'desc' }, take: 5, include: { actor: { select: identity }, target: { select: identity } } })
      ]);
      result = { players, rooms, games, settlements, buffer, recentActions, presence: getStats(), asOf: new Date().toISOString() };
    } else if (section === 'players' && id) {
      const player = exists(await db.user.findUnique({ where: { id: positive(id) }, select: adminPlayerFields }));
      const [games, activity, room, run] = await Promise.all([
        db.game.findMany({ where: { OR: [{ redPlayerId: player.id }, { blackPlayerId: player.id }] }, orderBy: { id: 'desc' }, take: 20, include: gameParticipants }),
        playerActivity(db, player.id), db.activeRoomMember.findUnique({ where: { userId: player.id } }),
        db.activeGamePlayer.findUnique({ where: { userId: player.id } })
      ]);
      result = { player, games: games.map(gameLogEntry), activity, room, run };
    } else if (section === 'players') {
      const filter = query.filter || 'all';
      if (!['all', 'admins', 'guests', 'registered', 'bots', 'retired'].includes(filter)) throw new AdminActionError('Invalid player filter');
      const sort = query.sort || 'newest';
      const orders = { newest: {id:'desc'}, oldest: {id:'asc'}, rating: {elo:'desc'}, coins: {coins:'desc'}, name: {username:'asc'} };
      if (!Object.hasOwn(orders, sort)) throw new AdminActionError('Invalid sort order');
      const where = { ...(q ? { OR: [{ username: { contains: q, mode: 'insensitive' } }, ...(/^\d+$/.test(q) ? [{ id: positive(q) }] : [])] } : {}),
        ...(filter === 'admins' ? { isAdmin: true } : filter === 'guests' ? { isGuest: true, guestRetiredAt: null } : filter === 'registered' ? { isGuest: false, isBot: false } : filter === 'bots' ? { isBot: true } : filter === 'retired' ? { guestRetiredAt: { not: null } } : {}) };
      result = page(await db.user.findMany({ where, select: adminPlayerFields, orderBy: [orders[sort], {id:'desc'}], ...paging }), query);
    } else if (section === 'rooms') {
      if (id) result = { room: exists(await db.roomRecord.findUnique({ where: { id: BigInt(positive(id)) } })) };
      else result = page(await db.roomRecord.findMany({ where: { ...(q ? { id: BigInt(positive(q)) } : { status: { not: 'CLOSED' } }) }, select: { id: true, status: true, createdAt: true, revision: true, state: true }, orderBy: { id: 'desc' }, ...paging }), query);
    } else if (section === 'games') {
      if (id) {
        const game = exists(await db.game.findUnique({ where: { id: positive(id) }, include: gameParticipants }));
        result = { game: { ...gameLogEntry(game), moveHistory: game.moveHistory }, run: await db.gameRun.findUnique({ where: { replayId: game.id }, select: { id: true, status: true, createdAt: true, closedAt: true, revision: true, roomId: true } }) };
      } else result = page((await db.game.findMany({ where: { ...(q ? { id: positive(q) } : {}), ...(target ? { OR: [{ redPlayerId: target }, { blackPlayerId: target }] } : {}) }, include: gameParticipants, orderBy: { id: 'desc' }, ...paging })).map(gameLogEntry), query);
    } else if (section === 'live') {
      const select = { id: true, status: true, mode: true, buyIn: true, turnTime: true, createdAt: true, revision: true, roomId: true, replayId: true, redPlayer: { select: identity }, blackPlayer: { select: identity } };
      if (id) result = { run: exists(await db.gameRun.findUnique({ where: { id: positive(id) }, select })) };
      else result = page(await db.gameRun.findMany({ where: { ...(q ? { id: positive(q) } : { status: 'OPEN' }) }, select, orderBy: { id: 'desc' }, ...paging }), query);
    } else if (section === 'puzzles') {
      if (id) {
        const puzzle = exists(await db.puzzle.findUnique({ where: /^\d{4}-\d{2}-\d{2}$/.test(id) ? { date: puzzleDate(id) } : { id: positive(id) } }));
        result = { puzzle, rejection: await db.puzzleRejection.findUnique({ where: { positionHash: puzzle.positionHash } }), attempts: await db.puzzleAttempt.count({ where: { puzzleId: puzzle.id } }) };
      } else {
        const date = puzzleDate(q || new Date().toISOString().slice(0, 10));
        const [rows, buffer] = await Promise.all([db.puzzle.findMany({ where: { date: { gte: date } }, select: { id: true, date: true, difficulty: true, theme: true, verifiedDepth: true, solutionPlies: true, generatorVersion: true }, orderBy: { date: 'asc' }, ...paging }), readPuzzleBuffer(db)]);
        result = { ...page(rows, query), buffer };
      }
    } else if (section === 'economy') {
      result = page(await db.coinTransaction.findMany({ where: target ? { OR: [{ senderId: target }, { receiverId: target }] } : {}, include: { sender: { select: identity }, receiver: { select: identity } }, orderBy: { id: 'desc' }, ...paging }), query);
    } else if (section === 'activity') {
      result = page(await db.adminOperation.findMany({ where: target ? { OR: [{ actorId: target }, { targetId: target }] } : {}, include: { actor: { select: identity }, target: { select: identity } }, orderBy: { id: 'desc' }, ...paging }), query);
    } else throw new AdminActionError('Unknown admin section', 404);
    return JSON.parse(JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  }, { timeout: 15000 });
}
