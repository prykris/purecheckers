import { createHash } from 'node:crypto';
import prisma from '../db.js';
import { WorkerPool } from '../services/workerPool.js';
import { publicUsername } from '../services/publicName.js';
import { gameParticipants } from '../services/publicGames.js';
import { findPublicPlayer, playerActivity } from '../services/playerStats.js';
import { parsePuzzleDate, todayUtc, isoDate } from '../../shared/puzzleDates.js';
import { finalPosition } from './board.js';
import { ImageCache } from './cache.js';
import { gameTemplate, playerTemplate, puzzleTemplate, inviteTemplate } from './templates.js';
import { PREVIEW_TEMPLATE_VERSION } from '../../shared/previewImages.js';

const lookupRoom = async code => (await import('../domain/rooms.js')).findRoomByCode(code);
export function createCardService({ db = prisma, findRoom = lookupRoom, now = Date.now, render, cache = new ImageCache({ now }), log = console.info } = {}) {
  const pool = render ? null : new WorkerPool(new URL('./worker.js', import.meta.url), { size: 1, maxQueue: 8 });
  const rasterize = render ?? (svg => pool.run({ svg }, { timeoutMs: 5000 }).then(result => Buffer.from(result)));
  const pending = new Map();
  async function specification(kind, value) {
    if (kind === 'game') {
      const row = await db.game.findUnique({ where: { id: Number(value) }, include: gameParticipants });
      if (!row) return null;
      const game = { id: row.id, result: row.result, endReason: row.endReason, mode: row.mode, date: row.endedAt ?? row.startedAt,
        redPlayer: publicUsername(row.redPlayer.username), blackPlayer: publicUsername(row.blackPlayer.username),
        redEloChange: row.redEloChange, blackEloChange: row.blackEloChange, moveCount: row.moveHistory.length,
        isBotGame: row.redPlayer.isBot || row.blackPlayer.isBot };
      return { data: [game, row.moveHistory], maxAge: 31536000,
        svg: () => gameTemplate({ game, board: finalPosition(row.moveHistory) }) };
    }
    if (kind === 'player') {
      // Recheck visibility even on a cache hit or conditional request.
      const player = await findPublicPlayer(db, value, new Date(now()));
      if (!player) return null;
      const today = isoDate(new Date(now()));
      return { data: [player, today], maxAge: 0, ttl: 3600000, svg: async () => playerTemplate({ player, today,
        activity: await playerActivity(db, player.id, { days: 84, now: new Date(now()) }) }) };
    }
    if (kind === 'puzzle') {
      const date = parsePuzzleDate(value);
      if (!date || date > todayUtc(new Date(now()))) return null;
      // Never load or pass the solution to the preview renderer.
      const puzzle = await db.puzzle.findUnique({ where: { date }, select: { date: true, position: true, sideToMove: true } });
      return puzzle ? { data: puzzle, maxAge: 31536000, svg: () => puzzleTemplate(puzzle) } : null;
    }
    if (kind === 'invite') {
      const room = await findRoom(value);
      if (!room || room.status !== 'waiting') return null;
      const invite = { hostName: publicUsername(room.hostName), buyIn: room.settings.buyIn, turnTimer: room.settings.turnTimer };
      return { data: invite, maxAge: 60, svg: () => inviteTemplate(invite) };
    }
    return null;
  }
  return {
    hasRequest: key => cache.hasRequest(key),
    close: () => pool?.close(),
    async get(kind, value) {
      const spec = await specification(kind, value);
      if (!spec) return null;
      const requestKey = kind + '/' + value;
      const digest = createHash('sha256').update(JSON.stringify([PREVIEW_TEMPLATE_VERSION, requestKey, spec.data])).digest('hex');
      const key = requestKey + ':' + digest;
      const hit = cache.get(key);
      if (hit) return hit;
      if (pending.has(key)) return pending.get(key);
      if (pending.size >= 9) throw new Error('Preview queue full');
      const work = async () => {
        const started = now();
        const png = await rasterize(await spec.svg());
        const row = { png, etag: '"' + digest + '"', requestKey, maxAge: spec.maxAge, expires: now() + (spec.ttl ?? spec.maxAge * 1000) };
        cache.set(key, row); log('[og] rendered', kind, now() - started, 'ms'); return row;
      };
      const task = work().finally(() => pending.delete(key)); pending.set(key, task); return task;
    },
  };
}
export const cardService = createCardService();
